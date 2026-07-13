// qa_stock_validation.js — 在庫入力の検証ヘルパー isValidStockAmount の関数単体QA（Codexレビュー20対応）
// 空文字を有効な0として通す ||0 事故を防ぐ層。app層(onUpdateStock/onUpdateFertilizerStock)と
// UI(農薬/肥料棚卸し)が同じ判定を共用するため、この1関数を固めれば両経路が守られる。
// 実行: cd qa && node qa_stock_validation.js
const fs = require('fs')
const path = require('path')
const checks = []
const ok = (name, cond, extra) => checks.push({ name, pass: !!cond, extra: extra == null ? '' : String(extra) })

// config.js から isValidStockAmount を切り出して評価(ブラウザ非依存の純関数)
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
const isValidStockAmount = new Function('return ' + extract(cfgSrc, 'function isValidStockAmount(v) {'))()

// ── 拒否すべき入力(在庫を書き換えてはいけない) ──
ok('V1 空文字は拒否(Number("")=0で在庫全消しになる事故の本丸)', isValidStockAmount('') === false)
ok('V2 null/undefinedは拒否', isValidStockAmount(null) === false && isValidStockAmount(undefined) === false)
ok('V3 空白のみの文字列は拒否(Number(" ")=0)', isValidStockAmount('   ') === false, JSON.stringify(isValidStockAmount('   ')))
ok('V4 数値でない文字列(NaN)は拒否', isValidStockAmount('abc') === false)
ok('V5 負数は拒否(棚卸し値としてありえない)', isValidStockAmount('-1') === false && isValidStockAmount(-0.5) === false)
ok('V6 Infinity/-Infinityは拒否', isValidStockAmount(Infinity) === false && isValidStockAmount(-Infinity) === false)
ok('V7 NaN(数値型)は拒否', isValidStockAmount(NaN) === false)
ok('V8 boolean型は拒否(Number(true)=1で通ってしまう化けを型で防ぐ)', isValidStockAmount(true) === false && isValidStockAmount(false) === false)
ok('V9 配列/オブジェクトは拒否(Number([])=0・Number([5])=5の化けを型で防ぐ)',
  isValidStockAmount([]) === false && isValidStockAmount([5]) === false && isValidStockAmount({}) === false)

// ── 受理すべき入力(在庫として確定してよい) ──
ok('A1 0は有効(在庫を0にする棚卸しは正当。空文字とは区別)', isValidStockAmount('0') === true && isValidStockAmount(0) === true)
ok('A2 正の整数は有効', isValidStockAmount('50') === true && isValidStockAmount(50) === true)
ok('A3 小数は有効', isValidStockAmount('17.5') === true && isValidStockAmount(0.01) === true)
ok('A4 前後の空白つき数字は有効(Number("  50 ")=50)', isValidStockAmount(' 50 ') === true, JSON.stringify(isValidStockAmount(' 50 ')))

// ── 「空文字と0を区別する」のが本改修の核心(V1×A1) ──
ok('C1 空文字とゼロを別扱いにできている(||0廃止の主眼)',
  isValidStockAmount('') === false && isValidStockAmount('0') === true)

const pass = checks.filter(c => c.pass).length
console.log('QASTOCKVAL_START')
checks.forEach(c => console.log((c.pass ? 'PASS' : 'FAIL') + ' ' + c.name + (c.extra ? ' [' + c.extra + ']' : '')))
console.log(pass + '/' + checks.length)
console.log('QASTOCKVAL_END')
process.exit(pass === checks.length ? 0 : 1)
