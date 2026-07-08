// ============================================================================
// 同時利用QA(修正検証): 実2タブ。別タブ(スタッフ)が保存→storageイベントで管理者タブが同期→
// 管理者が保存しても両方残る(クロバーしない)ことを確認。3タブ(スタッフ2+管理者)も。
// 実行: cd qa && node qa_concurrent2.js
// ============================================================================
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core')
const ROOT=path.resolve(__dirname,'..'),PORT=8237,CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'}
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.writeHead(404);r.end('404');return}r.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});r.end(d)})})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const appReady=(page)=>page.evaluate(()=>!!document.querySelector('.main')||!!document.querySelector('.staff-view'))
const login=async(page)=>{ await sleep(500); const e=await page.$('input[type=email]'); if(e){ await page.type('input[type=email]','demo@syatyo-suport.jp'); await page.type('input[type=password]','demo1234'); await page.evaluate(()=>{const x=[...document.querySelectorAll('button[type=submit]')].find(b=>/ログイン/.test(b.textContent));if(x)x.click()}) } for(let i=0;i<50;i++){ if(await appReady(page))break; await sleep(500) } }
const clickInc=(page,t)=>page.evaluate(t=>{const c=[...document.querySelectorAll('button,a,[role=button]')].filter(e=>e.offsetParent);const el=c.find(e=>e.textContent.trim()===t)||c.find(e=>e.textContent.trim().includes(t)&&e.textContent.trim().length<t.length+16);if(el){el.click();return true}return false},t)
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
  await admin.evaluate((fid)=>{ Object.keys(localStorage).filter(k=>k.startsWith('farm_')).forEach(k=>localStorage.removeItem(k)); localStorage.setItem('farm_fields_v2_'+fid,JSON.stringify([{id:1,name:'第1圃場',crop:'レタス',area_are:10,status:'growing'}])) },fid)
  await admin.reload({waitUntil:'domcontentloaded'}); await sleep(1200)

  // 別タブ(スタッフ)を開く。スタッフがlocalStorageに保存→adminへstorageイベント発火→admin同期
  const staff=await b.newPage(); await staff.goto(`http://localhost:${PORT}/?view=staff`,{waitUntil:'domcontentloaded'}); await login(staff); await sleep(800)
  await staff.evaluate((fid)=>{ localStorage.setItem('farm_records_'+fid,JSON.stringify([{id:99001,field_id:1,date:'2026-06-01',work_type:'除草',worker:'スタッフ保存分'}])) },fid)
  await sleep(800) // storageイベント伝播＋admin state同期
  // adminが実UIで保存 → 同期済みなら prev にスタッフ分を含み、両方残る
  await adminSaveDaily(admin); await sleep(500)
  const a2=await recs()
  R.twoTab={ count:a2.length, hasStaff:a2.some(r=>r.worker==='スタッフ保存分'), hasAdmin:a2.some(r=>r.work_type==='除草'&&r.worker!=='スタッフ保存分'),
    verdict: a2.some(r=>r.worker==='スタッフ保存分') ? 'OK(両方残る)' : 'CLOBBER' }

  // 3タブ: スタッフ2名が別々に追加→adminが保存。全部残るか。リセット
  await admin.evaluate((fid)=>localStorage.setItem('farm_records_'+fid,JSON.stringify([])),fid)
  await admin.reload({waitUntil:'domcontentloaded'}); await sleep(1000)
  const s2=await b.newPage(); await s2.goto(`http://localhost:${PORT}/?view=staff`,{waitUntil:'domcontentloaded'}); await login(s2); await sleep(600)
  // スタッフ1が追加
  await staff.evaluate((fid)=>{ const a=JSON.parse(localStorage.getItem('farm_records_'+fid)||'[]'); a.push({id:99011,field_id:1,date:'2026-06-02',work_type:'除草',worker:'S1'}); localStorage.setItem('farm_records_'+fid,JSON.stringify(a)) },fid); await sleep(500)
  // スタッフ2が追加(自分の同期済みstateに追加想定だが直接LSに積む=別タブ書込)
  await s2.evaluate((fid)=>{ const a=JSON.parse(localStorage.getItem('farm_records_'+fid)||'[]'); a.push({id:99012,field_id:1,date:'2026-06-03',work_type:'除草',worker:'S2'}); localStorage.setItem('farm_records_'+fid,JSON.stringify(a)) },fid); await sleep(700)
  // adminが実UIで保存
  await adminSaveDaily(admin); await sleep(500)
  const a3=await recs()
  R.threeTab={ count:a3.length, workers:a3.map(r=>r.worker), allKept:['S1','S2'].every(w=>a3.some(r=>r.worker===w)) && a3.length>=3 }

  console.log('QACONC2_START');console.log(JSON.stringify(R,null,2));console.log('QACONC2_END')
  await b.close();server.close()
})().catch(e=>{console.error('RUNERR',e);process.exit(1)})
