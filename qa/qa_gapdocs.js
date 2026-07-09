// ============================================================================
// シナリオ: 必要書類ナビ / 文書管理台帳（GapDocumentRegistry）のQA
//  ① データ定義: INITIAL_GAP_DOCUMENTS 36件・smart→category解決
//  ② ページ描画: 進捗0/36・原則グループ・全書類表示・白画面/NaNなし
//  ③ 整備チェック→進捗が増える／更新日自動セット／リロード後も永続
//  ④ 未整備フィルタ: 整備済みが消える
//  ⑤ 全ページ巡回でエラーなし
// 実行: cd qa && node qa_gapdocs.js
// ============================================================================
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core')
const ROOT=path.resolve(__dirname,'..'),PORT=8233,CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'}
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.writeHead(404);r.end('404');return}r.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});r.end(d)})})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const clickText=(page,t)=>page.evaluate(t=>{const v=e=>e.offsetParent!==null;const cs=[...document.querySelectorAll('button,a,[role=button]')].filter(v);let el=cs.find(e=>e.textContent.trim()===t)||cs.find(e=>e.textContent.trim().includes(t)&&e.textContent.trim().length<t.length+18);if(el){el.click();return true}return false},t)
const expand=(page)=>page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith('管理・設定')&&e.offsetParent);if(b)b.click()})
;(async()=>{
  await new Promise(r=>server.listen(PORT,r))
  const errors=[]
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']})
  const page=await b.newPage(); await page.setViewport({width:1500,height:1000})
  page.on('pageerror',e=>errors.push(String(e.message||e).slice(0,150)))
  page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/favicon|unpkg|jsdelivr|cloudflare|tabler|net::ERR/.test(t))errors.push(t.slice(0,150))}})
  await page.goto(`http://localhost:${PORT}/`,{waitUntil:'networkidle2',timeout:60000})
  if(!(await page.evaluate(()=>!!document.querySelector('.main')))){
    await page.waitForSelector('input[type=email]',{timeout:30000});await page.type('input[type=email]','demo@syatyo-suport.jp');await page.type('input[type=password]','demo1234')
    await page.evaluate(()=>{const x=[...document.querySelectorAll('button[type=submit]')].find(b=>/ログイン/.test(b.textContent));if(x)x.click()})
    for(let i=0;i<40;i++){if(await page.evaluate(()=>!!document.querySelector('.main')))break;await sleep(500)}
  }
  const R={}

  // ① データ定義
  R.def = await page.evaluate(()=>({
    total: (typeof INITIAL_GAP_DOCUMENTS!=='undefined')?INITIAL_GAP_DOCUMENTS.length:-1,
    smart03cat: (typeof gapCategoryForSmart==='function')?gapCategoryForSmart('03',INITIAL_GAP_CHECKS):null,
    commonCat: (typeof gapCategoryForSmart==='function')?gapCategoryForSmart('common',INITIAL_GAP_CHECKS):null,
    smartVals: (typeof INITIAL_GAP_DOCUMENTS!=='undefined')?[...new Set(INITIAL_GAP_DOCUMENTS.map(d=>d.smart))].length:-1,
  }))

  // farm初期化して空状態に
  const farmId = await page.evaluate(()=> (typeof CONFIG!=='undefined'&&CONFIG.CURRENT_FARM_ID)?CONFIG.CURRENT_FARM_ID:null)
  await page.evaluate(()=>{Object.keys(localStorage).filter(k=>/farm_gap_documents_/.test(k)).forEach(k=>localStorage.removeItem(k))})
  await page.reload({waitUntil:'networkidle2'}); await sleep(1000); await expand(page); await sleep(300)

  // ② ページ描画
  await clickText(page,'必要書類・文書台帳'); await sleep(700)
  R.render = await page.evaluate(()=>{const m=document.querySelector('.main');const t=m?m.innerText:'';return{
    hasTitle:/必要書類ナビ|文書管理台帳/.test(t),
    has36:/0\/36/.test(t),
    hasSmartGroup:/FV-Smart\s*03/.test(t),
    hasCommon:/共通/.test(t),
    docCount:(document.querySelectorAll('.main input[type=checkbox]')||[]).length,
    bad:['NaN','undefined','[object Object]'].filter(x=>t.includes(x)).join(',')
  }})

  // ③ 整備チェック → 進捗が増える
  R.beforePct = await page.evaluate(()=>{const m=document.querySelector('.main').innerText.match(/(\d+)%/);return m?parseInt(m[1]):null})
  await page.evaluate(()=>{const cbs=[...document.querySelectorAll('.main input[type=checkbox]')];[0,1,2].forEach(i=>{if(cbs[i]){cbs[i].click()}})})
  await sleep(500)
  R.afterPct = await page.evaluate(()=>{const m=document.querySelector('.main').innerText.match(/(\d+)%/);return m?parseInt(m[1]):null})
  R.afterReady = await page.evaluate(()=>{const m=document.querySelector('.main').innerText.match(/(\d+)\/36/);return m?parseInt(m[1]):null})
  // 更新日が自動セットされたか(storage)
  R.storageAfter = await page.evaluate((fid)=>{const raw=localStorage.getItem('farm_gap_documents_'+fid);if(!raw)return null;const o=JSON.parse(raw);const keys=Object.keys(o).filter(k=>o[k]&&o[k].ready);return{readyCount:keys.length,firstUpdated:keys.length?o[keys[0]].updated:null}}, farmId)

  // リロードして永続確認
  await page.reload({waitUntil:'networkidle2'}); await sleep(1000); await expand(page); await sleep(300)
  await clickText(page,'必要書類・文書台帳'); await sleep(600)
  R.afterReloadReady = await page.evaluate(()=>{const m=document.querySelector('.main').innerText.match(/(\d+)\/36/);return m?parseInt(m[1]):null})

  // ④ 未整備フィルタ
  await clickText(page,'未整備のみ'); await sleep(500)
  R.todoCount = await page.evaluate(()=>(document.querySelectorAll('.main input[type=checkbox]')||[]).length)

  // ⑤ 全ページ巡回
  await clickText(page,'すべて'); await sleep(300)
  const pages=['ダッシュボード','GAPチェックリスト','必要書類・文書台帳','GAP帳票出力','圃場まとめ']
  R.scan=[]
  for(const p of pages){ await clickText(page,p); await sleep(500)
    const bad=await page.evaluate(()=>{const m=document.querySelector('.main');if(!m)return 'no-main';const t=m.innerText;return ['NaN','undefined','[object Object]'].filter(x=>t.includes(x)).join(',')||(t.trim().length<20?'blank':'')})
    R.scan.push({p,bad})
  }

  R.errors=errors
  console.log(JSON.stringify(R,null,2))
  const c=R
  const checks=[
    ['定義: 36文書', c.def.total===36],
    ['定義: smart03→カテゴリ解決', !!c.def.smart03cat],
    ['定義: common→共通', /共通/.test(c.def.commonCat||'')],
    ['描画: タイトル', c.render.hasTitle],
    ['描画: 0/36表示', c.render.has36],
    ['描画: FV-Smartグループ', c.render.hasSmartGroup],
    ['描画: チェックボックス36', c.render.docCount===36],
    ['描画: 異常表示なし', !c.render.bad],
    ['整備: 進捗が増える', c.afterReady===3 && c.afterPct>c.beforePct],
    ['整備: 更新日自動セット', c.storageAfter && !!c.storageAfter.firstUpdated],
    ['永続: リロード後も3件', c.afterReloadReady===3],
    ['フィルタ: 未整備で33件', c.todoCount===33],
    ['巡回: 異常なし', c.scan.every(x=>!x.bad)],
    ['JSエラーなし', errors.length===0],
  ]
  console.log('\n=== 判定 ===')
  let fail=0
  for(const [n,ok] of checks){ console.log((ok?'✅':'❌')+' '+n); if(!ok)fail++ }
  console.log(`\n${checks.length-fail}/${checks.length} passed, ${fail} failed`)
  await b.close(); server.close(); process.exit(fail?1:0)
})().catch(e=>{console.error(e);process.exit(2)})
