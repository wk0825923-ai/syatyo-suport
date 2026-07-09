// ============================================================================
// シナリオ: ④ McD精緻化＋GRASP2.0追加のQA
//  ① データ定義: GGAP190 / McD31 / GRASP67 / 総計288・GRASPレベル(major42,minor25)
//  ② McD欠落3点(6.1/6.5/7.9)が追加されている
//  ③ スキーム選択にGRASPが出る／GRASP選択で67件・上位下位バッジ／レベル絞込
//  ④ 「すべて」で288、GGAPで190、McDで31、GRASPで67
//  ⑤ 全ページ巡回でエラー/白画面なし・GRASP項目描画でNaN無し
// 実行: cd qa && node qa_grasp.js
// ============================================================================
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core')
const ROOT=path.resolve(__dirname,'..'),PORT=8234,CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'
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
  R.def = await page.evaluate(()=>{const A=INITIAL_GAP_CHECKS;const cnt=s=>A.filter(c=>(c.schemes||['GGAP']).includes(s)).length;
    const grasp=A.filter(c=>(c.schemes||[]).includes('GRASP'));
    return { total:A.length, ggap:cnt('GGAP'), mcd:cnt('McD'), grasp:cnt('GRASP'),
      graspMajor:grasp.filter(c=>c.level==='major').length, graspMinor:grasp.filter(c=>c.level==='minor').length,
      mcdHas61:A.some(c=>c.code==='McD 6.1.1'), mcdHas65:A.some(c=>c.code==='McD 6.5.1'), mcdHas79:A.some(c=>c.code==='McD 7.9.1'),
      graspCats:[...new Set(grasp.map(c=>c.category))].length }
  })

  // ② GAPチェックリストへ
  await expand(page); await sleep(200)
  await clickText(page,'GAPチェックリスト'); await sleep(800)
  R.hasGraspBtn = await page.evaluate(()=>[...document.querySelectorAll('button')].some(b=>/GRASP（労務）/.test(b.textContent)))

  const readTotal=async()=>page.evaluate(()=>{const m=document.querySelector('.main').innerText.match(/対応度（\d+\/(\d+)）/);return m?parseInt(m[1]):null})
  // ④ 各スキームの件数
  await clickText(page,'GRASP（労務）'); await sleep(500); R.graspTotal=await readTotal()
  R.graspRender = await page.evaluate(()=>{const t=document.querySelector('.main').innerText;return{
    hasLabor:/苦情申し立て|人権ポリシー|労働時間/.test(t), hasBadge:/上位|下位/.test(t),
    bad:['NaN','undefined','[object Object]'].filter(x=>t.includes(x)).join(',')
  }})
  await clickText(page,'GLOBALG.A.P.'); await sleep(400); R.ggapTotal=await readTotal()
  await clickText(page,'McD Addendum'); await sleep(400); R.mcdTotal=await readTotal()
  await clickText(page,'全スキーム'); await sleep(400); R.allTotal=await readTotal()

  // ③ GRASPでレベル絞込(上位)
  await clickText(page,'GRASP（労務）'); await sleep(400)
  await clickText(page,'上位（必須）'); await sleep(400); R.graspMajorTotal=await readTotal()

  // ⑤ 全ページ巡回
  await clickText(page,'全スキーム'); await sleep(300)
  const pages=['ダッシュボード','GAPチェックリスト','必要書類・文書台帳','GAP帳票出力','圃場まとめ','出荷記録']
  R.scan=[]
  for(const p of pages){ await clickText(page,p); await sleep(500)
    const bad=await page.evaluate(()=>{const m=document.querySelector('.main');if(!m)return 'no-main';const t=m.innerText;return ['NaN','undefined','[object Object]'].filter(x=>t.includes(x)).join(',')||(t.trim().length<20?'blank':'')})
    R.scan.push({p,bad})
  }

  R.errors=errors
  console.log(JSON.stringify(R,null,2))
  const c=R
  const checks=[
    ['定義: 総計288', c.def.total===288],
    ['定義: GGAP190', c.def.ggap===190],
    ['定義: McD31', c.def.mcd===31],
    ['定義: GRASP67', c.def.grasp===67],
    ['定義: GRASPレベル(上42/下25)', c.def.graspMajor===42&&c.def.graspMinor===25],
    ['McD: 6.1追加', c.def.mcdHas61],
    ['McD: 6.5追加', c.def.mcdHas65],
    ['McD: 7.9追加', c.def.mcdHas79],
    ['UI: GRASPボタンあり', c.hasGraspBtn],
    ['UI: GRASP選択で67件', c.graspTotal===67],
    ['UI: GRASP項目描画(労務語)', c.graspRender.hasLabor],
    ['UI: GRASP異常表示なし', !c.graspRender.bad],
    ['UI: GGAP190件', c.ggapTotal===190],
    ['UI: McD31件', c.mcdTotal===31],
    ['UI: すべて288件', c.allTotal===288],
    ['UI: GRASP上位42件', c.graspMajorTotal===42],
    ['巡回: 異常なし', c.scan.every(x=>!x.bad)],
    ['JSエラーなし', errors.length===0],
  ]
  console.log('\n=== 判定 ===')
  let fail=0
  for(const [n,ok] of checks){ console.log((ok?'✅':'❌')+' '+n); if(!ok)fail++ }
  console.log(`\n${checks.length-fail}/${checks.length} passed, ${fail} failed`)
  await b.close(); server.close(); process.exit(fail?1:0)
})().catch(e=>{console.error(e);process.exit(2)})
