-- フェーズ5: 定植日報から自動生成する畝ロットの二重生成をDB側でも防ぐ（Codexレビュー27 Medium対応）
-- 応答喪失→同時再送や別端末同時操作で、同じ定植日報(source_record_id)から2ロット作られる余地を塞ぐ砦。
-- source_record_id は「生成元の定植日報id」。手動追加ロット(source_record_idがnull)は対象外なので部分一意。
create unique index if not exists farm_lots_source_record_uniq
  on public.farm_lots (farm_id, source_record_id)
  where source_record_id is not null;
