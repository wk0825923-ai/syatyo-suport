// ============================================================================
// P1「毎朝の最初の一手を速く」複合条件マトリクス監査（番人）
//  軸A データ状態×初期選択 / 軸B 並べ替え×検索×選択 / 軸C 保存への波及
//  軸D UI(前回バッジ) / 軸E リグレッション
// 実行: cd qa && node qa_p1_matrix.js
// 本体js編集なし・git操作なし。読み取り＋DOM検査＋保存後のlocalStorage確認のみ。
// ============================================================================
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core')
const ROOT=path.resolve(__dirname,'..'),PORT=8241,CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'}
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.writeHead(404);r.end('404');return}r.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});r.end(d)})})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const clickText=(page,t)=>page.evaluate(t=>{const v=e=>e.offsetParent!==null;const cs=[...document.querySelectorAll('button,a,[role=button]')].filter(v);let el=cs.find(e=>e.textContent.trim()===t)||cs.find(e=>e.textContent.trim().includes(t)&&e.textContent.trim().length<t.length+18);if(el){el.click();return true}return false},t)
const ensureApp=async(page)=>{ if(!(await page.evaluate(()=>!!document.querySelector('.main')))){
  await page.waitForSelector('input[type=email]',{timeout:30000});await page.type('input[type=email]','demo@syatyo-suport.jp');await page.type('input[type=password]','demo1234')
  await page.evaluate(()=>{const x=[...document.querySelectorAll('button[type=submit]')].find(b=>/ログイン/.test(b.textContent));if(x)x.click()})
  for(let i=0;i<40;i++){if(await page.evaluate(()=>!!document.querySelector('.main')))break;await sleep(500)} } }
const openDaily=async(page)=>{ await clickText(page,'日報入力'); await sleep(700) }
// グリッド（圃場チップ）から順番に圃場名を取得
const chipOrder=(page)=>page.evaluate(()=>{
  const main=document.querySelector('.main'); if(!main)return null
  const grid=[...main.querySelectorAll('div')].find(d=>d.style&&d.style.maxHeight==='240px')
  if(!grid)return null
  return [...grid.children].map(c=>{const txt=(c.textContent||'').replace(/[✓✔]/g,'');const m=txt.match(/第\d+圃場|圃場\d+/);return m?m[0]:txt.trim().split('\n')[0]}).filter(Boolean)
})
const seed=(page,farmId,fields,records)=>page.evaluate((fid,fields,records)=>{
  localStorage.setItem('farm_fields_v2_'+fid,JSON.stringify(fields))
  localStorage.setItem('farm_records_'+fid,JSON.stringify(records))
},farmId,fields,records)
const F=(id,name,extra={})=>Object.assign({id,name,field_no:String(id),crop:'レタス',area_are:10,color:'#0D9972',row_count:12,crop_category:'leaf_veg'},extra)
const R=(id,field_id,date,extra={})=>Object.assign({id,field_id,date,work_type:'除草',worker:'今福'},extra)

;(async()=>{
  await new Promise(r=>server.listen(PORT,r))
  const errors=[]
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']})
  const page=await b.newPage(); await page.setViewport({width:1500,height:1000})
  page.on('pageerror',e=>errors.push('[pageerror] '+String(e.message||e).slice(0,160)))
  page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/favicon|unpkg|jsdelivr|cloudflare|tabler|net::ERR/.test(t))errors.push('[console] '+t.slice(0,160))}})
  await page.goto(`http://localhost:${PORT}/`,{waitUntil:'networkidle2',timeout:60000})
  await ensureApp(page)
  const farmId=await page.evaluate(()=>(typeof CONFIG!=='undefined'&&CONFIG.CURRENT_FARM_ID)?CONFIG.CURRENT_FARM_ID:null)

  const checks=[]
  const add=(name,ok,detail)=>{checks.push([name,!!ok,detail||'']); }
  const errBefore=()=>errors.length
  const noNewErr=(n)=>errors.length===n

  // 各シナリオ共通: seed→reload→日報を開く
  const scenario=async(fields,records,fn)=>{
    await seed(page,farmId,fields,records)
    await page.reload({waitUntil:'networkidle2'}); await sleep(700)
    await openDaily(page)
    await fn()
  }

  // ── 軸A-1: 圃場1件だけ＋記録あり ──
  await scenario([F(1,'第1圃場')],[R(101,1,'2026-06-01')],async()=>{
    const e0=errBefore()
    const order=await chipOrder(page)
    const st=await page.evaluate(()=>{const t=document.querySelector('.main').innerText;return{sel:/選択中\s*1\s*圃場/.test(t),maekai:(t.match(/前回/g)||[]).length}})
    add('A1 圃場1件: 初期選択される', st.sel, JSON.stringify(st))
    add('A1 圃場1件: 前回バッジ1つ', st.maekai===1, 'count='+st.maekai)
    add('A1 圃場1件: 例外なし', noNewErr(e0))
  })

  // ── 軸A-2: 孤児 field_id（記録の圃場が削除済み） ──
  // 最新記録の field_id=99 は fields に存在しない → 初期選択しないのが正
  await scenario([F(1,'第1圃場'),F(2,'第2圃場')],[R(101,1,'2026-06-01'),R(102,99,'2026-06-20')],async()=>{
    const e0=errBefore()
    const st=await page.evaluate(()=>{const t=document.querySelector('.main').innerText;return{sel:/選択中\s*\d+\s*圃場/.test(t),selN:(t.match(/選択中\s*(\d+)\s*圃場/)||[])[1]||null,maekai:(t.match(/前回/g)||[]).length}})
    // 最新は孤児99。lastFieldId は fields.some(...)==false なので初期選択""。よってバッジも出ない（lastUsedId=99だがfieldsに無いので描画されない）
    add('A2 孤児最新: 初期選択されない(誤記録防止)', st.sel===false, JSON.stringify(st))
    add('A2 孤児最新: 前回バッジ出ない(該当チップ無し)', st.maekai===0, 'count='+st.maekai)
    add('A2 孤児: 例外なし', noNewErr(e0))
  })

  // ── 軸A-2b: 孤児が最新でない（最新は生きてる圃場2） ──
  await scenario([F(1,'第1圃場'),F(2,'第2圃場')],[R(101,99,'2026-06-25'),R(102,2,'2026-06-20'),R(103,1,'2026-06-01')],async()=>{
    // recentFieldIds=[99,2,1]。lastFieldId: recentFieldIds[0]=99 は fields.some=false → ""。よって初期選択されない。
    const st=await page.evaluate(()=>{const t=document.querySelector('.main').innerText;return{sel:/選択中\s*\d+\s*圃場/.test(t),maekai:(t.match(/前回/g)||[]).length}})
    add('A2b 孤児が最新なら生存圃場でも初期選択されない(既知仕様確認)', st.sel===false, '注視:'+JSON.stringify(st))
    const order=await chipOrder(page)
    // 並びは 2,1（99は存在しないので落ちる）
    add('A2b 並びは生存圃場のみ 2→1', order&&order[0]==='第2圃場'&&order[1]==='第1圃場', JSON.stringify(order))
  })

  // ── 軸A-3: date が空 / 不正 / id巨大 ──
  await scenario(
    [F(1,'第1圃場'),F(2,'第2圃場'),F(3,'第3圃場')],
    [R(1,1,''),R(2,2,'不正な日付'),R(3,3,'2026-06-20',{id:9999999999999999})],
    async()=>{
      const e0=errBefore()
      const order=await chipOrder(page)
      const st=await page.evaluate(()=>{const t=document.querySelector('.main').innerText;return{sel:/選択中\s*1\s*圃場/.test(t)}})
      const badgeOwner=await page.evaluate(()=>{const main=document.querySelector('.main');const grid=[...main.querySelectorAll('div')].find(d=>d.style&&d.style.maxHeight==='240px');const badges=[...grid.querySelectorAll('span')].filter(s=>s.textContent.trim()==='前回');return badges.length?(badges[0].closest('button').textContent.match(/第\d圃場/)||[])[0]:null})
      add('A3 空/不正date・巨大idで例外なし', noNewErr(e0))
      add('A3 最新(第3,2026-06-20)が先頭', order&&order[0]==='第3圃場', 'order='+JSON.stringify(order)+' 前回バッジ='+badgeOwner)
      add('A3 初期選択される', st.sel)
    })

  // ── 軸A-4: 圃場多数(24件)＋一部に記録 ──
  {
    const many=[]; for(let i=1;i<=24;i++)many.push(F(i,'圃場'+i))
    const recs=[R(201,7,'2026-06-01'),R(202,20,'2026-06-10'),R(203,3,'2026-06-25')] // 最新=3
    await scenario(many,recs,async()=>{
      const e0=errBefore()
      const order=await chipOrder(page)
      const st=await page.evaluate(()=>{const t=document.querySelector('.main').innerText;return{sel:/選択中\s*1\s*圃場/.test(t),maekai:(t.match(/前回/g)||[]).length}})
      add('A4 多数圃場: 先頭が最新(圃場3)', order&&order[0]==='圃場3', JSON.stringify(order&&order.slice(0,4)))
      add('A4 多数圃場: 2番目が圃場20', order&&order[1]==='圃場20', JSON.stringify(order&&order.slice(0,4)))
      add('A4 多数圃場: 3番目が圃場7', order&&order[2]==='圃場7')
      add('A4 多数圃場: 未使用圃場も欠落せず全24件', order&&order.length===24, 'len='+(order&&order.length))
      add('A4 多数圃場: 重複なし', order&&new Set(order).size===order.length)
      add('A4 多数圃場: 前回バッジ1つ', st.maekai===1, 'count='+st.maekai)
      add('A4 多数圃場: 初期選択1', st.sel)
      add('A4 多数圃場: 例外なし', noNewErr(e0))
    })
  }

  // ── 軸A-5: 同一date（tie）はid(padStart)で新しいidが優先 ──
  await scenario(
    [F(1,'第1圃場'),F(2,'第2圃場')],
    [R(100,1,'2026-06-20'),R(200,2,'2026-06-20')], // 同date, id 200>100 → 第2が新しい扱い
    async()=>{
      const order=await chipOrder(page)
      add('A5 同date tie: 大きいid(第2)が先頭', order&&order[0]==='第2圃場', JSON.stringify(order))
    })

  // ── 軸B: 並べ替え×検索×選択×クリア ──
  {
    const many=[]; for(let i=1;i<=8;i++)many.push(F(i,'第'+i+'圃場'))
    const recs=[R(301,5,'2026-06-01'),R(302,2,'2026-06-20')] // 最新=2
    await scenario(many,recs,async()=>{
      const e0=errBefore()
      // 初期: 第2が先頭・初期選択
      const order1=await chipOrder(page)
      add('B 初期並び先頭=第2', order1&&order1[0]==='第2圃場', JSON.stringify(order1&&order1.slice(0,3)))
      // 追加で第7を複数選択（field_ids）
      await page.evaluate(()=>{const main=document.querySelector('.main');const grid=[...main.querySelectorAll('div')].find(d=>d.style&&d.style.maxHeight==='240px');const btn=[...grid.querySelectorAll('button')].find(b=>/第7圃場/.test(b.textContent));if(btn)btn.click()})
      await sleep(200)
      let st=await page.evaluate(()=>{const t=document.querySelector('.main').innerText;return{selN:(t.match(/選択中\s*(\d+)\s*圃場/)||[])[1]}})
      add('B 複数選択で選択中2', st.selN==='2', 'selN='+st.selN)
      // 検索「第7」→絞り込み優先(並べ替えしない)
      await page.evaluate(()=>{const inp=[...document.querySelectorAll('input')].find(i=>/絞り込み/.test(i.placeholder||''));const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp,'第7');inp.dispatchEvent(new Event('input',{bubbles:true}))})
      await sleep(300)
      const searchOrder=await chipOrder(page)
      add('B 検索で第7のみ表示', searchOrder&&searchOrder.length===1&&searchOrder[0]==='第7圃場', JSON.stringify(searchOrder))
      // 選択状態が検索で消えていないか（第7はまだ選択中）
      const sel7=await page.evaluate(()=>{const main=document.querySelector('.main');const grid=[...main.querySelectorAll('div')].find(d=>d.style&&d.style.maxHeight==='240px');const btn=[...grid.querySelectorAll('button')].find(b=>/第7圃場/.test(b.textContent));return btn?/✓/.test(btn.textContent):null})
      add('B 検索中も第7の選択維持', sel7===true, 'sel7='+sel7)
      // 検索クリア→並びが最近順に戻る＆選択維持(第2,第7)
      await page.evaluate(()=>{const inp=[...document.querySelectorAll('input')].find(i=>/絞り込み/.test(i.placeholder||''));const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp,'');inp.dispatchEvent(new Event('input',{bubbles:true}))})
      await sleep(300)
      const order2=await chipOrder(page)
      st=await page.evaluate(()=>{const t=document.querySelector('.main').innerText;return{selN:(t.match(/選択中\s*(\d+)\s*圃場/)||[])[1]}})
      add('B クリア後 先頭が最近順(第2)に復帰', order2&&order2[0]==='第2圃場', JSON.stringify(order2&&order2.slice(0,3)))
      add('B クリア後 選択中2維持', st.selN==='2', 'selN='+st.selN)
      add('B クリア後 重複なし', order2&&new Set(order2).size===order2.length)
      add('B 例外なし', noNewErr(e0))
    })
  }

  // ── 軸C: 保存への波及（前回圃場でそのまま保存→正しいfield_id） ──
  {
    const fields=[F(1,'第1圃場'),F(2,'第2圃場'),F(3,'第3圃場')]
    const recs=[R(401,1,'2026-06-01'),R(402,3,'2026-06-25')] // 最新=3
    await scenario(fields,recs,async()=>{
      const e0=errBefore()
      const before=await page.evaluate((fid)=>JSON.parse(localStorage.getItem('farm_records_'+fid)||'[]').length,farmId)
      // step1: そのまま(第3が初期選択)で作業内容へ
      await clickText(page,'次へ'); await sleep(400)
      // 作業内容: 除草を選ぶ
      await page.evaluate(()=>{const b=[...document.querySelectorAll('button,div[role=button],div')].find(e=>e.offsetParent&&e.textContent.trim()==='除草');if(b)b.click()})
      await sleep(300)
      await clickText(page,'次へ'); await sleep(400) // step2→step3 農薬/施肥
      await clickText(page,'確認'); await sleep(400) // step3→step4 確認
      await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.offsetParent&&/保存する/.test(e.textContent)&&!/続けて/.test(e.textContent));if(b)b.click()})
      await sleep(800)
      const after=await page.evaluate((fid)=>JSON.parse(localStorage.getItem('farm_records_'+fid)||'[]'),farmId)
      const newRec=after[after.length-1]
      add('C 保存後件数+1', after.length===before+1, before+'→'+after.length)
      add('C 前回圃場のまま保存→field_id=3', newRec&&Number(newRec.field_id)===3, 'field_id='+(newRec&&newRec.field_id))
      add('C 例外なし', noNewErr(e0))
    })
  }

  // ── 軸C-2: 別圃場に変えて保存→古い初期値が残らない ──
  {
    const fields=[F(1,'第1圃場'),F(2,'第2圃場'),F(3,'第3圃場')]
    const recs=[R(501,3,'2026-06-25')] // 最新=3（初期選択）
    await scenario(fields,recs,async()=>{
      const e0=errBefore()
      const before=await page.evaluate((fid)=>JSON.parse(localStorage.getItem('farm_records_'+fid)||'[]').length,farmId)
      // 初期選択の第3を外し、第1だけ選ぶ
      await page.evaluate(()=>{const main=document.querySelector('.main');const grid=[...main.querySelectorAll('div')].find(d=>d.style&&d.style.maxHeight==='240px')
        const b3=[...grid.querySelectorAll('button')].find(b=>/第3圃場/.test(b.textContent));if(b3)b3.click() // 外す
      })
      await sleep(200)
      await page.evaluate(()=>{const main=document.querySelector('.main');const grid=[...main.querySelectorAll('div')].find(d=>d.style&&d.style.maxHeight==='240px')
        const b1=[...grid.querySelectorAll('button')].find(b=>/第1圃場/.test(b.textContent));if(b1)b1.click() // 第1入れる
      })
      await sleep(200)
      const selNow=await page.evaluate(()=>{const t=document.querySelector('.main').innerText;return(t.match(/選択中\s*(\d+)\s*圃場/)||[])[1]})
      add('C2 第3外し第1入れ→選択中1', selNow==='1', 'selN='+selNow)
      await clickText(page,'次へ'); await sleep(400)
      await page.evaluate(()=>{const b=[...document.querySelectorAll('button,div')].find(e=>e.offsetParent&&e.textContent.trim()==='除草');if(b)b.click()})
      await sleep(300)
      await clickText(page,'次へ'); await sleep(400)
      await clickText(page,'確認'); await sleep(400)
      await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.offsetParent&&/保存する/.test(e.textContent)&&!/続けて/.test(e.textContent));if(b)b.click()})
      await sleep(800)
      const after=await page.evaluate((fid)=>JSON.parse(localStorage.getItem('farm_records_'+fid)||'[]'),farmId)
      const newRec=after[after.length-1]
      add('C2 変更後保存→field_id=1(古い初期値残らない)', newRec&&Number(newRec.field_id)===1, 'field_id='+(newRec&&newRec.field_id))
      add('C2 保存後件数+1', after.length===before+1, before+'→'+after.length)
      add('C2 例外なし', noNewErr(e0))
    })
  }

  // ── 軸D: 前回バッジは最新1つだけ（複数記録でも1つ） ──
  await scenario(
    [F(1,'第1圃場'),F(2,'第2圃場'),F(3,'第3圃場')],
    [R(601,1,'2026-06-01'),R(602,2,'2026-06-10'),R(603,3,'2026-06-25'),R(604,3,'2026-06-26')],
    async()=>{
      const st=await page.evaluate(()=>{
        const main=document.querySelector('.main')
        const grid=[...main.querySelectorAll('div')].find(d=>d.style&&d.style.maxHeight==='240px')
        const badges=[...grid.querySelectorAll('span')].filter(s=>s.textContent.trim()==='前回')
        const owner=badges.length?(badges[0].closest('button').textContent.match(/第\d圃場/)||[])[0]:null
        return {n:badges.length, owner}
      })
      add('D 前回バッジは1つだけ', st.n===1, 'n='+st.n)
      add('D 前回バッジは最新の第3圃場', st.owner==='第3圃場', 'owner='+st.owner)
    })

  // ── 軸E: リグレッション（記録0件で例外なく開ける・保存フロー健全） ──
  await scenario([F(1,'第1圃場'),F(2,'第2圃場')],[],async()=>{
    const e0=errBefore()
    const st=await page.evaluate(()=>{const t=document.querySelector('.main').innerText;return{sel:/選択中\s*\d+\s*圃場/.test(t),maekai:(t.match(/前回/g)||[]).length}})
    add('E 記録0件: 自動選択されない', st.sel===false)
    add('E 記録0件: 前回バッジ無し', st.maekai===0)
    add('E 記録0件: 例外なし', noNewErr(e0))
  })

  // ── 集計 ──
  console.log('\n=== 複合シナリオ判定 ===')
  let fail=0
  for(const [n,ok,detail] of checks){ console.log((ok?'✅':'❌')+' '+n+(ok?'':'  << '+detail)) ; if(!ok)fail++ }
  console.log('\n--- JSエラー全件 ---')
  console.log(errors.length?errors.join('\n'):'(なし)')
  console.log(`\n${checks.length-fail}/${checks.length} passed, ${fail} failed`)
  await b.close(); server.close(); process.exit(fail?1:0)
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2)})
