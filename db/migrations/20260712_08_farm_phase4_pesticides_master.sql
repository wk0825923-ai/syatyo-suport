-- マスタUUID化第1弾(農薬): 旧数値ID保持legacy_id(同一農場内で一意)＋realtime配信
alter table public.farm_pesticides add column legacy_id bigint;
create unique index farm_pesticides_farm_legacy_uniq
  on public.farm_pesticides (farm_id, legacy_id) where legacy_id is not null;
alter publication supabase_realtime add table public.farm_pesticides;
alter table public.farm_pesticides replica identity full;
