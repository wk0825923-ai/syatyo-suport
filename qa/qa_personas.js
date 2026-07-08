// ============================================================================
// 多ペルソナQA: 管理者/スタッフ × 初期/継続利用 を実ブラウザで巡回し手戻りリスクを洗う。
//  P1 管理者・初期(空)        P2 管理者・継続(数ヶ月の蓄積データ)
//  P3 スタッフ・初期(空)      P4 スタッフ・継続(今日ぶんの記録あり)
// 各ペルソナで白画面/NaN/undefined/エラーが無いか。※同時利用はqa_concurrent2で別途。
// 実行: cd qa && node qa_personas.js
// ============================================================================
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core')
const ROOT=path.resolve(__dirname,'..'),PORT=8238,CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'}
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.writeHead(404);r.end('404');return}r.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});r.end(d)})})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const appReady=(page)=>page.evaluate(()=>!!document.querySelector('.main')||!!document.querySelector('.staff-view'))
const login=async(page)=>{ await sleep(500); const e=await page.$('input[type=email]'); if(e){ await page.type('input[type=email]','demo@syatyo-suport.jp'); await page.type('input[type=password]','demo1234'); await page.evaluate(()=>{const x=[...document.querySelectorAll('button[type=submit]')].find(b=>/ログイン/.test(b.textContent));if(x)x.click()}) } for(let i=0;i<50;i++){ if(await appReady(page))break; await sleep(500) } }
const clickInc=(page,t)=>page.evaluate(t=>{const c=[...document.querySelectorAll('button,a,[role=button]')].filter(e=>e.offsetParent);const el=c.find(e=>e.textContent.trim()===t)||c.find(e=>e.textContent.trim().includes(t)&&e.textContent.trim().length<t.length+16);if(el){el.click();return true}return false},t)
const expand=(page)=>page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith('管理・設定')&&e.offsetParent);if(b)b.click()})
const scan=(page)=>page.evaluate(()=>{const root=document.querySelector('.main')||document.querySelector('.staff-view');if(!root)return{white:true};const t=root.innerText;return{white:false,bad:['NaN','undefined','[object Object]','Infinity'].filter(x=>t.includes(x)).join(',')}})
const NAV=['総合ダッシュボード','日報入力','作付計画','GAP帳票出力','GAPチェックリスト','日報管理','圃場まとめ','収穫予測','出荷記録','マスタ管理','スタッフ管理','技能実習生','機械整備記録','収益シミュレーター','整合性チェック']
// 数ヶ月の蓄積データ(継続利用ペルソナ)
function accumulated(){
  const fields=[],lots={},records=[],sprays=[],ferts=[],harvs=[]
  for(let i=1;i<=12;i++){ fields.push({id:i,name:'圃場'+i,crop:['レタス','とうもろこし','米'][i%3],area_are:5+i,status:['growing','ready','harvested'][i%3],color:'#0D9972',lat:35.38+i*0.0006,lng:139.92+i*0.0006,row_count:4+i%5})
    lots[i]=[{id:'L'+i,field_id:i,row_range:'1-4',variety:'V'+i,status:['growing','ready','harvested'][i%3],seed_date:'2025-1'+(i%2)+'-01',transplant_date:'2026-01-15'}] }
  for(let m=1;m<=6;m++) for(let i=1;i<=12;i++){ records.push({id:m*100+i,field_id:i,date:'2026-0'+m+'-10',work_type:['除草','その他','畝づくり'][i%3],worker:'W'+(i%3)}) }
  for(let i=1;i<=12;i++){ sprays.push({id:i,field_id:i,row_range:'1-4',date:'2026-04-10',spray_volume_L:50,pesticides:[{pesticide_id:1,dilution:1000}],weather:'晴'})
    ferts.push({id:i,field_id:i,row_range:'1-4',date:'2026-03-10',fertilizer_id:1,amount_kg:20})
    harvs.push({id:i,field_id:i,row_range:'1-4',date:'2026-05-20',variety:'V'+i,total_cases:10+i}) }
  return { fields_v2:fields, lots, records, lot_spray_records:sprays, top_dressing_records:ferts, harvest_records:harvs,
    pesticides:[{id:1,name:'ダコニール',max_times:3,preharvest_days:7}], fertilizers:[{id:1,name:'化成',unit_price_yen_per_kg:100}],
    staff:[{id:1,name:'中川',role:'manager',nationality:'JP'},{id:2,name:'グエン',role:'trainee',nationality:'VN',visa_expires_at:'2026-12-01'}] }
}
;(async()=>{
  await new Promise(r=>server.listen(PORT,r))
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']})
  const page=await b.newPage(); await page.setViewport({width:1500,height:1000})
  const errors=[]; page.on('pageerror',e=>errors.push(String(e.message||e).slice(0,150)))
  page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/favicon|unpkg|jsdelivr|cloudflare|tabler|net::ERR|cyberjapan|arcgis|tile/.test(t))errors.push(t.slice(0,150))}})
  await page.goto(`http://localhost:${PORT}/`,{waitUntil:'domcontentloaded',timeout:60000}); await login(page)
  const fid=await page.evaluate(()=>CONFIG.CURRENT_FARM_ID)
  const R={}
  const seed=async(obj,view)=>{ await page.evaluate((fid,obj)=>{ Object.keys(localStorage).filter(k=>k.startsWith('farm_')).forEach(k=>localStorage.removeItem(k)); Object.entries(obj).forEach(([k,v])=>localStorage.setItem('farm_'+k+'_'+fid,JSON.stringify(v))) },fid,obj); await page.goto(`http://localhost:${PORT}/`+(view==='staff'?'?view=staff':''),{waitUntil:'domcontentloaded'}); await login(page); await sleep(900) }
  const adminSweep=async()=>{ await expand(page); await sleep(150); const bad=[]; for(const p of NAV){ await clickInc(page,p); await sleep(320); const s=await scan(page); if(s.white||s.bad)bad.push(p+(s.white?':white':':'+s.bad)) } return bad }

  // P1 管理者・初期
  await seed({})
  R.P1_admin_fresh={ sweepBad: await adminSweep() }
  // P2 管理者・継続
  await seed(accumulated())
  R.P2_admin_accum={ sweepBad: await adminSweep(),
    integrity: await page.evaluate(()=>{ try{ return runFarmIntegrityChecks({records:JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/farm_records_/.test(k)))||'[]')}).length>=0 }catch(e){return 'ERR:'+e.message} }) }
  // P3 スタッフ・初期
  await seed({}, 'staff')
  R.P3_staff_fresh={ staffView: await page.evaluate(()=>!!document.querySelector('.staff-view')), scan: await scan(page) }
  // P4 スタッフ・継続(今日の記録)
  const today=new Date(); const td=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0')
  await seed({ fields_v2:[{id:1,name:'第1圃場',crop:'レタス',area_are:10,status:'growing'}], records:[{id:1,field_id:1,date:td,work_type:'除草',worker:'太郎'},{id:2,field_id:1,date:td,work_type:'その他',worker:'次郎'}] }, 'staff')
  R.P4_staff_accum={ staffView: await page.evaluate(()=>!!document.querySelector('.staff-view')), scan: await scan(page),
    todayCount: await page.evaluate(()=>{const m=document.body.innerText.match(/今日\s*(\d+)\s*件/);return m?parseInt(m[1]):null}) }

  R.errorCount=errors.length; R.errors=errors.slice(0,10)
  console.log('QAPERSONA_START');console.log(JSON.stringify(R,null,2));console.log('QAPERSONA_END')
  await b.close();server.close()
})().catch(e=>{console.error('RUNERR',e);process.exit(1)})
