# Vite 移行手順書（引き継ぎ後に着手）

現状は **ビルドなし・単一ファイル（`js/components.js` 約15,000行）・JSX 不使用**。
これは「一人で爆速に回す」ための最適化でもあるため、**引き継ぎ or 複数人開発が始まるタイミングで**本手順を実行する。

原則：**一気に書き直さない**。動く状態を保ったまま、外側から少しずつ剥がす（Strangler パターン）。
各フェーズ終了時に `qa/`（E2E）が緑（`errorCount:0`）であることを確認しながら進める。

---

## フェーズ 0: 現状維持のまま足場だけ作る（半日）
目的：ビルドを導入しても**今と同じ挙動**で動く状態にする。まだ 1 ファイルのまま。

1. `npm create vite@latest . -- --template react`（既存ファイルは退避してから統合）。または最小構成で手動導入。
2. CDN の `<script>` を npm 依存へ置換：
   ```bash
   npm i react react-dom leaflet jspdf html2canvas xlsx @supabase/supabase-js
   npm i -D @tabler/icons-webfont tailwindcss
   ```
   `index.html` の CDN タグを削除し、エントリ `main.jsx` で import に置き換える。
   **Tailwind と Tabler は @latest だったのでバージョン固定になる＝突然壊れるリスクが消える**（HANDOFF P2）。
3. 既存 `js/*.js` を**そのまま** import する暫定エントリを作る（中身は触らない）：
   ```js
   // src/main.jsx（暫定）
   import './legacy/config.js'
   import './legacy/data.js'
   import './legacy/components.js'
   import './legacy/auth.js'
   import './legacy/app.js'
   ```
   グローバル前提のコードなので、まずは各ファイル末尾で必要シンボルを `window.X = X` するか、
   ひとつの IIFE スコープに載せて動かす。**ここが一番地味だが重要**。動いたら次へ。
4. Supabase 接続を env 化：`config.js` の直書きを `import.meta.env.VITE_SUPABASE_URL / _ANON_KEY` に。`.env` を作成（`.gitignore` 済）。
5. `npm run build` の成果物で `qa/` を通す。緑なら フェーズ0 完了。

## フェーズ 1: モジュール境界を切る（数日、段階的）
目的：`window.X` 依存を import/export に変える。**ファイル分割はまだ最小限**。

1. `data.js` / `config.js` を ES module 化（`export`）。参照側を `import` に。副作用の少ない下層から。
2. `usePersistState` と `celebrateSave`・`parseRowRange` 等の**共有ユーティリティ**を `src/lib/` へ切り出し。
3. `app.js` の `pageMap` を残したまま、各ページを import で解決するように。

## フェーズ 2: components.js をページ単位で分割（継続的）
目的：15,000行を機能単位のファイルへ。**[COMPONENT_MAP.md](./COMPONENT_MAP.md) の行範囲がそのまま切り出し単位**。

推奨ディレクトリ：
```
src/
  pages/        Dashboard, RecordForm(daily_entry), FieldDetailPage, FieldSummaryPage,
                HarvestForecastPage, FieldPerformancePage, GapExport, StaffList, ...
  components/   Sidebar, ConfirmDeleteModal, RecordStep1..4, LotSprayRecordForm, ...
  lib/          usePersistState, celebrateSave, parseRowRange, compressImageFile, computeHarvestForecast
  data/         INITIAL_* / crop categories
```
やり方：
- **新規/改修する画面から順に**切り出す（全部を一度にやらない）。
- 切り出すたびに import を繋ぎ、`qa/` を通す。
- ついでに [COMPONENT_MAP.md](./COMPONENT_MAP.md) 記載の**デッドコード**（`PlanCompareCard`・`LotsStep2DebugPanel`・重複 `PesticideStockWidget`・重複 `LoginScreen`）を削除。

## フェーズ 3: JSX 化（任意・段階的）
`React.createElement(...)` のままでも動く。読みやすさのため、**触ったファイルから** JSX へ。
Vite の React プラグインが `.jsx` を変換する。機械的変換ツールもあるが、手で直す方が事故が少ない。

## フェーズ 4: 本番データ基盤（HANDOFF P0 と一体）
分割が一段落したら、**localStorage → Supabase 移行**に着手（[HANDOFF.md](./HANDOFF.md) P0）。
- **差し替え点は 1 箇所**：`app.js` の `useFPS(key, initial)`。ここを Supabase 読み書き（+ローカルキャッシュ）に変えれば全画面へ波及。
- 業務テーブルを新設し RLS を org/farm 単位で設計。既存 `farm_members.farm_ids` を流用。写真は Supabase Storage へ。

---

## Vercel 側の変更
- ビルド導入後は Vercel の設定を「Framework: Vite / Build: `npm run build` / Output: `dist`」に変更。
- それまで（フェーズ0前）は現状どおり静的配信（Build なし）。

## 進め方の鉄則
- 各フェーズ・各切り出しの後に **`cd qa && npm run test:farm` が緑**であること。
- 大きな一括変換をやらない。**動く→小さく剥がす→テスト**を繰り返す。
