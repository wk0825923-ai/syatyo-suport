// ============================================================================
// シナリオ: 総合ダッシュボードの通知ベル＋アイコンTabler化
//  ① ヘッダー右上に通知ベル(ti-bell)＋件数バッジが出る
//  ② 本文に「最近の作業記録」の常時パネルは無い（ベルに移設）
//  ③ ベルをクリックでポップアップが開き、記録一覧が出る
//  ④ 記録をクリックで詳細モーダルが開く
//  ⑤ 外側クリックでポップアップが閉じる
//  ⑥ 農薬リスクなしカードが 🌱→Tabler(ti-shield-check)、記録アイコンも絵文字でない
//  ⑦ JSエラーなし
// 実行: cd qa && node qa_recent_bell.js
// ============================================================================
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core')
const ROOT=path.resolve(__dirname,'..'),PORT=8243,CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'}
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.writeHead(404);r.end('404');return}r.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});r.end(d)})})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const ensureApp=async(page)=>{ if(!(await page.evaluate(()=>!!document.querySelector('.main')))){
  await page.waitForSelector('input[type=email]',{timeout:30000});await page.type('input[type=email]','demo@syatyo-suport.jp');await page.type('input[type=password]','demo1234')
  await page.evaluate(()=>{const x=[...document.querySelectorAll('button[type=submit]')].find(b=>/ログイン/.test(b.textContent));if(x)x.click()})
  for(let i=0;i<40;i++){if(await page.evaluate(()=>!!document.querySelector('.main')))break;await sleep(500)} } }
;(async()=>{
  await new Promise(r=>server.listen(PORT,r))
  const errors=[]
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']})
  const page=await b.newPage(); await page.setViewport({width:1500,height:1000})
  page.on('pageerror',e=>errors.push(String(e.message||e).slice(0,150)))
  page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/favicon|unpkg|jsdelivr|cloudflare|tabler|net::ERR/.test(t))errors.push(t.slice(0,150))}})
  page.on('dialog',async d=>{try{await d.accept()}catch(e){}})
  await page.goto(`http://localhost:${PORT}/`,{waitUntil:'networkidle2',timeout:60000})
  await ensureApp(page)
  await page.goto(`http://localhost:${PORT}/?demo`,{waitUntil:'networkidle2',timeout:60000}); await sleep(4000)
  await ensureApp(page)
  const R={}

  // ① ベル＋バッジ
  R.bell = await page.evaluate(()=>{
    const bell=[...document.querySelectorAll('button')].find(b=>b.querySelector('i.ti-bell')&&b.offsetParent)
    if(!bell)return {has:false}
    const badge=bell.querySelector('span')
    return { has:true, badge: badge?badge.textContent.trim():null }
  })
  // ② 本文に常時パネル無し（ベル閉状態）
  R.noInline = await page.evaluate(()=>{const main=document.querySelector('.main');return !/最近の作業記録/.test(main.innerText)})
  // ⑥ アイコンTabler化: 🌱/📝 が本文に無い（少なくとも農薬リスク/記録まわり）＋ ti-shield-check あり
  R.icons = await page.evaluate(()=>{const t=document.querySelector('.main').innerText;return{ noPlantEmoji:!/🌱 今週|🌱\s*今週/.test(t), hasShield:!!document.querySelector('.main i.ti-shield-check') }})

  // ③ ベルクリック → ポップアップに記録
  await page.evaluate(()=>{const bell=[...document.querySelectorAll('button')].find(b=>b.querySelector('i.ti-bell')&&b.offsetParent);if(bell)bell.click()})
  await sleep(500)
  R.popup = await page.evaluate(()=>{const t=document.body.innerText;return{ opened:/最近の作業記録/.test(t), hasRecords:/圃場/.test(t)&&/最近の作業記録/.test(t) }})

  // ④ ポップアップ内の記録をクリック → 詳細モーダル
  await page.evaluate(()=>{
    const pop=[...document.querySelectorAll('div')].find(d=>d.style&&d.style.position==='absolute'&&/最近の作業記録/.test(d.textContent))
    if(pop){const row=[...pop.querySelectorAll('div')].find(d=>/第\d+圃場|—/.test(d.textContent)&&d.onclick!==undefined&&d.textContent.length<60)|| [...pop.querySelectorAll('*')].find(e=>/施肥|農薬散布|除草|定植|収穫|点検/.test(e.textContent)&&e.offsetParent); if(row)row.click()}
  })
  await sleep(500)
  R.detail = await page.evaluate(()=>/作業記録の詳細|記録の詳細|作業内容|削除|編集/.test(document.body.innerText) && !!document.querySelector('.main'))

  // 詳細を閉じてベル再オープン→外側クリックで閉じる
  await page.keyboard.press('Escape'); await sleep(200)
  await page.evaluate(()=>{const bell=[...document.querySelectorAll('button')].find(b=>b.querySelector('i.ti-bell')&&b.offsetParent);if(bell)bell.click()})
  await sleep(300)
  await page.mouse.click(700,500); await sleep(300)  // 外側クリック
  R.closed = await page.evaluate(()=>{const pop=[...document.querySelectorAll('div')].find(d=>d.style&&d.style.position==='absolute'&&/最近の作業記録/.test(d.textContent));return !pop})

  R.errors=errors
  console.log(JSON.stringify(R,null,2))
  const checks=[
    ['右上に通知ベルあり', R.bell.has===true],
    ['件数バッジあり', R.bell.badge && /\d/.test(R.bell.badge)],
    ['本文に常時パネル無し(ベルに移設)', R.noInline===true],
    ['農薬リスクなしがti-shield-check', R.icons.hasShield===true],
    ['ベルクリックでポップアップに記録', R.popup.opened===true],
    ['記録クリックで詳細モーダル', R.detail===true],
    ['外側クリックで閉じる', R.closed===true],
    ['JSエラーなし', errors.length===0],
  ]
  console.log('\n=== 判定 ===')
  let fail=0
  for(const [n,ok] of checks){ console.log((ok?'✅':'❌')+' '+n); if(!ok)fail++ }
  console.log(`\n${checks.length-fail}/${checks.length} passed, ${fail} failed`)
  await b.close(); server.close(); process.exit(fail?1:0)
})().catch(e=>{console.error(e);process.exit(2)})
