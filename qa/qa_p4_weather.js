// ============================================================================
// シナリオ: 星5ロードマップ P4「天気の自動候補」
//  ① 記録が無い時は既定「晴」・候補ラベルは出ない
//  ② 直近の記録の天気(例:雨)が日報入力の初期天気になる＋「候補：前回の天気」ラベル
//  ③ 日付を、別の天気(曇)の記録がある日に変えると天気が追従する
//  ④ 手動で天気を選んだ後は、日付を変えても追従しない（勝手に上書きしない）
//  ⑤ JSエラーなし
// 実行: cd qa && node qa_p4_weather.js
// ============================================================================
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core')
const ROOT=path.resolve(__dirname,'..'),PORT=8239,CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'}
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.writeHead(404);r.end('404');return}r.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});r.end(d)})})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const clickText=(page,t)=>page.evaluate(t=>{const v=e=>e.offsetParent!==null;const cs=[...document.querySelectorAll('button,a,[role=button]')].filter(v);let el=cs.find(e=>e.textContent.trim()===t)||cs.find(e=>e.textContent.trim().includes(t)&&e.textContent.trim().length<t.length+18);if(el){el.click();return true}return false},t)
const ensureApp=async(page)=>{ if(!(await page.evaluate(()=>!!document.querySelector('.main')))){
  await page.waitForSelector('input[type=email]',{timeout:30000});await page.type('input[type=email]','demo@syatyo-suport.jp');await page.type('input[type=password]','demo1234')
  await page.evaluate(()=>{const x=[...document.querySelectorAll('button[type=submit]')].find(b=>/ログイン/.test(b.textContent));if(x)x.click()})
  for(let i=0;i<40;i++){if(await page.evaluate(()=>!!document.querySelector('.main')))break;await sleep(500)} } }
// 現在選択されている天気ボタンのラベル(晴/曇/雨/強風)を返す
const selectedWeather=(page)=>page.evaluate(()=>{
  const btns=[...document.querySelectorAll('button')].filter(b=>/^[☀🌤🌧💨]/.test(b.textContent.trim()))
  const sel=btns.find(b=>{const bg=b.style.background||getComputedStyle(b).backgroundColor;return /ECFDF5|236, 253, 245/.test(bg)})
  return sel?sel.textContent.replace(/[^晴曇雨強風]/g,''):null
})
const setDate=(page,val)=>page.evaluate((val)=>{const inp=[...document.querySelectorAll('input[type=date]')].find(i=>i.offsetParent);if(inp){const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp,val);inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}))}},val)
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
  const today=new Date().toISOString().slice(0,10)
  // 圃場1件・記録0でスタート
  await page.evaluate((fid)=>{const set=(k,v)=>localStorage.setItem(k+'_'+fid,JSON.stringify(v));set('farm_fields_v2',[{id:1,name:'第1圃場',field_no:'1',crop:'レタス',area_are:10,color:'#0D9972',row_count:6,crop_category:'leaf_veg'}]);set('farm_records',[])}, farmId)
  await page.reload({waitUntil:'networkidle2'}); await sleep(1000)
  const R={}

  // ① 記録0: 既定は晴・候補ラベル無し
  await clickText(page,'日報入力'); await sleep(700)
  R.emptyWeather = await selectedWeather(page)
  R.emptyNoBadge = await page.evaluate(()=>!/候補：前回の天気/.test(document.querySelector('.main').innerText))

  // 記録投入: today=雨、昨日(=D2)=曇
  const d2='2026-06-02'
  await page.evaluate((fid,today,d2)=>{localStorage.setItem('farm_records_'+fid, JSON.stringify([
    {id:101,field_id:1,date:d2,work_type:'除草',weather:'曇',worker:'今福'},
    {id:102,field_id:1,date:today,work_type:'除草',weather:'雨',worker:'今福'},
  ]))}, farmId, today, d2)
  await page.reload({waitUntil:'networkidle2'}); await sleep(1000)

  // ② today記録の天気(雨)が初期値＋候補ラベル
  await clickText(page,'日報入力'); await sleep(700)
  R.initWeather = await selectedWeather(page)
  R.hasBadge = await page.evaluate(()=>/候補：前回の天気/.test(document.querySelector('.main').innerText))

  // ③ 日付をd2(曇の記録がある日)に変更 → 天気が曇に追従
  await setDate(page, d2); await sleep(500)
  R.afterDateChange = await selectedWeather(page)

  // ④ 手動で「強風」を選択 → 日付をtodayに戻しても追従しない（強風のまま）
  await clickText(page,'強風'); await sleep(300)
  await setDate(page, today); await sleep(500)
  R.afterManual = await selectedWeather(page)

  R.errors=errors
  console.log(JSON.stringify(R,null,2))
  const checks=[
    ['記録0では既定=晴', R.emptyWeather==='晴'],
    ['記録0では候補ラベル無し', R.emptyNoBadge===true],
    ['初期天気=当日記録の雨', R.initWeather==='雨'],
    ['候補ラベルが出る', R.hasBadge===true],
    ['日付変更で曇に追従', R.afterDateChange==='曇'],
    ['手動選択後は追従しない(強風維持)', R.afterManual==='強風'],
    ['JSエラーなし', errors.length===0],
  ]
  console.log('\n=== 判定 ===')
  let fail=0
  for(const [n,ok] of checks){ console.log((ok?'✅':'❌')+' '+n); if(!ok)fail++ }
  console.log(`\n${checks.length-fail}/${checks.length} passed, ${fail} failed`)
  await b.close(); server.close(); process.exit(fail?1:0)
})().catch(e=>{console.error(e);process.exit(2)})
