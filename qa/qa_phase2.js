// ============================================================================
// 複合条件QA: フェーズ2(衛星畝マップ+畝カルテ+GAP適合フラグ)の新機能検証 ＋ 既存機能への影響(回帰)
// 1ブラウザセッションで複数シナリオ×複数場面を高頻度に回す。
//   A 空データ: 全ページ巡回・GAP190・マップ描画・白画面/NaN/エラー0
//   B 通常データ: 畝の色分け・畝カルテ集計・GAP適合✅
//   C PHI違反: 畝カルテに ⚠️PHI注意
//   D 農薬回数超過: 畝カルテに ⚠️農薬回数超過
//   E row_count無し圃場: 畝は出ずマーカーのみ・クラッシュ無し
//   F 緯度経度無し圃場: クラッシュ無し(既存ガード)
//   G データ有りで全ページ巡回・エラー0(回帰)
// 実行: cd qa && node qa_phase2.js
// ============================================================================
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core')
const ROOT=path.resolve(__dirname,'..'),PORT=8222,CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'}
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.writeHead(404);r.end('404');return}r.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});r.end(d)})})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const openMap=async(page)=>{ await page.evaluate(()=>{const el=document.querySelector('[title="圃場マップ"]');if(el)el.click()}); await sleep(2600) }
const clickText=(page,t)=>page.evaluate(t=>{const v=e=>e.offsetParent!==null;const cs=[...document.querySelectorAll('button,a,[role=button]')].filter(v);let el=cs.find(e=>e.textContent.trim()===t)||cs.find(e=>e.textContent.trim().includes(t)&&e.textContent.trim().length<t.length+18);if(el){el.click();return true}return false},t)
const expand=(page)=>page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith('管理・設定')&&e.offsetParent);if(b)b.click()})
const bedPopup=async(page)=>{ await page.evaluate(()=>{const p=document.querySelector('path.leaflet-interactive');if(p)p.dispatchEvent(new MouseEvent('click',{bubbles:true}))}); await sleep(600); return page.evaluate(()=>{const p=document.querySelector('.leaflet-popup-content');return p?p.innerText.replace(/\s+/g,' ').trim():null}) }
;(async()=>{
  await new Promise(r=>server.listen(PORT,r))
  const errors=[]
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']})
  const page=await b.newPage(); await page.setViewport({width:1500,height:1000})
  page.on('pageerror',e=>errors.push(String(e.message||e).slice(0,150)))
  page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/favicon|unpkg|jsdelivr|cloudflare|tabler|net::ERR|cyberjapan|arcgis|tile/.test(t))errors.push(t.slice(0,150))}})
  await page.goto(`http://localhost:${PORT}/`,{waitUntil:'networkidle2',timeout:60000})
  if(!(await page.evaluate(()=>!!document.querySelector('.main')))){
    await page.waitForSelector('input[type=email]',{timeout:30000});await page.type('input[type=email]','demo@syatyo-suport.jp');await page.type('input[type=password]','demo1234')
    await page.evaluate(()=>{const x=[...document.querySelectorAll('button[type=submit]')].find(b=>/ログイン/.test(b.textContent));if(x)x.click()})
    for(let i=0;i<40;i++){if(await page.evaluate(()=>!!document.querySelector('.main')))break;await sleep(500)}
  }
  const fid=await page.evaluate(()=> (typeof CONFIG!=='undefined'&&CONFIG.CURRENT_FARM_ID)?CONFIG.CURRENT_FARM_ID:null)
  const R={ scenarios:{} }
  const seed=async(obj)=>{ await page.evaluate((fid,obj)=>{ Object.keys(localStorage).filter(k=>k.startsWith('farm_')).forEach(k=>localStorage.removeItem(k)); Object.entries(obj).forEach(([k,v])=>localStorage.setItem('farm_'+k+'_'+fid,JSON.stringify(v))) },fid,obj); await page.reload({waitUntil:'networkidle2'}); await sleep(1200); await expand(page); await sleep(200) }
  const sweep=async(nav)=>{ const bad=[]; for(const p of nav){ await clickText(page,p); await sleep(380); const s=await page.evaluate(()=>{const m=document.querySelector('.main');if(!m)return{white:true};const t=m.innerText;return{white:false,bad:['NaN','undefined','[object Object]','Infinity'].filter(x=>t.includes(x)).join(',')}}); if(s.white||s.bad)bad.push(p+(s.white?':white':':'+s.bad)) } return bad }
  const NAV=['総合ダッシュボード','日報入力','GAP帳票出力','GAPチェックリスト','日報管理','圃場まとめ','収穫予測','出荷記録','マスタ管理','スタッフ管理','機械整備記録']

  // ── A 空データ ──
  await seed({})
  R.scenarios.A_empty = { gap190: await page.evaluate(()=>typeof INITIAL_GAP_CHECKS!=='undefined'&&INITIAL_GAP_CHECKS.length===190), sweepBad: await sweep(NAV) }
  await openMap(page); R.scenarios.A_empty.mapOk = await page.evaluate(()=>!!document.querySelector('.leaflet-container'))

  const F=(extra)=>[{id:1,name:'第1圃場',crop:'レタス',area_are:10,status:'growing',color:'#0D9972',lat:35.385,lng:139.926,row_count:6,...(extra||{})}]
  const commonSpray=(rr,date)=>({id:Math.random(),field_id:1,row_range:rr,date,pesticides:[{pesticide_id:1,dilution:1000}]})

  // ── B 通常データ(適合) ──
  await seed({ fields_v2:F(), lots:{1:[{id:'L1',field_id:1,row_range:'1-3',variety:'レタスA',status:'growing'}]},
    pesticides:[{id:1,name:'ダコニール',max_times:3,preharvest_days:7}],
    lot_spray_records:[commonSpray('1-3','2026-05-01')], top_dressing_records:[{id:1,field_id:1,row_range:'1-3',date:'2026-04-20',fertilizer_id:1,amount_kg:10}],
    harvest_records:[{id:1,field_id:1,row_range:'1-3',date:'2026-06-20',variety:'レタスA',total_cases:12}] })
  await openMap(page); R.scenarios.B_normal = { popup: await bedPopup(page) }

  // ── C PHI違反(散布5/20→収穫5/25=5日<PHI7) ──
  await seed({ fields_v2:F(), lots:{1:[{id:'L1',field_id:1,row_range:'1-3',variety:'レタスA',status:'ready'}]},
    pesticides:[{id:1,name:'ダコニール',max_times:3,preharvest_days:7}],
    lot_spray_records:[commonSpray('1-3','2026-05-20')], harvest_records:[{id:1,field_id:1,row_range:'1-3',date:'2026-05-25',variety:'レタスA',total_cases:5}] })
  await openMap(page); R.scenarios.C_phi = { popup: await bedPopup(page) }

  // ── D 農薬回数超過(max3に対し4回) ──
  await seed({ fields_v2:F(), lots:{1:[{id:'L1',field_id:1,row_range:'1-3',variety:'レタスA',status:'growing'}]},
    pesticides:[{id:1,name:'ダコニール',max_times:3,preharvest_days:7}],
    lot_spray_records:[commonSpray('1-3','2026-04-01'),commonSpray('1-3','2026-04-15'),commonSpray('1-3','2026-05-01'),commonSpray('1-3','2026-05-15')] })
  await openMap(page); R.scenarios.D_over = { popup: await bedPopup(page) }

  // ── E row_count無し ──
  await seed({ fields_v2:[{id:1,name:'圃場E',crop:'米',area_are:8,status:'growing',color:'#D97706',lat:35.386,lng:139.927}] })
  await openMap(page); R.scenarios.E_norow = { polys: await page.evaluate(()=>document.querySelectorAll('path.leaflet-interactive').length), mapOk: await page.evaluate(()=>!!document.querySelector('.leaflet-container')) }

  // ── F 緯度経度無し(既存ガード) ──
  await seed({ fields_v2:[{id:1,name:'圃場F',crop:'レタス',area_are:5,status:'growing',row_count:4}] })
  await openMap(page); R.scenarios.F_nolatlng = { mapOk: await page.evaluate(()=>!!document.querySelector('.leaflet-container')), polys: await page.evaluate(()=>document.querySelectorAll('path.leaflet-interactive').length) }

  // ── G データ有りで全ページ巡回(回帰) ──
  await seed({ fields_v2:F(), lots:{1:[{id:'L1',field_id:1,row_range:'1-6',variety:'レタスA',status:'growing'}]},
    pesticides:[{id:1,name:'ダコニール',max_times:3,preharvest_days:7}], lot_spray_records:[commonSpray('1-6','2026-05-01')],
    harvest_records:[{id:1,field_id:1,row_range:'1-6',date:'2026-06-20',variety:'レタスA',total_cases:20}] })
  R.scenarios.G_regression = { sweepBad: await sweep(NAV) }

  R.errorCount=errors.length; R.errors=errors.slice(0,10)
  console.log('QAP2_START');console.log(JSON.stringify(R,null,2));console.log('QAP2_END')
  await b.close();server.close()
})().catch(e=>{console.error('RUNERR',e);process.exit(1)})
