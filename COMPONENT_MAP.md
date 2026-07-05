# components.js ナビマップ（機能 → 行範囲の索引）

`js/components.js` は約 15,000 行・106 関数の 1 ファイル。**単一ファイルのまま**運用しているので、
目的のコンポーネントへ最短で飛べるよう索引を用意した。

> ⚠️ 行番号は作成時点の目安。編集でズレるので、ズレたら再生成：
> ```bash
> grep -nE '^function ' js/components.js
> ```
> エディタの「シンボル検索（関数一覧）」でも一覧できる。

## 読み方
- 各ページは `app.js` の `pageMap[<id>]` から `React.createElement(<Page>, {...})` で呼ばれる。
  ページ名↔ナビ id の対応は `js/components.js` 冒頭の `NAV_SECTIONS_*` を参照。
- 「◯◯Section / ◯◯Panel / ◯◯Modal」は上位ページの部品。

---

## レイアウト・共通
| 行 | 関数 | 役割 |
|---|---|---|
| 208 | `Sidebar` | 左メニュー（NAV_SECTIONS_* をレンダリング） |
| 315 | `SectionTitle` | 見出し |
| 2808 | `StepBar` | 日報のステップ表示 |
| 7666 | `ConfirmDeleteModal` | **共通の削除確認モーダル**（全削除はこれを使う） |
| 4009 | `celebrateSave(msg)` | **保存演出**（丸チェック＋紙吹雪。DOM 直生成） |
| 4404 | `parseRowRange` / 4427 `selectedRowsToRange` | 畝範囲文字列 ⇔ 数値集合 |
| 3980 | `compressImageFile` / 4042 `estimateLocalStorageBytes` | 写真圧縮・容量見積り |
| 15053 | `usePersistState` | **localStorage 永続化フック**（`app.js` の `useFPS` の実体） |

## ダッシュボード（page: `dashboard`）
| 行 | 関数 |
|---|---|
| 2136 | `Dashboard`（本体） |
| 331 | `MonthlySummaryChart` / 952 `MonthlyUsageBarChart` |
| 1861 | `TodayTaskList` / 1739 `RecentRecordsPanel` |
| 1412 | `GapProgressBarDashboard` / 1431 `HarvestRiskAlertCard` / 1458 `HarvestRiskClearBadge` |
| 1476 | `CropSuggestionCard` / 1514 `FieldCard` / 1560 `FieldCardCompact` / 1619 `FieldSummaryTabPanel` |

## 日報入力（page: `daily_entry` / 圃場詳細 `field:*:daily`）
| 行 | 関数 |
|---|---|
| 4055 | `RecordForm`（4ステップの親） |
| 2831 / 2983 / 3046 / 3278 | `RecordStep1`(日付・圃場) / `RecordStep2`(作業内容+写真) / `RecordStep3`(農薬/施肥・**送りは「確認→」**) / `RecordStep4`(確認・保存) |
| 3407 | `RecordDetailModal`（記録の閲覧/編集/削除） |
| 3694 | `RecordTable` / 4165 `RecordTablePage`（page: `record_list` 日報管理） |
| 2393 | `PesticideInput` / 2710 `NoteChecklistField` / 2778 `TranscribeStatusBadge` / 2671 `StaffPicker` |

## 圃場詳細（page: `field:<id>:<sub>`）
| 行 | 関数 |
|---|---|
| 7312 | `FieldDetailPage`（親。sub=dashboard/daily/pesticide/harvest/field_eval） |
| 4973 | `FieldDashboardSection` / 7152 `DailySection` / 7202 `CropSpecificDetailsPanel` |
| 4458 | `RowMap`（畝マップ） / 4183 `RowMapView` / 4226 `RowDetailPanel` / 4832 `LotFormModal`（ロット追加/編集） |
| 4347 | `LotRiskAlertCard` / 4384 `LotRiskClearBadge` / 4748 `RiceStageTimeline` |
| 7275 | `CropCycleSelector` / 7477 `CropCycleHistorySection` / 7599 `FieldEvalTab` |

## 農薬散布・施肥・収穫（ロット単位。圃場詳細のタブ）
| 行 | 関数 |
|---|---|
| 5271 / 5517 / 5701 | `LotSprayRecordForm` / `...List` / `...Section`（農薬散布） |
| 5757 / 6056 / 6236 | `TopDressingRecordForm` / `...List` / `...Section`（施肥） |
| 6386 / 6814 / 7043 | `HarvestRecordForm` / `...List` / `...Section`（収穫） |
| 6288 | `ShipmentDestinationManageModal`（出荷先マスタ） |

## 圃場一覧・まとめ・予測・実績
| 行 | 関数 | page |
|---|---|---|
| 7739 | `FieldList` | 一覧の本体 |
| 8000 / 8003 | `FieldMapPage` / `FieldTablePage` | `field_map` / `fields` |
| 8016 | `FieldSummaryPage` | `field_summary`（圃場まとめ・ロット別生産履歴） |
| 8330 | `HarvestForecastPage` | `harvest_forecast`（収穫予測・積算温度） |
| 8486 | `FieldPerformancePage` | `field_performance`（圃場実績・評価） |

## GAP / 作付計画
| 行 | 関数 | page |
|---|---|---|
| 9551 | `GapChecklist` | `gap` |
| 9747 | `GapExport` / 9904 `GapFull` / 9659 `GapDocumentList` / 9424 `useGapBase` | `export` |
| 12471 | `CropPlan` | `crop_plan` |

## マスタ・管理（page: 下段「管理・設定」）
| 行 | 関数 | page |
|---|---|---|
| 13096 | `PesticideMasterPage` / 13477 `PesticideDetailModal` | `pesticide_master` |
| 13813 | `FertilizerMasterPage`（+ 14119 `FertilizerAddModal` / 14230 `FertilizerDetailModal` ほか） | `fertilizer_master` |
| 14862 | `CropCategoryPage` | `crop_categories` |
| 10738 | `StaffList` / 9230 `VisaPage` | `staff` |
| 11348 | `TraineeDiaryPage` | `trainee_diary` |
| 10275 | `Equipment` / 10141 `RentalDetailModal` | `equipment` |
| 9933 | `RevenueSimulator` | `simulator` |
| 12140 | `ManualLibrary` | `manual` |
| 12342 | `Settings` | `settings` |

## 認証（主体は `js/auth.js`）
| 行 | 関数 | 備考 |
|---|---|---|
| auth.js | `LoginScreen` / `OnboardingScreen` / `Root` | 認証・オンボーディングの本体 |
| 12873 | `LoginScreen`（components.js 側） | ⚠️ auth.js と重複の可能性。要精査・統合候補 |

## 在庫ウィジェット / 仕入れ履歴
| 行 | 関数 |
|---|---|
| 685 / 1139 | `PesticideStockWidget` ⚠️ **同名が2つ定義**（重複・要整理） |
| 1276 | `FertilizerStockWidget` / 814 `InventoryCheckPanel` / 1003 `PesticideHistoryPanel` |
| 14507 `FertilizerInventoryCheckPanel` / 14596 `FertilizerPurchaseHistoryPanel` / 14631 `FertilizerUsageHistoryPanel` |

## 掃除できるデッドコード
- 11915 `PlanCompareCard` … 開発モデル比較。UI から外済み（呼び出し無し）。削除可。
- `LotsStep2DebugPanel`（`app.js`）… 定義のみ・未レンダリング。削除可。
- 685/1139 `PesticideStockWidget` の重複、12873 `LoginScreen` の重複可能性。
