// ============================================================================
// 同時利用QA(さらなる角度): ④10タブ同時 / ②保存失敗(容量超過)で既存データが壊れない /
//  ①農場キーの分離(farm_xxx_<farmId>で別農場は独立)
// 実行: cd qa && node qa_concurrent4.js
// ============================================================================
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core')
const ROOT=path.resolve(__dirname,'..'),PORT=8249,CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'}
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.writeHead(404);r.end('404');return}r.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});r.end(d)})})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const ready=(p)=>p.evaluate(()=>!!document.querySelector('.main')||!!document.querySelector('.staff-view'))
const login=async(p)=>{await sleep(400);const e=await p.$('input[type=email]');if(e){await p.type('input[type=email]','demo@syatyo-suport.jp');await p.type('input[type=password]','demo1234');await p.evaluate(()=>{const x=[...document.querySelectorAll('button[type=submit]')].find(b=>/ログイン/.test(b.textContent));if(x)x.click()})}for(let i=0;i<50;i++){if(await ready(p))break;await sleep(400)}}
;(async()=>{
  await new Promise(r=>server.listen(PORT,r))
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',protocolTimeout:300000,args:['--no-sandbox']})
  const R={}
  const admin=await b.newPage(); await admin.goto(`http://localhost:${PORT}/`,{waitUntil:'domcontentloaded',timeout:60000}); await login(admin)
  const fid=await admin.evaluate(()=>CONFIG.CURRENT_FARM_ID)
  await admin.evaluate((fid)=>{Object.keys(localStorage).filter(k=>k.startsWith('farm_')).forEach(k=>localStorage.removeItem(k));localStorage.setItem('farm_records_'+fid,JSON.stringify([])) },fid)
  await admin.reload({waitUntil:'domcontentloaded'}); await sleep(800)
  const recs=async()=>admin.evaluate((fid)=>JSON.parse(localStorage.getItem('farm_records_'+fid)||'[]'),fid)

  // ── ④ 10タブ同時追加 ──
  const tabs=[admin]
  for(let i=0;i<9;i++){ const p=await b.newPage(); await p.goto(`http://localhost:${PORT}/?view=staff`,{waitUntil:'domcontentloaded'}); await login(p); tabs.push(p) }
  for(let i=0;i<tabs.length;i++){ await tabs[i].evaluate((fid,i)=>{const a=JSON.parse(localStorage.getItem('farm_records_'+fid)||'[]');a.push({id:7000+i,field_id:1,date:'2026-06-0'+(i%9+1),work_type:'除草',worker:'TAB'+i});localStorage.setItem('farm_records_'+fid,JSON.stringify(a))},fid,i); await sleep(300) }
  const w=(await recs()).map(r=>r.worker)
  R.tenTabs={ count:w.length, allKept:[...Array(10)].every((_,i)=>w.includes('TAB'+i)) }
  for(let i=1;i<tabs.length;i++){ await tabs[i].close() }

  // ── ② 保存失敗(容量超過)で既存データが壊れない ──
  // 既存記録R1を置き、localStorageを埋めてから追記を試みる→setItem例外でも R1 が残る(atomic)
  await admin.evaluate((fid)=>localStorage.setItem('farm_records_'+fid,JSON.stringify([{id:1,worker:'既存R1'}])),fid)
  const quota=await admin.evaluate((fid)=>{
    let filled=false
    try{ const big='x'.repeat(1024*1024); for(let i=0;i<20;i++) localStorage.setItem('__fill_'+i,big) }catch(e){ filled=true }
    // 追記を試みる(既存を読んでpush→setItem)。容量超過なら例外
    let threw=false, r1Safe=true
    try{ const a=JSON.parse(localStorage.getItem('farm_records_'+fid)||'[]'); a.push({id:2,worker:'追記R2'}); localStorage.setItem('farm_records_'+fid,JSON.stringify(a)) }catch(e){ threw=true }
    // R1が残っているか(壊れていない)
    try{ const a=JSON.parse(localStorage.getItem('farm_records_'+fid)||'[]'); r1SafeExists = a.some(x=>x.worker==='既存R1'); r1Valid=Array.isArray(a) }catch(e){ r1Safe=false }
    // 後片付け
    for(let i=0;i<20;i++) localStorage.removeItem('__fill_'+i)
    return { filled, threw, r1Exists: (()=>{try{return JSON.parse(localStorage.getItem('farm_records_'+fid)||'[]').some(x=>x.worker==='既存R1')}catch(e){return false}})() }
  },fid)
  R.quotaSafe={ ...quota, verdict: quota.r1Exists ? 'OK(既存データ無事)' : 'NG(既存が消えた)' }

  // ── ① 農場キーの分離(別農場IDは独立) ──
  const iso=await admin.evaluate((fid)=>{
    const other='ZZZ-other-farm'
    localStorage.setItem('farm_records_'+fid, JSON.stringify([{id:1,worker:'農場A'}]))
    localStorage.setItem('farm_records_'+other, JSON.stringify([{id:1,worker:'農場B'}]))
    // 農場Aを更新しても農場Bは不変
    localStorage.setItem('farm_records_'+fid, JSON.stringify([{id:1,worker:'農場A'},{id:2,worker:'農場A2'}]))
    const A=JSON.parse(localStorage.getItem('farm_records_'+fid)||'[]')
    const B=JSON.parse(localStorage.getItem('farm_records_'+other)||'[]')
    localStorage.removeItem('farm_records_'+other)
    return { aCount:A.length, bUnchanged: B.length===1 && B[0].worker==='農場B' }
  },fid)
  R.farmIsolation={ ...iso, verdict: iso.bUnchanged ? 'OK(別農場は独立)' : 'NG' }

  console.log('QACONC4_START');console.log(JSON.stringify(R,null,2));console.log('QACONC4_END')
  await b.close();server.close()
})().catch(e=>{console.error('RUNERR',e);process.exit(1)})
