// qa_repo_supabase.js — フェーズ4 SupabaseRepository/ルーターの検証（Node・モックSupabase・本番未接続）
// 実際のSupabaseに触れず、read/write(全置換)/subscribe とルーター振り分けの論理を検証する。
const checks = []
const ok = (name, cond, extra) => checks.push({ name, pass: !!cond, extra: extra == null ? '' : String(extra) })

// ── モックSupabaseクライアント（インメモリのテーブル） ──
function makeMockSb() {
  const tables = {}
  const api = {
    _tables: tables,
    _channels: [],
    from(table) {
      tables[table] = tables[table] || []
      const q = {
        _table: table, _filter: null,
        select() { return this },
        eq(col, val) { this._filter = { col, val }; return this },
        async delete() {
          if (this._filter) tables[table] = tables[table].filter(r => r[this._filter.col] !== this._filter.val)
          else tables[table] = []
          return { error: null }
        },
        async insert(rows) { tables[table].push(...rows); return { error: null } },
        then(resolve) { // select結果を await できるように（eqで絞り込み）
          let rows = tables[table]
          if (this._filter) rows = rows.filter(r => r[this._filter.col] === this._filter.val)
          resolve({ data: rows.map(r => Object.assign({}, r)), error: null })
        },
      }
      return q
    },
    channel(name) {
      const ch = { _name: name, _cb: null,
        on(_ev, _opts, cb) { this._cb = cb; return this },
        subscribe() { api._channels.push(this); return this },
      }
      return ch
    },
    removeChannel() {},
    _emit(table) { this._channels.forEach(ch => { if (ch._name.indexOf(table) >= 0 && ch._cb) ch._cb({}) }) },
  }
  return api
}

global.sb = makeMockSb()
const { farmRepo, FarmRepositories, FarmRepoInternals } = require('../js/repository.js')
const { SupabaseRepository } = FarmRepositories

const ORG = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const FARM = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const KEY = 'farm_shipment_destinations_' + FARM

;(async () => {
  // 1) コレクション名/farmId 抽出
  ok('R1 キーからコレクション名とfarmIdを抽出',
    FarmRepoInternals.collectionOf(KEY) === 'farm_shipment_destinations' && FarmRepoInternals.farmIdOf(KEY) === FARM)

  // 2) ルーター既定は localStorage（何もrouteしていない＝挙動不変）
  ok('R2 既定ルーターはSupabaseへ向かない（未route時）', farmRepo.routes && Object.keys(farmRepo.routes).length === 0)

  // 3) 出荷先マスタを Supabase にrouteして write（全置換）
  farmRepo.setContext({ orgId: ORG })
  farmRepo.route('farm_shipment_destinations', SupabaseRepository)
  const value = [
    { key: 'ja', label: 'JA木更津', frequent: true, sort_order: 0 },
    { key: 'yk', label: 'ヨーカドー', frequent: false, sort_order: 1 },
  ]
  const w = await farmRepo.write(KEY, value)
  const rowsInDb = global.sb._tables['farm_shipment_destinations'] || []
  ok('R3 write成功・DBに2行・org_id/farm_id付与',
    w.ok && rowsInDb.length === 2 && rowsInDb.every(r => r.org_id === ORG && r.farm_id === FARM),
    JSON.stringify({ ok: w.ok, n: rowsInDb.length }))

  // 4) readAsync で DB→アプリ形（配列・sort_order順）に復元
  const r = await farmRepo.readAsync(KEY)
  ok('R4 readAsyncでDB→アプリ形に復元（sort順・key/label保持）',
    r.ok && r.found && Array.isArray(r.value) && r.value.length === 2 &&
    r.value[0].key === 'ja' && r.value[0].label === 'JA木更津' && r.value[0].frequent === true &&
    r.value[1].key === 'yk',
    JSON.stringify(r.value))

  // 5) 全置換の確認: もう一度別内容でwriteしたら古い行が残らない
  await farmRepo.write(KEY, [{ key: 'direct', label: '直売', frequent: false, sort_order: 0 }])
  const r2 = await farmRepo.readAsync(KEY)
  ok('R5 全置換で古い行が残らない', r2.value.length === 1 && r2.value[0].key === 'direct', JSON.stringify(r2.value))

  // 6) subscribe: DB変更通知でコールバックに最新値が届く
  let pushed = null
  const unsub = farmRepo.subscribe(KEY, (val) => { pushed = val })
  global.sb._emit('farm_shipment_destinations')
  await new Promise(res => setTimeout(res, 20))
  ok('R6 リアルタイム購読で最新値が届く', Array.isArray(pushed) && pushed.length === 1 && pushed[0].key === 'direct', JSON.stringify(pushed))
  unsub()

  // 7) route解除で localStorage に戻る（未対応キーはSupabaseに行かない安全確認）
  farmRepo.unroute('farm_shipment_destinations')
  ok('R7 unrouteでSupabase経路が外れる', Object.keys(farmRepo.routes).length === 0)

  // 8) 未対応コレクションをSupabaseへ向けたら ok:false（誤爆でデータ消失しない）
  farmRepo.route('farm_harvest_records', SupabaseRepository) // CONVERTER未実装
  const wBad = await farmRepo.write('farm_harvest_records_' + FARM, [{ id: 1 }])
  ok('R8 変換未実装コレクションはwrite失敗を返す（安全に弾く）', wBad && wBad.ok === false)
  farmRepo.unroute('farm_harvest_records')

  const pass = checks.filter(c => c.pass).length
  const summary = { pass, total: checks.length, failed: checks.filter(c => !c.pass) }
  console.log('QAREPO_BEGIN'); console.log(JSON.stringify(summary, null, 1)); console.log('QAREPO_END')
  process.exit(pass === checks.length ? 0 : 1)
})()
