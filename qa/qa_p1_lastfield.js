// ============================================================================
// シナリオ: 星5ロードマップ P1「毎朝の最初の一手を速く」
//  ① 直近の記録がある圃場が、日報入力の圃場チップで先頭に並ぶ（最近使った順）
//  ② 最後に使った圃場が初期選択（選択中1圃場）＋「前回」バッジ表示
//  ③ 記録が無い状態では自動選択されない（誤記録防止）＆エラーなし
//  ④ 検索中は並び替えを乱さない（絞り込み優先）
// 実行: cd qa && node qa_p1_lastfield.js
// ============================================================================
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core')
const ROOT=path.resolve(__dirname,'..'),PORT=8236,CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'}
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.writeHead(404);r.end('404');return}r.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});r.end(d)})})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const clickText=(page,t)=>page.evaluate(t=>{const v=e=>e.offsetParent!==null;const cs=[...document.querySelectorAll('button,a,[role=button]')].filter(v);let el=cs.find(e=>e.textContent.trim()===t)||cs.find(e=>e.textContent.trim().includes(t)&&e.textContent.trim().length<t.length+18);if(el){el.click();return true}return false},t)
const expand=(page)=>page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith('管理・設定')&&e.offsetParent);if(b)b.click()})
const ensureApp=async(page)=>{ if(!(await page.evaluate(()=>!!document.querySelector('.main')))){
  await page.waitForSelector('input[type=email]',{timeout:30000});await page.type('input[type=email]','demo@syatyo-suport.jp');await page.type('input[type=password]','demo1234')
  await page.evaluate(()=>{const x=[...document.querySelectorAll('button[type=submit]')].find(b=>/ログイン/.test(b.textContent));if(x)x.click()})
  for(let i=0;i<40;i++){if(await page.evaluate(()=>!!document.querySelector('.main')))break;await sleep(500)} } }
const openDaily=async(page)=>{ await clickText(page,'日報入力'); await sleep(800) }
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

  // 圃場5件をseed（記録なし）
  await page.evaluate((fid)=>{
    const set=(k,v)=>localStorage.setItem(k+'_'+fid,JSON.stringify(v))
    set('farm_fields_v2',[
      {id:1,name:'第1圃場',field_no:'1',crop:'レタス',area_are:10,color:'#0D9972',row_count:12,crop_category:'leaf_veg'},
      {id:2,name:'第2圃場',field_no:'2',crop:'レタス',area_are:12,color:'#2563EB',row_count:12,crop_category:'leaf_veg'},
      {id:3,name:'第3圃場',field_no:'3',crop:'レタス',area_are:8, color:'#EA580C',row_count:12,crop_category:'leaf_veg'},
      {id:4,name:'第4圃場',field_no:'4',crop:'レタス',area_are:9, color:'#7C3AED',row_count:12,crop_category:'leaf_veg'},
      {id:5,name:'第5圃場',field_no:'5',crop:'レタス',area_are:11,color:'#B45309',row_count:12,crop_category:'leaf_veg'},
    ])
    set('farm_records',[])
  }, farmId)
  await page.reload({waitUntil:'networkidle2'}); await sleep(1000)

  // ③ 記録0件では自動選択されない
  await openDaily(page)
  const R={}
  R.noRecord = await page.evaluate(()=>{
    const t=document.querySelector('.main').innerText
    return { autoSelected:/選択中\s*\d+\s*圃場/.test(t), hasMaekai:/前回/.test(t) }
  })

  // 記録を投入: 第3圃場が最新、その前が第5圃場
  await page.evaluate((fid)=>{
    localStorage.setItem('farm_records_'+fid, JSON.stringify([
      {id:101,field_id:5,date:'2026-06-01',work_type:'施肥',worker:'今福'},
      {id:102,field_id:2,date:'2026-06-05',work_type:'除草',worker:'今福'},
      {id:103,field_id:3,date:'2026-06-20',work_type:'農薬散布',worker:'今福'}, // 最新
    ]))
  }, farmId)
  await page.reload({waitUntil:'networkidle2'}); await sleep(1000)
  await openDaily(page)

  // ①② 並び順と初期選択
  R.withRecord = await page.evaluate(()=>{
    const main=document.querySelector('.main')
    const t=main.innerText
    // チップの並び（グリッド内の圃場名を上から）
    const chips=[...main.querySelectorAll('[class],div')].filter(()=>false) // placeholder
    // 圃場チップ: onClickを持つボーダー付きdivを名前で拾う
    const names=[...main.querySelectorAll('div')]
      .filter(d=>/^第[1-5]圃場$/.test((d.textContent||'').trim().split('\n')[0]) && d.querySelector('div'))
    // 先頭に来ている圃場名を推定: 「選択中」表示＋前回バッジ近傍
    const firstChipName = (()=>{ const el=[...main.querySelectorAll('div')].find(d=>/前回/.test(d.textContent) && /第\d圃場/.test(d.textContent)); return el?(el.textContent.match(/第\d圃場/)||[])[0]:null })()
    return {
      autoSelected: /選択中\s*1\s*圃場/.test(t),
      hasMaekai: /前回/.test(t),
      maekaiField: firstChipName,
    }
  })
  // 実際に先頭チップが第3圃場か（DOM順で最初の圃場チップ）
  R.order = await page.evaluate(()=>{
    const main=document.querySelector('.main')
    // 圃場チップのグリッド：maxHeight:240pxのoverflowコンテナ内のクリック可能要素
    const grid=[...main.querySelectorAll('div')].find(d=>d.style&&d.style.maxHeight==='240px')
    if(!grid)return null
    const chipNames=[...grid.children].map(c=>{const m=(c.textContent||'').match(/第\d圃場/);return m?m[0]:null}).filter(Boolean)
    return chipNames.slice(0,5)
  })

  // ④ 検索中は絞り込み優先（並び替えしない）
  await page.evaluate(()=>{const inp=[...document.querySelectorAll('input')].find(i=>/絞り込み/.test(i.placeholder||''));if(inp){const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp,'第1');inp.dispatchEvent(new Event('input',{bubbles:true}))}})
  await sleep(400)
  R.search = await page.evaluate(()=>{
    const main=document.querySelector('.main')
    const grid=[...main.querySelectorAll('div')].find(d=>d.style&&d.style.maxHeight==='240px')
    const chipNames=grid?[...grid.children].map(c=>{const m=(c.textContent||'').match(/第\d圃場/);return m?m[0]:null}).filter(Boolean):[]
    return { only1:chipNames.length===1&&chipNames[0]==='第1圃場' }
  })

  R.errors=errors
  console.log(JSON.stringify(R,null,2))
  const checks=[
    ['記録0件では自動選択しない', R.noRecord.autoSelected===false],
    ['記録0件では前回バッジ無し', R.noRecord.hasMaekai===false],
    ['記録ありで初期選択される', R.withRecord.autoSelected===true],
    ['前回バッジが出る', R.withRecord.hasMaekai===true],
    ['前回バッジは最新の第3圃場', R.withRecord.maekaiField==='第3圃場'],
    ['先頭チップが最新の第3圃場', R.order && R.order[0]==='第3圃場'],
    ['2番目が次に新しい第2圃場', R.order && R.order[1]==='第2圃場'],
    ['検索は絞り込み優先(第1のみ)', R.search.only1===true],
    ['JSエラーなし', errors.length===0],
  ]
  console.log('\n=== 判定 ===')
  let fail=0
  for(const [n,ok] of checks){ console.log((ok?'✅':'❌')+' '+n); if(!ok)fail++ }
  console.log(`\n${checks.length-fail}/${checks.length} passed, ${fail} failed`)
  await b.close(); server.close(); process.exit(fail?1:0)
})().catch(e=>{console.error(e);process.exit(2)})
