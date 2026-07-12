// qa_uuid_config.js — config.jsの安全機能・帳票がUUID環境で機能するか（Codexレビュー6の失敗再現テスト）
// 対象: ①農薬使用回数の上限チェック(Critical) ②作付期間重複 ③収穫前日数アラート ④帳票の圃場/農薬名解決
// 実行: cd qa && node qa_uuid_config.js
const fs = require('fs')
const path = require('path')
const checks = []
const ok = (name, cond, extra) => checks.push({ name, pass: !!cond, extra: extra == null ? '' : String(extra) })

// ── data.js から masterById、config.js から対象関数を切り出す ──
const dataSrc = fs.readFileSync(path.resolve(__dirname, '..', 'js', 'data.js'), 'utf8')
const cfgSrc = fs.readFileSync(path.resolve(__dirname, '..', 'js', 'config.js'), 'utf8')
function extract(src, sig) {
  const start = src.indexOf(sig)
  if (start < 0) throw new Error('not found: ' + sig)
  let depth = 0, end = -1
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break } }
  }
  return src.slice(start, end)
}
const masterById = new Function('return ' + extract(dataSrc, 'function masterById(list, id) {'))()
const mkCfgFn = (sig, deps) => new Function(...Object.keys(deps), 'return ' + extract(cfgSrc, sig))(...Object.values(deps))

const CONFIG = { CURRENT_YEAR: 2026 }
const countPesticideUse = mkCfgFn('function countPesticideUse(records, fieldId, pesticideId,', {})
const isPesticideOverLimitSrc = extract(cfgSrc, 'function isPesticideOverLimit(records, fieldId, pesticide,')
const isPesticideOverLimit = new Function('countPesticideUse', 'return ' + isPesticideOverLimitSrc)(countPesticideUse)
const hasCropOverlap = mkCfgFn('function hasCropOverlap(plans, fieldId, startMonth, endMonth) {', {})
const calcHarvestRisk = mkCfgFn('function calcHarvestRisk(records, plans, pesticides, fields) {', { CONFIG, masterById })

const FLD = 'eeee1111-2222-3333-4444-555555550001' // UUID圃場
const PU = 'aaaa1111-2222-3333-4444-555555550001'  // UUID農薬(legacy_id=1)
const pesticide = { id: PU, name: 'UUID農薬', max_times: 3, preharvest_days: 7, legacy_id: 1 }

// ── T1(Critical): 使用回数の上限チェックがUUID圃場×UUID農薬で数えられる ──
{
  const records = [
    { id: 1, field_id: FLD, work_type: '農薬散布', pesticide_id: PU, date: '2026-06-01' },
    { id: 2, field_id: FLD, work_type: '農薬散布', pesticide_id: PU, date: '2026-06-10' },
  ]
  const lotSpray = [{ id: 3, field_id: FLD, date: '2026-06-20', pesticides: [{ pesticide_id: PU, dilution: 1000 }] }]
  const n = countPesticideUse(records, FLD, PU, lotSpray, pesticide)
  ok('T1 使用回数: UUID圃場×UUID農薬で日報2+ロット1=3件を数える(NaN化しない)', n === 3, 'count=' + n)
  ok('T1b 上限判定: 3回使用でmax_times=3の上限に達したと判定される', isPesticideOverLimit(records, FLD, pesticide, lotSpray) === true)
}

// ── T1c: 旧数値ID時代の散布記録もlegacy_idで合算される(UUID化で過去の回数を取りこぼさない) ──
{
  const records = [
    { id: 1, field_id: FLD, work_type: '農薬散布', pesticide_id: 1, date: '2026-05-01' },  // 旧数値ID時代の記録
    { id: 2, field_id: FLD, work_type: '農薬散布', pesticide_id: PU, date: '2026-06-01' }, // UUID化後の記録
  ]
  const n = countPesticideUse(records, FLD, PU, [], pesticide)
  ok('T1c 旧数値ID記録もlegacy_idで合算(過去の散布回数を取りこぼさない)', n === 2, 'count=' + n)
}

// ── T2(Medium): 作付期間の重複チェックがUUID圃場で効く ──
{
  const plans = [{ id: 1, field_id: FLD, crop: 'レタス', start_month: 4, end_month: 6 }]
  ok('T2 作付重複: UUID圃場で期間かぶりを検知する', hasCropOverlap(plans, FLD, 5, 8) === true)
  ok('T2b 作付重複: かぶらない期間はfalse', hasCropOverlap(plans, FLD, 7, 9) === false)
}

// ── T3(Medium): 収穫前日数アラートがUUID圃場×UUID農薬×旧数値ID記録で機能する ──
{
  const today = new Date()
  const m = today.getMonth() + 1 // 収穫予定=今月1日→daysToHarvest>=0になるよう来月に
  const plans = [{ id: 1, field_id: FLD, crop: 'レタス', start_month: m, end_month: Math.min(m + 1, 12) }]
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const records = [{ id: 9, field_id: FLD, work_type: '農薬散布', pesticide_id: 1, date: ymd(yesterday) }] // 旧数値ID記録
  const fields = [{ id: FLD, name: '第1圃場', legacy_id: 1 }]
  // 残留期間60日の剤=昨日散布なら残り59日>収穫までの日数(来月1日=最大31日)→必ず警告になる設計
  const longPest = { id: PU, name: 'UUID農薬', max_times: 3, preharvest_days: 60, legacy_id: 1 }
  const alerts = calcHarvestRisk(records, plans, [longPest], fields)
  ok('T3 収穫前アラート: 旧数値ID記録×UUIDマスタでも圃場名・農薬名を解決して警告する',
    alerts.length >= 1 && alerts[0].fieldName === '第1圃場' && alerts[0].pesticideName === 'UUID農薬',
    JSON.stringify(alerts[0] || null))
}

// ── T4(Medium): 帳票の圃場/農薬名解決(masterById化した findField/findPest 相当) ──
{
  const fields = [{ id: FLD, name: '第1圃場', emaff_no: '1234567890123', legacy_id: 1 }]
  const pesticides = [pesticide]
  const f = masterById(fields, 1)   // 旧数値IDの記録から
  const p = masterById(pesticides, 1)
  ok('T4 帳票の名前解決: 旧数値ID参照でもUUIDマスタから圃場名・農薬名が引ける(—にならない)',
    !!(f && f.name === '第1圃場' && p && p.name === 'UUID農薬'), JSON.stringify({ f: f && f.name, p: p && p.name }))
}

const pass = checks.filter(c => c.pass).length
console.log('QAUUIDCFG_START')
checks.forEach(c => console.log((c.pass ? 'PASS' : 'FAIL') + ' ' + c.name + (c.extra ? ' [' + c.extra + ']' : '')))
console.log(pass + '/' + checks.length)
console.log('QAUUIDCFG_END')
process.exit(pass === checks.length ? 0 : 1)
