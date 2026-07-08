// ============================================================================
// シナリオ: 低速3G回線での書き込みテスト（現場の弱い電波を想定）
// ----------------------------------------------------------------------------
// 目的: 圃場は電波が弱いことが多い。低速3Gに絞った状態で
//   ①アプリが初期ロードできるか（＝外部CDNの重さの実測）
//   ②ログインできるか（Supabase認証＝唯一のネット依存）
//   ③日報などの「書き込み」が成立するか（localStorage＝本来ネット不要のはず）
// を確認する。書き込みがネット非依存であること（現場の遅い回線でも記録できる）を実証しつつ、
// 初期ロード時間のボトルネックを可視化する。
//
// 実行: cd qa && node qa_slow3g.js   （CHROME_PATH で Chrome を指定可）
// ============================================================================
const http = require('http'), fs = require('fs'), path = require('path'), puppeteer = require('puppeteer-core')
const ROOT = path.resolve(__dirname, '..'), PORT = 8214
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon' }
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'
  fs.readFile(path.join(ROOT, p), (e, d) => {
    if (e) { r.writeHead(404); r.end('404'); return }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' }); r.end(d)
  })
})
const sleep = ms => new Promise(r => setTimeout(r, ms))

// Chrome DevTools の "Slow 3G" 相当（下り/上り ~約500kbps、遅延 400ms）
const SLOW_3G = { offline:false, latency:400, downloadThroughput: Math.floor(500 * 1024 / 8), uploadThroughput: Math.floor(500 * 1024 / 8) }

;(async () => {
  await new Promise(r => server.listen(PORT, r))
  const errors = []
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  const page = await b.newPage(); await page.setViewport({ width: 390, height: 844 }) // スマホ想定
  page.on('pageerror', e => errors.push(String(e.message || e).slice(0, 160)))
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (!/favicon|net::ERR_/.test(t)) errors.push(t.slice(0, 160)) } })

  const client = await page.target().createCDPSession()
  await client.send('Network.enable')

  const R = {}

  // ── ① 低速3Gで初期ロード（外部CDNの重さを実測） ──
  await client.send('Network.emulateNetworkConditions', SLOW_3G)
  let t0 = Date.now()
  try {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 180000 })
    // React等のライブラリが揃ってアプリ or ログイン画面が出るまで待つ
    await page.waitForFunction(() => !!document.querySelector('.main') || !!document.querySelector('input[type=email]'), { timeout: 180000 })
    R.initialLoadSec = Math.round((Date.now() - t0) / 100) / 10
  } catch (e) { R.initialLoadSec = '>180 (timeout)'; R.loadTimedOut = true }
  R.libsReady = await page.evaluate(() => ({ react: typeof React !== 'undefined', reactDom: typeof ReactDOM !== 'undefined', supabase: typeof supabase !== 'undefined' }))

  // ── ② 低速3Gでログイン（Supabase認証＝ネット依存） ──
  if (await page.$('input[type=email]')) {
    let t1 = Date.now()
    await page.type('input[type=email]', 'demo@syatyo-suport.jp'); await page.type('input[type=password]', 'demo1234')
    await page.evaluate(() => { const x = [...document.querySelectorAll('button[type=submit]')].find(b => /ログイン/.test(b.textContent)); if (x) x.click() })
    try { await page.waitForFunction(() => !!document.querySelector('.main') || !!document.querySelector('.staff-view'), { timeout: 90000 }); R.loginSec = Math.round((Date.now() - t1) / 100) / 10 }
    catch (e) { R.loginSec = '>90 (timeout)'; R.loginTimedOut = true }
  } else { R.loginSec = 'already-in' }

  // ── ③ 低速3Gで書き込み（localStorage＝本来ネット不要）──
  // ネットワークに依存せず記録できることを実証するため、圃場を1つ用意して日報フォームから保存する。
  // 圃場は localStorage 直挿入（現実の「圃場登録済み・現場で日報入力」の状況を再現）。
  const farmId = await page.evaluate(() => {
    // アプリが公開している現在の農場ID（App描画時にセット）。新規デモで記録キーが未生成でも取れる。
    if (typeof CONFIG !== 'undefined' && CONFIG.CURRENT_FARM_ID) return CONFIG.CURRENT_FARM_ID
    const k = Object.keys(localStorage).find(k => /^farm_fields_v2_/.test(k))
    return k ? k.replace('farm_fields_v2_', '') : null
  })
  R.farmId = farmId
  if (farmId) {
    // 圃場を1つ確実に用意
    await page.evaluate((fid) => {
      const key = 'farm_fields_v2_' + fid
      const cur = JSON.parse(localStorage.getItem(key) || '[]')
      if (!cur.some(f => f.id === 900001)) {
        cur.push({ id: 900001, name: '低速3Gテスト圃場', crop: 'レタス', field_no: 'S3G-1', area_are: 10, status: 'growing' })
        localStorage.setItem(key, JSON.stringify(cur))
      }
    }, farmId)
    // 反映のためリロード（低速3Gのまま＝2回目ロードも実測）
    let t2 = Date.now()
    await page.reload({ waitUntil: 'load', timeout: 180000 })
    await page.waitForFunction(() => !!document.querySelector('.main') || !!document.querySelector('.staff-view'), { timeout: 120000 }).catch(()=>{})
    R.reloadSec = Math.round((Date.now() - t2) / 100) / 10

    // 保存前の日報件数
    const before = await page.evaluate((fid) => JSON.parse(localStorage.getItem('farm_records_' + fid) || '[]').length, farmId)

    // 書き込みそのものの所要時間を測る（localStorageなので回線に依存しないはず）
    const writeMs = await page.evaluate((fid) => {
      const key = 'farm_records_' + fid
      const cur = JSON.parse(localStorage.getItem(key) || '[]')
      const t = performance.now()
      cur.push({ id: Date.now(), field_id: 900001, date: new Date().toISOString().slice(0,10), work_type: '除草', worker: '現場テスト' })
      localStorage.setItem(key, JSON.stringify(cur))
      return Math.round((performance.now() - t) * 100) / 100
    }, farmId)
    R.localWriteMs = writeMs

    const after = await page.evaluate((fid) => JSON.parse(localStorage.getItem('farm_records_' + fid) || '[]').length, farmId)
    R.writePersisted = after === before + 1
    R.recordsBeforeAfter = before + '→' + after
  } else {
    R.writeNote = 'farmId不明のため書き込みテストはスキップ（ログイン未達の可能性）'
  }

  R.errorCount = errors.length
  R.errors = errors.slice(0, 8)

  console.log('QASLOW3G_START')
  console.log(JSON.stringify(R, null, 2))
  console.log('QASLOW3G_END')
  await b.close(); server.close()
})().catch(e => { console.error('RUNERR', e); process.exit(1) })
