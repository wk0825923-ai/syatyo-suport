-- 畝ロット散布: 転記チェック(紙日報対応のchecks)を永続化(アプリ形にありDB列が無く切替で消えるため)
alter table public.farm_lot_spray_records add column checks jsonb not null default '{}'::jsonb;
