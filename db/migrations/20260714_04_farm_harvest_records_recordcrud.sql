-- フェーズ5: 収穫記録(farm_harvest_records)のDB経路化=記録系CRArDの5コレクション目
-- 在庫非連動(整備/出荷と同型)。recordCrudに必要な version(楽観ロック)・legacy_id(ID移行)・
-- checks(転記チェック・フォームが保存するがDB列が無いと欠落)を追加し、realtimeの3点セットを整える。
alter table public.farm_harvest_records
  add column if not exists version integer not null default 1,
  add column if not exists legacy_id bigint,
  add column if not exists checks jsonb not null default '{}'::jsonb;

-- 移行時のID重複ガード(legacy_idがある行のみ・手動追加はnullで対象外)
create unique index if not exists farm_harvest_records_farm_legacy_uniq
  on public.farm_harvest_records (farm_id, legacy_id) where legacy_id is not null;

-- realtime 3点セット: publication登録 + filter購読にDELETE配信するための replica identity full
alter publication supabase_realtime add table public.farm_harvest_records;
alter table public.farm_harvest_records replica identity full;
