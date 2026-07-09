// ============================================================================
// シナリオ: 星5ロードマップ P5「現場モード（屋外・手袋対応）」
//  ① 現場モードトグルが表示される（全画面共通・body直下）
//  ② ONで body.field-mode が付き、入力欄の実高さ(min-height)が拡大する
//  ③ localStorage sb_field_mode=1 で永続、リロード後もON維持
//  ④ OFFで body.field-mode が外れ、localStorage=0
//  ⑤ スタッフ画面でもトグルが出る
//  ⑥ 全ページ巡回で崩れ/エラーなし
// 実行: cd qa && node qa_p5_fieldmode.js
// ============================================================================
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core')
const ROOT=path.resolve(__dirname,'..'),PORT=8240,CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'}
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.writeHead(404);r.end('404');return}r.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});r.end(d)})})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const clickText=(page,t)=>page.evaluate(t=>{const v=e=>e.offsetParent!==null;const cs=[...document.querySelectorAll('button,a,[role=button]')].filter(v);let el=cs.find(e=>e.textContent.trim()===t)||cs.find(e=>e.textContent.trim().includes(t)&&e.textContent.trim().length<t.length+18);if(el){el.click();return true}return false},t)
const expand=(page)=>page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith('管理・設定')&&e.offsetParent);if(b)b.click()})
const ensureApp=async(page)=>{ if(!(await page.evaluate(()=>!!document.querySelector('.main')))){
  await page.waitForSelector('input[type=email]',{timeout:30000});await page.type('input[type=email]','demo@syatyo-suport.jp');await page.type('input[type=password]','demo1234')
  await page.evaluate(()=>{const x=[...document.querySelectorAll('button[type=submit]')].find(b=>/ログイン/.test(b.textContent));if(x)x.click()})
  for(let i=0;i<40;i++){if(await page.evaluate(()=>!!document.querySelector('.main')))break;await sleep(500)} } }
const clickToggle=(page)=>page.evaluate(()=>{const b=document.getElementById('sb-field-mode-toggle');if(b){b.click();return true}return false})
const inputMinH=(page)=>page.evaluate(()=>{const i=document.querySelector('.main input, .main .form-input, .main select');if(!i)return 0;return parseFloat(getComputedStyle(i).minHeight)||0})
;(async()=>{
  await new Promise(r=>server.listen(PORT,r))
  const errors=[]
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']})
  const page=await b.newPage(); await page.setViewport({width:1500,height:1000})
  page.on('pageerror',e=>errors.push(String(e.message||e).slice(0,150)))
  page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/favicon|unpkg|jsdelivr|cloudflare|tabler|net::ERR/.test(t))errors.push(t.slice(0,150))}})
  await page.goto(`http://localhost:${PORT}/`,{waitUntil:'networkidle2',timeout:60000})
  await ensureApp(page)
  // クリーン開始
  await page.evaluate(()=>{localStorage.removeItem('sb_field_mode');document.body.classList.remove('field-mode')})
  await page.reload({waitUntil:'networkidle2'}); await sleep(1000); await ensureApp(page)
  const R={}

  // ① トグル存在
  R.hasToggle = await page.evaluate(()=>!!document.getElementById('sb-field-mode-toggle'))
  R.offClass = await page.evaluate(()=>document.body.classList.contains('field-mode'))
  // 日報入力を開いて入力欄の基準高さ
  await clickText(page,'日報入力'); await sleep(700)
  R.minHOff = await inputMinH(page)

  // ② ON
  await clickToggle(page); await sleep(400)
  R.onClass = await page.evaluate(()=>document.body.classList.contains('field-mode'))
  R.minHOn = await inputMinH(page)
  R.ls1 = await page.evaluate(()=>localStorage.getItem('sb_field_mode'))

  // ③ リロードで永続
  await page.reload({waitUntil:'networkidle2'}); await sleep(1000); await ensureApp(page)
  R.persistOn = await page.evaluate(()=>document.body.classList.contains('field-mode'))

  // ④ OFF
  await clickToggle(page); await sleep(400)
  R.offAfter = await page.evaluate(()=>document.body.classList.contains('field-mode'))
  R.ls0 = await page.evaluate(()=>localStorage.getItem('sb_field_mode'))

  // ⑤ スタッフ画面でもトグルが出る（?view=staff）
  await page.goto(`http://localhost:${PORT}/?view=staff`,{waitUntil:'networkidle2',timeout:60000}); await sleep(1200)
  R.staffToggle = await page.evaluate(()=>!!document.getElementById('sb-field-mode-toggle'))
  // 戻る
  await page.goto(`http://localhost:${PORT}/`,{waitUntil:'networkidle2',timeout:60000}); await sleep(1000); await ensureApp(page)

  // ⑥ ONで全ページ巡回
  await clickToggle(page); await sleep(300); await expand(page); await sleep(200)
  const pages=['総合ダッシュボード','日報入力','日報管理','圃場まとめ','GAPチェックリスト','必要書類・文書台帳','出荷記録']
  R.scan=[]
  for(const p of pages){ await clickText(page,p); await sleep(500)
    const bad=await page.evaluate(()=>{const m=document.querySelector('.main');if(!m)return 'no-main';const t=m.innerText;return ['NaN','undefined','[object Object]'].filter(x=>t.includes(x)).join(',')||(t.trim().length<20?'blank':'')})
    R.scan.push({p,bad})
  }

  R.errors=errors
  console.log(JSON.stringify(R,null,2))
  const checks=[
    ['トグルが表示される', R.hasToggle===true],
    ['初期はOFF(classなし)', R.offClass===false],
    ['ONでbody.field-mode付与', R.onClass===true],
    ['ONで入力欄が大きくなる(48px)', R.minHOn>=48 && R.minHOn>R.minHOff],
    ['localStorage=1で保存', R.ls1==='1'],
    ['リロード後もON維持', R.persistOn===true],
    ['OFFでclass外れる', R.offAfter===false],
    ['localStorage=0で保存', R.ls0==='0'],
    ['スタッフ画面でもトグル表示', R.staffToggle===true],
    ['ON巡回で崩れなし', R.scan.every(x=>!x.bad)],
    ['JSエラーなし', errors.length===0],
  ]
  console.log('\n=== 判定 ===')
  let fail=0
  for(const [n,ok] of checks){ console.log((ok?'✅':'❌')+' '+n); if(!ok)fail++ }
  console.log(`\n${checks.length-fail}/${checks.length} passed, ${fail} failed`)
  await b.close(); server.close(); process.exit(fail?1:0)
})().catch(e=>{console.error(e);process.exit(2)})
