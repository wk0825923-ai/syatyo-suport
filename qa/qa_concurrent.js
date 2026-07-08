// ============================================================================
// 同時利用QA: 管理者とスタッフが同じ農場を同時に使うと保存が消えないか(last-write-win)。
// 手法: あるタブ(admin)がアプリを開いた後、別タブが保存した状況をlocalStorageへ直接注入して
// 再現し、adminが実UIで日報を保存 → adminのin-memory stateで上書きされ、注入した記録が
// 消えるか(=クロバー)を検出する。修正後は storage同期 で消えないことを確認する。
// 実行: cd qa && node qa_concurrent.js
// ============================================================================
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core')
const ROOT=path.resolve(__dirname,'..'),PORT=8236,CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'}
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.writeHead(404);r.end('404');return}r.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});r.end(d)})})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const appReady=(page)=>page.evaluate(()=>!!document.querySelector('.main')||!!document.querySelector('.staff-view'))
const login=async(page)=>{ await sleep(500); const e=await page.$('input[type=email]'); if(e){ await page.type('input[type=email]','demo@syatyo-suport.jp'); await page.type('input[type=password]','demo1234'); await page.evaluate(()=>{const x=[...document.querySelectorAll('button[type=submit]')].find(b=>/ログイン/.test(b.textContent));if(x)x.click()}) } for(let i=0;i<50;i++){ if(await appReady(page))break; await sleep(500) } }
const clickInc=(page,t)=>page.evaluate(t=>{const c=[...document.querySelectorAll('button,a,[role=button]')].filter(e=>e.offsetParent);const el=c.find(e=>e.textContent.trim()===t)||c.find(e=>e.textContent.trim().includes(t)&&e.textContent.trim().length<t.length+16);if(el){el.click();return true}return false},t)
// 管理者UIで日報を1件保存(vw6実績フロー)
const adminSaveDaily=async(page)=>{
  await clickInc(page,'日報入力'); await sleep(600)
  await clickInc(page,'第1圃場'); await sleep(300)
  await clickInc(page,'次へ'); await sleep(400)
  await clickInc(page,'除草'); await sleep(300)
  await clickInc(page,'次へ'); await sleep(400)
  await clickInc(page,'確認'); await sleep(400)
  ;(await clickInc(page,'記録する'))||(await clickInc(page,'保存')); await sleep(800)
}
;(async()=>{
  await new Promise(r=>server.listen(PORT,r))
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']})
  const R={}
  const admin=await b.newPage(); await admin.goto(`http://localhost:${PORT}/`,{waitUntil:'domcontentloaded',timeout:60000}); await login(admin)
  const fid=await admin.evaluate(()=>CONFIG.CURRENT_FARM_ID)
  const recs=async()=>admin.evaluate((fid)=>JSON.parse(localStorage.getItem('farm_records_'+fid)||'[]'),fid)
  // 初期化: 圃場1つ・記録空。adminのReact stateも空に(リロード)
  await admin.evaluate((fid)=>{ Object.keys(localStorage).filter(k=>k.startsWith('farm_')).forEach(k=>localStorage.removeItem(k)); localStorage.setItem('farm_fields_v2_'+fid,JSON.stringify([{id:1,name:'第1圃場',crop:'レタス',area_are:10,status:'growing'}])) },fid)
  await admin.reload({waitUntil:'domcontentloaded'}); await sleep(1200)

  // ① adminが開いている間に、別タブ(スタッフ)が保存した状況を注入(farm_recordsに1件)
  await admin.evaluate((fid)=>{ localStorage.setItem('farm_records_'+fid,JSON.stringify([{id:99001,field_id:1,date:'2026-06-01',work_type:'除草',worker:'スタッフ保存分'}])) },fid)
  // ② adminが実UIで日報を保存 → クロバーが起きればスタッフ保存分が消える
  await adminSaveDaily(admin); await sleep(500)
  let after=await recs()
  R.clobberTest={ count:after.length, hasStaffRecord: after.some(r=>r.worker==='スタッフ保存分'), hasAdminRecord: after.some(r=>r.work_type==='除草'&&r.worker!=='スタッフ保存分'),
    verdict: after.some(r=>r.worker==='スタッフ保存分') ? 'OK(消えない)' : 'CLOBBER(スタッフ保存が消えた)' }

  console.log('QACONC_START');console.log(JSON.stringify(R,null,2));console.log('QACONC_END')
  await b.close();server.close()
})().catch(e=>{console.error('RUNERR',e);process.exit(1)})
