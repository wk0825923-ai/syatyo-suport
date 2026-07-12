// qa_master_lookup.js — masterById（マスタ突合ヘルパー）の検証（Node・data.jsから切り出し）
// Codexレビュー4の条件付き承認の条件を固定する: 正式id最優先/legacy_idフォールバック/
// String比較統一(Number不使用)/見つからない時はnull(先頭フォールバック禁止)
// 実行: cd qa && node qa_master_lookup.js
const fs = require('fs')
const path = require('path')
const checks = []
const ok = (name, cond, extra) => checks.push({ name, pass: !!cond, extra: extra == null ? '' : String(extra) })

const src = fs.readFileSync(path.resolve(__dirname, '..', 'js', 'data.js'), 'utf8')
const start = src.indexOf('function masterById(list, id) {')
if (start < 0) { console.error('masterById が見つからない'); process.exit(1) }
let depth = 0, end = -1
for (let i = src.indexOf('{', start); i < src.length; i++) {
  if (src[i] === '{') depth++
  else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break } }
}
const masterById = new Function('return ' + src.slice(start, end))()

const UUID_A = 'aaaa0000-0000-0000-0000-000000000001'
const UUID_B = 'aaaa0000-0000-0000-0000-000000000002'
const list = [
  { id: UUID_A, name: '新UUID農薬', legacy_id: 3 },
  { id: UUID_B, name: '別の農薬', legacy_id: 7 },
  { id: 5, name: '旧数値IDのままの農薬' }, // 未移行のローカルマスタ
]

ok('M1 正式ID(uuid)一致で引ける', (masterById(list, UUID_A) || {}).name === '新UUID農薬')
ok('M2 旧数値IDでlegacy_id一致に引ける(記録→移行済みマスタの橋渡し)', (masterById(list, 3) || {}).name === '新UUID農薬')
ok('M3 文字列の旧数値ID("7")でも引ける(String比較統一)', (masterById(list, '7') || {}).name === '別の農薬')
ok('M4 未移行の数値IDマスタも正式ID一致で引ける', (masterById(list, 5) || {}).name === '旧数値IDのままの農薬')
// 正式id最優先: legacy_id=5 の行を追加しても、id=5 の行が勝つ
const list2 = [{ id: UUID_A, name: 'legacyが5', legacy_id: 5 }].concat(list)
ok('M5 正式ID一致がlegacy_id一致より優先される', (masterById(list2, 5) || {}).name === '旧数値IDのままの農薬')
ok('M6 見つからない時はnull(先頭フォールバック禁止)', masterById(list, 'zzz') === null && masterById(list, 999) === null)
ok('M7 null/空文字はnull(誤ヒットしない)', masterById(list, null) === null && masterById(list, '') === null && masterById(null, 1) === null)

const pass = checks.filter(c => c.pass).length
console.log('QAMASTERLOOKUP_START')
checks.forEach(c => console.log((c.pass ? 'PASS' : 'FAIL') + ' ' + c.name + (c.extra ? ' [' + c.extra + ']' : '')))
console.log(pass + '/' + checks.length)
console.log('QAMASTERLOOKUP_END')
process.exit(pass === checks.length ? 0 : 1)
