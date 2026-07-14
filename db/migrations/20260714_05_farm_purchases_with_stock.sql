-- フェーズ5: 仕入れ履歴コレクションのDB化(在庫連動移行の最後の山場)
-- ゲート条件(Codex): 「仕入れ履歴の追加」と「在庫の増加」を単一RPCトランザクションにし、
-- 同一送信ID(purchase_id)による再送冪等性まで確保する。
-- 現状: 在庫はfarm_adjust_stock RPCでDB反映するが、購入履歴はlocalStorageのみ=別処理で不整合の余地。

-- ── 購入履歴テーブル(農薬/肥料。append-only想定・UIに編集/削除なし) ──
create table if not exists public.farm_pesticide_purchases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.farm_organizations(id) on delete cascade,
  farm_id uuid not null references public.farm_farms(id) on delete cascade,
  pesticide_id uuid references public.farm_pesticides(id) on delete set null,
  date date,
  amount_l numeric not null default 0,
  supplier text default ''::text,
  price_yen numeric,
  created_at timestamptz default now()
);
create index if not exists farm_pesticide_purchases_farm_idx on public.farm_pesticide_purchases (farm_id);

create table if not exists public.farm_fertilizer_purchases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.farm_organizations(id) on delete cascade,
  farm_id uuid not null references public.farm_farms(id) on delete cascade,
  fertilizer_id uuid references public.farm_fertilizers(id) on delete set null,
  date date,
  amount_kg numeric not null default 0,
  supplier text default ''::text,
  price_yen numeric,
  created_at timestamptz default now()
);
create index if not exists farm_fertilizer_purchases_farm_idx on public.farm_fertilizer_purchases (farm_id);

-- realtime 3点セット(端末またぎ同期用)
alter publication supabase_realtime add table public.farm_pesticide_purchases;
alter publication supabase_realtime add table public.farm_fertilizer_purchases;
alter table public.farm_pesticide_purchases replica identity full;
alter table public.farm_fertilizer_purchases replica identity full;

-- ── 仕入れ登録RPC: 購入履歴insert + 通帳記帳 + 残高更新を1トランザクションで。purchase_idが冪等キー ──
create or replace function public.farm_add_purchase_with_stock(
  p_item_type text,     -- 'pesticide' | 'fertilizer'
  p_item_id uuid,
  p_farm_id uuid,
  p_purchase_id uuid,   -- 冪等キー(フォームのsubmitIdRefが保持)。再送で二重加算しない
  p_date date,
  p_amount numeric,     -- 仕入れ量(L or kg・正数)
  p_supplier text,
  p_price_yen numeric
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_org uuid;
  v_cur numeric;
  v_inserted int;
begin
  if p_item_type not in ('pesticide','fertilizer') then
    raise exception '不明なitem_type: %', p_item_type;
  end if;
  if p_purchase_id is null then
    raise exception 'purchase_id(冪等キー)が未指定です';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception '仕入れ量が正しくありません(%)', p_amount;
  end if;
  if abs(p_amount) > 1000000 then
    raise exception '仕入れ量が異常です(%)', p_amount;
  end if;

  select org_id into v_org from public.farm_farms where id = p_farm_id;
  if v_org is null then
    raise exception '対象の農場が見つかりません(farm_id=%)', p_farm_id;
  end if;

  -- 残高を行ロックつきで取得(同一資材への同時仕入れを直列化)
  if p_item_type = 'pesticide' then
    select coalesce(stock_l, 0) into v_cur from public.farm_pesticides
      where id = p_item_id and farm_id = p_farm_id for update;
  else
    select coalesce(stock_kg, 0) into v_cur from public.farm_fertilizers
      where id = p_item_id and farm_id = p_farm_id for update;
  end if;
  if v_cur is null then
    raise exception '仕入れ対象の資材が見つかりません(item_id=% type=%)', p_item_id, p_item_type;
  end if;

  -- 履歴insert(冪等の砦)。同一purchase_idの再送は0行insert=duplicateで在庫を動かさない
  if p_item_type = 'pesticide' then
    insert into public.farm_pesticide_purchases (id, org_id, farm_id, pesticide_id, date, amount_l, supplier, price_yen)
    values (p_purchase_id, v_org, p_farm_id, p_item_id, p_date, round(p_amount, 2), coalesce(p_supplier, ''), p_price_yen)
    on conflict (id) do nothing;
  else
    insert into public.farm_fertilizer_purchases (id, org_id, farm_id, fertilizer_id, date, amount_kg, supplier, price_yen)
    values (p_purchase_id, v_org, p_farm_id, p_item_id, p_date, round(p_amount, 2), coalesce(p_supplier, ''), p_price_yen)
    on conflict (id) do nothing;
  end if;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('ok', true, 'duplicate', true); -- 既に登録済み(再送)
  end if;

  -- 通帳記帳(+amount)。record_collection='purchase'・record_id=purchase_idで在庫調整/記録系と衝突しない
  insert into public.farm_stock_movements
    (org_id, farm_id, item_type, item_id, delta_amount, unit, reason, record_collection, record_id)
  values (v_org, p_farm_id, p_item_type, p_item_id, round(p_amount, 2),
    case when p_item_type = 'pesticide' then 'L' else 'kg' end,
    '仕入れ', 'purchase', p_purchase_id);

  -- 残高更新
  if p_item_type = 'pesticide' then
    update public.farm_pesticides set stock_l = round(v_cur + p_amount, 2)
      where id = p_item_id and farm_id = p_farm_id;
  else
    update public.farm_fertilizers set stock_kg = round(v_cur + p_amount, 2)
      where id = p_item_id and farm_id = p_farm_id;
  end if;

  return jsonb_build_object('ok', true, 'stock', round(v_cur + p_amount, 2));
end $$;
