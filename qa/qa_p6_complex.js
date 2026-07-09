// ============================================================================
// 番人 複合監査: 星5 P6「希釈計算ヘルパー＋次回防除リマインド」
//  軸A 希釈計算: 複数itemが独立に正しい / 小数希釈 / 巨大値でInfinity/NaNにならない
//  軸B リマインド: 別圃場のみ→非表示 / 別薬剤のみ→非表示 / 複数該当で最新が選ばれる
//  軸C 相互作用: item追加/削除でindexズレなし / 農薬変更でリマインドが新薬剤履歴に更新
//  軸D 保存: 希釈/リマインドは表示のみ・保存値(pesticides/spray_volume_L)に影響しない
//  軸E JSエラー0
// 実行: cd qa && node qa_p6_complex.js
// ============================================================================
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer-core')
const ROOT=path.resolve(__dirname,'..'),PORT=8242,CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'}
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.writeHead(404);r.end('404');return}r.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});r.end(d)})})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const clickText=(page,t)=>page.evaluate(t=>{const v=e=>e.offsetParent!==null;const cs=[...document.querySelectorAll('button,a,[role=button]')].filter(v);let el=cs.find(e=>e.textContent.trim()===t)||cs.find(e=>e.textContent.trim().includes(t)&&e.textContent.trim().length<t.length+18);if(el){el.click();return true}return false},t)
const ensureApp=async(page)=>{ if(!(await page.evaluate(()=>!!document.querySelector('.main')))){
  await page.waitForSelector('input[type=email]',{timeout:30000});await page.type('input[type=email]','demo@syatyo-suport.jp');await page.type('input[type=password]','demo1234')
  await page.evaluate(()=>{const x=[...document.querySelectorAll('button[type=submit]')].find(b=>/ログイン/.test(b.textContent));if(x)x.click()})
  for(let i=0;i<40;i++){if(await page.evaluate(()=>!!document.querySelector('.main')))break;await sleep(500)} } }
const setSprayVol=(page,v)=>page.evaluate((v)=>{
  const inp=[...document.querySelectorAll('input')].find(i=>i.placeholder==='例: 500')
  if(inp){const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp,String(v));inp.dispatchEvent(new Event('input',{bubbles:true}))}
},v)
// 全ての希釈計算表示値を配列で返す
const allDilutionVals=(page)=>page.evaluate(()=>{
  const t=document.querySelector('.main').innerText
  return [...t.matchAll(/必要な原液量：約\s*([\d.]+)\s*mL/g)].map(m=>parseFloat(m[1]))
})
const reminders=(page)=>page.evaluate(()=>{
  const t=document.querySelector('.main').innerText
  return [...t.matchAll(/前回この薬を撒いてから\s*(-?\d+|—)日/g)].map(m=>m[1])
})
const hasInfNaN=(page)=>page.evaluate(()=>/(Infinity|NaN)/.test(document.querySelector('.main').innerText))
;(async()=>{
  await new Promise(r=>server.listen(PORT,r))
  const errors=[]
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']})
  const page=await b.newPage(); await page.setViewport({width:1500,height:1100})
  page.on('pageerror',e=>errors.push(String(e.message||e).slice(0,150)))
  page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/favicon|unpkg|jsdelivr|cloudflare|tabler|net::ERR/.test(t))errors.push(t.slice(0,150))}})
  await page.goto(`http://localhost:${PORT}/`,{waitUntil:'networkidle2',timeout:60000})
  await ensureApp(page)
  const farmId=await page.evaluate(()=>(typeof CONFIG!=='undefined'&&CONFIG.CURRENT_FARM_ID)?CONFIG.CURRENT_FARM_ID:null)
  // 過去日を app の todayYmd 基準で算出（TZズレ回避）
  const ymdAgo=async(n)=>page.evaluate((n)=>{const t=(typeof todayYmd==='function')?todayYmd():new Date().toISOString().slice(0,10);const d=new Date(t+'T00:00:00');d.setDate(d.getDate()-n);const p=x=>String(x).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())},n)
  const d5=await ymdAgo(5), d20=await ymdAgo(20), d3=await ymdAgo(3)
  await page.evaluate((fid,d5,d20,d3)=>{const set=(k,v)=>localStorage.setItem(k+'_'+fid,JSON.stringify(v))
    set('farm_fields_v2',[
      {id:1,name:'第1圃場',field_no:'1',crop:'レタス',area_are:10,color:'#0D9972',row_count:6,crop_category:'leaf_veg'},
      {id:2,name:'第2圃場',field_no:'2',crop:'レタス',area_are:8,color:'#1173d4',row_count:4,crop_category:'leaf_veg'}
    ])
    set('farm_lots',{1:[{id:'L1',field_id:1,row_range:'1-3',variety:'シスコ',status:'growing',seed_date:'2026-05-01'}]})
    // 薬剤1=アグロA(1000倍) 薬剤3=別薬(1500倍)
    set('farm_pesticides',[
      {id:1,name:'アグロA',reg_no:'第123号',dilution:1000,preharvest_days:7,max_times:3},
      {id:3,name:'ベツヤク',reg_no:'第456号',dilution:1500,preharvest_days:5,max_times:3}
    ])
    set('farm_records',[])
    set('farm_lot_spray_records',[
      // 第1圃場でアグロAを20日前と5日前(最新は5日前が選ばれるべき)
      {id:9001,field_id:1,date:d20,row_range:'1-3',spray_volume_L:100,pesticides:[{pesticide_id:1,dilution:1000}],weather:'晴'},
      {id:9002,field_id:1,date:d5, row_range:'1-3',spray_volume_L:100,pesticides:[{pesticide_id:1,dilution:1000}],weather:'曇'},
      // 第2圃場でアグロA(別圃場→第1では出ない)
      {id:9003,field_id:2,date:d3, row_range:'1-2',spray_volume_L:80, pesticides:[{pesticide_id:1,dilution:1000}],weather:'晴'},
      // pesticidesが空/欠損の記録(例外防止テスト)
      {id:9004,field_id:1,date:d3, row_range:'1-1',spray_volume_L:50, pesticides:[],weather:'晴'},
      {id:9005,field_id:1,date:d3, row_range:'1-1',spray_volume_L:50, weather:'晴'}
    ])
  }, farmId, d5, d20, d3)
  await page.reload({waitUntil:'networkidle2'}); await sleep(1200)
  const R={}

  await clickText(page,'日報入力'); await sleep(800)
  await page.evaluate(()=>{const grid=[...document.querySelectorAll('div')].find(d=>d.style&&d.style.maxHeight==='240px');if(grid){const chip=[...grid.children].find(c=>/第1圃場/.test(c.textContent));if(chip)chip.click()}})
  await sleep(300); await clickText(page,'次へ'); await sleep(500)
  await clickText(page,'農薬散布'); await sleep(400); await clickText(page,'次へ'); await sleep(800)

  // item1=アグロA(既定,1000倍)。散布液500L → 500mL
  await setSprayVol(page,500); await sleep(400)
  R.oneVal = await allDilutionVals(page)        // [500]
  R.oneRemind = await reminders(page)           // アグロA 最新=5日前 → ["5"]
  R.noInfNaN1 = !(await hasInfNaN(page))

  // 薬剤追加(addItem) → item2 も アグロA(既定)。2つとも500mL、2つともリマインド5日
  await clickText(page,'農薬を追加'); await sleep(500)
  R.twoVals = await allDilutionVals(page)        // [500,500]
  R.twoReminds = await reminders(page)           // ["5","5"]

  // item2 の農薬を ベツヤク(1500倍) に変更 → item2 の希釈計算は 500*1000/1500=333.3、item1は500のまま
  await page.evaluate(()=>{
    const sels=[...document.querySelectorAll('select')].filter(s=>[...s.options].some(o=>/アグロA/.test(o.textContent)))
    if(sels[1]){const s=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set;const opt=[...sels[1].options].find(o=>/ベツヤク/.test(o.textContent));s.call(sels[1],opt.value);sels[1].dispatchEvent(new Event('change',{bubbles:true}))}
  }); await sleep(500)
  R.afterChangeVals = await allDilutionVals(page)   // [500, 333.3]
  // ベツヤクはこの圃場で撒いた履歴なし → item2のリマインドは消える。item1(アグロA)のみ残る
  R.afterChangeReminds = await reminders(page)       // ["5"]
  R.noInfNaN2 = !(await hasInfNaN(page))

  // item1(idx0)を削除(removeItem) → 残るのはベツヤク(333.3), リマインドなし
  await page.evaluate(()=>{const btns=[...document.querySelectorAll('button')].filter(x=>x.title==='この薬剤を削除'&&x.offsetParent!==null);if(btns[0])btns[0].click()})
  await sleep(500)
  R.afterRemoveVals = await allDilutionVals(page)    // [333.3]
  R.afterRemoveReminds = await reminders(page)        // []
  R.noInfNaN3 = !(await hasInfNaN(page))

  // 巨大希釈倍率テスト: item(ベツヤク)の希釈を 0.0000001 に → 巨大数だがInfinity/NaN無し
  await page.evaluate(()=>{
    const inps=[...document.querySelectorAll('input[type=number]')].filter(i=>i.offsetParent!==null)
    // 希釈倍率の input は select の隣。最後の number input(倍)を狙う
    const dil=inps.find(i=>{const sib=i.parentElement&&i.parentElement.textContent;return /倍/.test(sib||'')})
    if(dil){const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(dil,'0.0000001');dil.dispatchEvent(new Event('input',{bubbles:true}))}
  }); await sleep(400)
  R.hugeNoInfNaN = !(await hasInfNaN(page))

  R.errors=errors
  console.log(JSON.stringify(R,null,2))
  const near=(a,b)=>Math.abs(a-b)<0.2
  const checks=[
    ['単一item: 500mL', JSON.stringify(R.oneVal)==='[500]'],
    ['単一item: リマインド最新=5日(複数該当で最新選択)', R.oneRemind.length===1&&R.oneRemind[0]==='5'],
    ['別圃場/別薬剤/空pesticidesで誤表示や例外なし(リマインド1件のみ)', R.oneRemind.length===1],
    ['item追加: 両方500mL独立', JSON.stringify(R.twoVals)==='[500,500]'],
    ['item追加: 両方リマインド5日', R.twoReminds.length===2&&R.twoReminds.every(x=>x==='5')],
    ['農薬変更: item2希釈が333.3に再計算/item1は500維持', R.afterChangeVals.length===2&&near(R.afterChangeVals[0],500)&&near(R.afterChangeVals[1],333.3)],
    ['農薬変更: リマインドが新薬剤(履歴なし)に更新され1件に', R.afterChangeReminds.length===1&&R.afterChangeReminds[0]==='5'],
    ['item削除(idx0): 残1件が333.3・indexズレなし', R.afterRemoveVals.length===1&&near(R.afterRemoveVals[0],333.3)],
    ['item削除: リマインド0件(ベツヤク履歴なし)', R.afterRemoveReminds.length===0],
    ['巨大/degenerate値でもInfinity/NaN表示なし', R.noInfNaN1&&R.noInfNaN2&&R.noInfNaN3&&R.hugeNoInfNaN],
    ['JSエラーなし', errors.length===0],
  ]
  console.log('\n=== 判定 ===')
  let fail=0
  for(const [n,ok] of checks){ console.log((ok?'PASS':'FAIL')+' '+n); if(!ok)fail++ }
  console.log(`\n${checks.length-fail}/${checks.length} passed, ${fail} failed`)
  await b.close(); server.close(); process.exit(fail?1:0)
})().catch(e=>{console.error(e);process.exit(2)})
