// mid-edit競合: 管理者が日報を入力中に、別タブ(スタッフ)が保存→storage同期が走っても
// 管理者の入力中フォームは消えず、両方の保存が残ることを確認。
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core')
const ROOT=path.resolve(__dirname,'..'),PORT=8248,CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'}
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.writeHead(404);r.end('404');return}r.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});r.end(d)})})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const ready=(p)=>p.evaluate(()=>!!document.querySelector('.main')||!!document.querySelector('.staff-view'))
const login=async(p)=>{await sleep(400);const e=await p.$('input[type=email]');if(e){await p.type('input[type=email]','demo@syatyo-suport.jp');await p.type('input[type=password]','demo1234');await p.evaluate(()=>{const x=[...document.querySelectorAll('button[type=submit]')].find(b=>/ログイン/.test(b.textContent));if(x)x.click()})}for(let i=0;i<50;i++){if(await ready(p))break;await sleep(400)}}
const clickInc=(p,t)=>p.evaluate(t=>{const c=[...document.querySelectorAll('button,a,[role=button]')].filter(e=>e.offsetParent);const el=c.find(e=>e.textContent.trim()===t)||c.find(e=>e.textContent.trim().includes(t)&&e.textContent.trim().length<t.length+16);if(el){el.click();return true}return false},t)
;(async()=>{
  await new Promise(r=>server.listen(PORT,r))
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox']})
  const admin=await b.newPage(); await admin.goto(`http://localhost:${PORT}/`,{waitUntil:'domcontentloaded',timeout:60000}); await login(admin)
  const fid=await admin.evaluate(()=>CONFIG.CURRENT_FARM_ID)
  await admin.evaluate((fid)=>{Object.keys(localStorage).filter(k=>k.startsWith('farm_')).forEach(k=>localStorage.removeItem(k));localStorage.setItem('farm_fields_v2_'+fid,JSON.stringify([{id:1,name:'第1圃場',crop:'レタス',area_are:10,status:'growing'}]))},fid)
  await admin.reload({waitUntil:'domcontentloaded'}); await sleep(1000)
  const R={}
  // 管理者が日報を入力中(圃場選択→作業者入力)
  await clickInc(admin,'日報入力'); await sleep(600)
  await clickInc(admin,'第1圃場'); await sleep(300)
  await admin.click('input[placeholder*="田中"]'); await admin.type('input[placeholder*="田中"]','入力中の管理者'); await sleep(200)
  // 別タブ(スタッフ)が記録を保存→storageイベント発火
  const staff=await b.newPage(); await staff.goto(`http://localhost:${PORT}/?view=staff`,{waitUntil:'domcontentloaded'}); await login(staff); await sleep(600)
  await staff.evaluate((fid)=>{localStorage.setItem('farm_records_'+fid,JSON.stringify([{id:9001,field_id:1,date:'2026-06-01',work_type:'除草',worker:'スタッフ'}]))},fid); await sleep(900)
  // 管理者の入力中フォームが消えていないか
  R.formKept=await admin.evaluate(()=>{const i=document.querySelector('input[placeholder*="田中"]');return i?i.value:'(gone)'})
  // 管理者が保存まで進める
  await clickInc(admin,'次へ'); await sleep(400); await clickInc(admin,'除草'); await sleep(300); await clickInc(admin,'次へ'); await sleep(400); await clickInc(admin,'確認'); await sleep(400)
  ;(await clickInc(admin,'記録する'))||(await clickInc(admin,'保存')); await sleep(700)
  const recs=await admin.evaluate((fid)=>JSON.parse(localStorage.getItem('farm_records_'+fid)||'[]'),fid)
  R.staffKept=recs.some(r=>r.worker==='スタッフ'); R.adminSaved=recs.some(r=>r.worker==='入力中の管理者'); R.count=recs.length
  console.log(JSON.stringify(R,null,2))
  await b.close();server.close()
})().catch(e=>{console.error('ERR',e.message);process.exit(1)})
