-- フェーズ5: 施肥(farm_top_dressing_records)のDB経路化に伴う列追加
-- フォームは checks(転記チェック) と staff_ids(担当者) を保存するが、この表には列が無く
-- DB経路に切り替えるとこの2項目が欠落する。畝ロット散布(20260713_02でchecks追加)と同型で列を足す。
-- jsonb NOT NULL 既定つき(converterのtoRowは必ず値を入れる契約)。
alter table public.farm_top_dressing_records
  add column if not exists checks jsonb not null default '{}'::jsonb,
  add column if not exists staff_ids jsonb not null default '[]'::jsonb;
