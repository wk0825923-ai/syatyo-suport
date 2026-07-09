// ============================================================================
// シナリオ: 星5ロードマップ P6-a「希釈計算ヘルパー」
//  ① 農薬散布フォームで散布液量+希釈倍率を入れると「必要な原液量：約 X mL」が出る
//  ② 計算が正しい（散布液量L×1000÷希釈倍率＝mL）: 500L×1000倍→500mL
//  ③ 散布液量を変えると再計算（250L×1000→250mL）
//  ④ 散布液量が空/0のときは表示されない（誤情報を出さない）
//  ⑤ JSエラーなし
// 実行: cd qa && node qa_p6_dilution.js
// ============================================================================
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core')
const ROOT=path.resolve(__dirname,'..'),PORT=8241,CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'}
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.writeHead(404);r.end('404');return}r.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});r.end(d)})})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const clickText=(page,t)=>page.evaluate(t=>{const v=e=>e.offsetParent!==null;const cs=[...document.querySelectorAll('button,a,[role=button]')].filter(v);let el=cs.find(e=>e.textContent.trim()===t)||cs.find(e=>e.textContent.trim().includes(t)&&e.textContent.trim().length<t.length+18);if(el){el.click();return true}return false},t)
const ensureApp=async(page)=>{ if(!(await page.evaluate(()=>!!document.querySelector('.main')))){
  await page.waitForSelector('input[type=email]',{timeout:30000});await page.type('input[type=email]','demo@syatyo-suport.jp');await page.type('input[type=password]','demo1234')
  await page.evaluate(()=>{const x=[...document.querySelectorAll('button[type=submit]')].find(b=>/ログイン/.test(b.textContent));if(x)x.click()})
  for(let i=0;i<40;i++){if(await page.evaluate(()=>!!document.querySelector('.main')))break;await sleep(500)} } }
const setSprayVol=(page,v)=>page.evaluate((v)=>{
  const inp=[...document.querySelectorAll('input[type=number]')].find(i=>{const lab=i.closest('div')&&i.closest('div').parentElement;return /散布液量/.test((i.closest('div')?i.closest('div').parentElement?.textContent:'')||'')})||
    [...document.querySelectorAll('input')].find(i=>i.placeholder==='例: 500')
  if(inp){const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp,String(v));inp.dispatchEvent(new Event('input',{bubbles:true}))}
},v)
const dilutionText=(page)=>page.evaluate(()=>{const m=document.querySelector('.main').innerText.match(/必要な原液量：約\s*([\d.]+)\s*mL/);return m?parseFloat(m[1]):null})
;(async()=>{
  await new Promise(r=>server.listen(PORT,r))
  const errors=[]
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']})
  const page=await b.newPage(); await page.setViewport({width:1500,height:1000})
  page.on('pageerror',e=>errors.push(String(e.message||e).slice(0,150)))
  page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/favicon|unpkg|jsdelivr|cloudflare|tabler|net::ERR/.test(t))errors.push(t.slice(0,150))}})
  await page.goto(`http://localhost:${PORT}/`,{waitUntil:'networkidle2',timeout:60000})
  await ensureApp(page)
  const farmId=await page.evaluate(()=>(typeof CONFIG!=='undefined'&&CONFIG.CURRENT_FARM_ID)?CONFIG.CURRENT_FARM_ID:null)
  // アプリの todayYmd()(ローカル基準)に合わせて10日前を算出（UTC/ローカル差でズレないように）
  const past=await page.evaluate(()=>{const t=(typeof todayYmd==='function')?todayYmd():new Date().toISOString().slice(0,10);const d=new Date(t+'T00:00:00');d.setDate(d.getDate()-10);const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())})
  await page.evaluate((fid,past)=>{const set=(k,v)=>localStorage.setItem(k+'_'+fid,JSON.stringify(v))
    set('farm_fields_v2',[{id:1,name:'第1圃場',field_no:'1',crop:'レタス',area_are:10,color:'#0D9972',row_count:6,crop_category:'leaf_veg'}])
    set('farm_lots',{1:[{id:'L1',field_id:1,row_range:'1-3',variety:'シスコ',status:'growing',seed_date:'2026-05-01'}]})
    set('farm_pesticides',[{id:1,name:'アグロA',reg_no:'第123号',dilution:1000,preharvest_days:7,max_times:3}])
    set('farm_records',[])
    // P6 防除リマインド用: この圃場でアグロAを10日前に散布済み
    set('farm_lot_spray_records',[{id:9001,field_id:1,date:past,row_range:'1-3',spray_volume_L:100,pesticides:[{pesticide_id:1,dilution:1000}],weather:'晴'}])
  }, farmId, past)
  await page.reload({waitUntil:'networkidle2'}); await sleep(1200)
  const R={}

  // 農薬散布の畝フォームへ
  await clickText(page,'日報入力'); await sleep(800)
  await page.evaluate(()=>{const grid=[...document.querySelectorAll('div')].find(d=>d.style&&d.style.maxHeight==='240px');if(grid){const chip=[...grid.children].find(c=>/第1圃場/.test(c.textContent));if(chip)chip.click()}})
  await sleep(300); await clickText(page,'次へ'); await sleep(500)
  await clickText(page,'農薬散布'); await sleep(400); await clickText(page,'次へ'); await sleep(800)

  // ④ 散布液量空 → 表示なし
  R.emptyHidden = await page.evaluate(()=>!/必要な原液量/.test(document.querySelector('.main').innerText))
  // ② 500L → 500mL（希釈倍率は農薬マスタ既定1000）
  await setSprayVol(page,500); await sleep(500)
  R.at500 = await dilutionText(page)
  R.hasLabel = await page.evaluate(()=>/必要な原液量/.test(document.querySelector('.main').innerText))
  // ③ 250L → 250mL
  await setSprayVol(page,250); await sleep(500)
  R.at250 = await dilutionText(page)
  // ④' 0 → 非表示
  await setSprayVol(page,0); await sleep(500)
  R.zeroHidden = await page.evaluate(()=>!/必要な原液量/.test(document.querySelector('.main').innerText))

  // ── P6 防除リマインド ──
  R.remind = await page.evaluate(()=>{
    const t=document.querySelector('.main').innerText
    const m=t.match(/前回この薬を撒いてから\s*(\d+)日/)
    return { shown:/前回この薬を撒いてから/.test(t), days:m?parseInt(m[1]):null }
  })

  R.errors=errors
  console.log(JSON.stringify(R,null,2))
  const checks=[
    ['散布液量空では非表示', R.emptyHidden===true],
    ['ラベルが出る', R.hasLabel===true],
    ['500L×1000倍=500mL', R.at500===500],
    ['250L×1000倍=250mL', R.at250===250],
    ['散布液量0では非表示', R.zeroHidden===true],
    ['防除リマインドが表示される', R.remind.shown===true],
    ['前回散布から10日と正しく計算', R.remind.days===10],
    ['JSエラーなし', errors.length===0],
  ]
  console.log('\n=== 判定 ===')
  let fail=0
  for(const [n,ok] of checks){ console.log((ok?'✅':'❌')+' '+n); if(!ok)fail++ }
  console.log(`\n${checks.length-fail}/${checks.length} passed, ${fail} failed`)
  await b.close(); server.close(); process.exit(fail?1:0)
})().catch(e=>{console.error(e);process.exit(2)})
