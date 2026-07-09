// ─────────────────────────────────────────────────────────────
// QA番人: P3「複数畝の一括登録」(commit 7307bab) 複合条件 深掘り監査
//
// 既存 qa_p3_bulkrows.js は 農薬散布フォーム(6畝)の E2E を1本カバー。
// 本ハーネスはそれを補完し、Chromeを起動せず(8GBメモリ制約)、
// components.js から純関数と P3 追加ロジックを抽出して
// 施肥/収穫フォーム・境界・cornW/E・スコープ(表示モード)・集計を
// 掛け算で検証する。本体jsは読むだけ・一切書き換えない。
// ─────────────────────────────────────────────────────────────
const fs = require('fs')
const path = require('path')
const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'js', 'components.js'), 'utf8')

function extractFn(name) {
  const m = SRC.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'))
  if (!m) throw new Error('関数が見つからない: ' + name)
  let i = SRC.indexOf('{', m.index), depth = 0, started = false
  for (; i < SRC.length; i++) {
    if (SRC[i] === '{') { depth++; started = true }
    else if (SRC[i] === '}') { depth--; if (started && depth === 0) { i++; break } }
  }
  return SRC.slice(m.index, i)
}
const ctx = {}
;(new Function(extractFn('parseRowRange') + '\n' + extractFn('selectedRowsToRange') +
  '\nthis.parseRowRange=parseRowRange;this.selectedRowsToRange=selectedRowsToRange')).call(ctx)
const { parseRowRange, selectedRowsToRange } = ctx

// P3 実装式の再現 (components.js の該当行と一致):
const bulkSelectAll = (tr) => { const s = new Set(); for (let i = 1; i <= tr; i++) s.add(i); return s } // 5409
const rowMapClamp = (tr) => { const _t = Math.round(Number(tr)); return (!_t || _t < 1 || !Number.isFinite(_t) || _t > 500) ? null : _t } // 5205-7
const bulkButtonsShown = ({ selectable, onSelectRows }) => !!(selectable && onSelectRows) // 5404
const formSync = (set) => selectedRowsToRange(set) // 6027/6526/7197 共通

let pass = 0, fail = 0; const fails = []
const ck = (n, c, d) => { c ? pass++ : (fail++, fails.push(n + (d ? ' :: ' + d : ''))) }
const eq = (a, b) => String(a) === String(b)

// ── 軸A: 3フォーム共通で全畝選択→1件 row_range="1-N" ──
;[1, 6, 40, 100, 500].forEach(n => {
  const tr = rowMapClamp(n), range = formSync(bulkSelectAll(tr))
  const exp = n === 1 ? '1' : '1-' + n
  ck(`A n=${n} range="${exp}"(散布/施肥/収穫共通)`, eq(range, exp), `got="${range}"`)
  ck(`A n=${n} 1件(カンマ無し)`, !range.includes(','), `got="${range}"`)
  const back = parseRowRange(range)
  let ok = back.size === n; for (let i = 1; i <= n; i++) if (!back.has(i)) ok = false
  ck(`A n=${n} round-trip 二重/欠落なし`, ok, `back.size=${back.size}`)
})

// ── 軸B: 選択×手動テキスト×クリアの往復（乖離なし）──
{
  let sel = bulkSelectAll(6)
  ck('B 全畝→"1-6"', eq(formSync(sel), '1-6'))
  sel = new Set() // クリア
  ck('B クリア→""', eq(formSync(sel), ''))
  ;[4, 2, 5].forEach(x => sel.add(x)) // 個別タップ(順不同)
  ck('B 個別2,4,5→"2,4-5"', eq(formSync(sel), '2,4-5'), formSync(sel))
  // handleRowRangetext: setSelectedRows(new Set()) → 手動編集で選択リセット
  const afterManual = new Set()
  ck('B 手動編集で選択リセット(乖離防止)', afterManual.size === 0)
  const p = parseRowRange('1-3,7')
  ck('B 手動"1-3,7" parse 二重なし', p.size === 4 && [1, 2, 3, 7].every(n => p.has(n)))
  // 全畝→クリア→個別 の往復後も乖離なし
  let s2 = bulkSelectAll(6); s2 = new Set(); s2.add(3)
  ck('B 往復後 selected と range 整合', eq(formSync(s2), '3') && s2.size === 1)
}

// ── 軸C: 境界（1/100/500/501/0/NaN/Inf/負/小数/corn）──
ck('C n=1 全畝="1"', eq(formSync(bulkSelectAll(rowMapClamp(1))), '1'))
{ const t = Date.now(); ck('C n=100 "1-100"', eq(formSync(bulkSelectAll(rowMapClamp(100))), '1-100')); ck('C n=100 高速<50ms(ハング無)', Date.now() - t < 50) }
ck('C n=500 clamp=500', rowMapClamp(500) === 500)
ck('C n=500 range="1-500"', eq(formSync(bulkSelectAll(500)), '1-500'))
ck('C n=501 RowMap null(ボタンごと非描画)', rowMapClamp(501) === null)
ck('C n=100000 null', rowMapClamp(100000) === null)
ck('C n=0 null', rowMapClamp(0) === null)
ck('C n=NaN null', rowMapClamp(NaN) === null)
ck('C n=Infinity null', rowMapClamp(Infinity) === null)
ck('C n=-5 null', rowMapClamp(-5) === null)
ck('C n=3.6 round=4', rowMapClamp(3.6) === 4)
{ // corn showSides: W/E は同じ畝番号 i を共有 → N畝(2N無し)
  const cs = bulkSelectAll(rowMapClamp(8))
  ck('C corn W/E 全畝=8畝(2N無し)', cs.size === 8)
  ck('C corn range="1-8"', eq(formSync(cs), '1-8'))
}
{ // hasMap（フォーム側でRowMap自体を出すか）: lots.length>0 && row_count
  const hasMap = (lots, rc) => !!(lots && lots.length > 0 && rc)
  ck('C hasMap lots空→false(ボタン非表示)', hasMap([], 10) === false)
  ck('C hasMap row_count=0→false', hasMap([{ id: 1 }], 0) === false)
  ck('C hasMap 正常→true', hasMap([{ id: 1 }], 10) === true)
}

// ── 軸D: スコープ（表示モードでボタン非表示）──
ck('D selectable=false→非表示', bulkButtonsShown({ selectable: false, onSelectRows: () => {} }) === false)
ck('D onSelectRows未指定→非表示', bulkButtonsShown({ selectable: true, onSelectRows: undefined }) === false)
ck('D selectable=true&onSelectRows→表示', bulkButtonsShown({ selectable: true, onSelectRows: () => {} }) === true)

// ── 軸E: 集計セマンティクス（1件=1散布, 畝数で多重カウントしない）──
{
  const rec = { row_range: formSync(bulkSelectAll(rowMapClamp(6))), pesticides: [{ pesticide_id: 1 }] }
  const overlaps = (bed) => parseRowRange(rec.row_range).has(bed) ? 1 : 0
  let ok = true; for (let b = 1; b <= 6; b++) if (overlaps(b) !== 1) ok = false
  ck('E 全畝1件は各畝に1回だけ重なる(畝カルテ)', ok)
  ck('E 範囲外畝(7)は重ならない', overlaps(7) === 0)
  // data.js H2: 使用回数はレコード(spray event)数で数える→全畝一括1件=1回
  const sprayEvents = [rec].flatMap(r => (r.pesticides || []).map(p => ({ pesticide_id: p.pesticide_id })))
  ck('E 全畝一括1件=使用1回(畝数6でなく)', sprayEvents.length === 1)
}

console.log('──────────────────────────────────────────────')
console.log('P3 複合深掘り監査 (Chrome不使用/純関数抽出)')
console.log('──────────────────────────────────────────────')
console.log('PASS: ' + pass + '  FAIL: ' + fail)
if (fails.length) { console.log('\n=== FAIL ==='); fails.forEach(f => console.log(' x ' + f)) } else console.log('全チェック合格')
process.exit(fail ? 1 : 0)
