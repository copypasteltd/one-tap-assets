import {it,expect} from 'vitest';
import {readFile,readdir} from 'node:fs/promises';
import pg from 'pg';
import {testDatabase,orderFixture} from '../helpers/database.js';
import {insert} from '../../src/api/db/store.js';
import {migrate} from '../../src/api/db/migrate.js';
import {seed} from '../../src/api/db/seed.js';
import {id,sha256,addSeconds} from '../../src/api/lib/crypto.js';
import {reserve} from '../../src/worker/budget/reservations.js';
import {transaction} from '../../src/api/db/pool.js';
import {enqueueStage} from '../../src/worker/queue/enqueue.js';
import {claimStage} from '../../src/worker/queue/leases.js';

it('upgrades the original native ASR hold from migration 27 without refilling its allowance or changing its financial facts',async()=>{
  const host=await testDatabase(),name=id('ypcc_upgrade').replaceAll('-','');
  if(!/^ypcc_upgrade_[a-f0-9]{32}$/.test(name))throw new Error('Invalid owned migration schema');
  await host.pool.query(`CREATE SCHEMA ${name}`);
  const pool=new pg.Pool({connectionString:host.cfg.databaseUrl,options:`--search_path=${name}`,max:4});
  try{
    await pool.query('CREATE TABLE schema_migrations(version text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
    for(const file of (await readdir('src/api/db/migrations')).filter(f=>f.endsWith('.sql')&&f<'028_').sort()){
      const sql=await readFile('src/api/db/migrations/'+file,'utf8');await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations(version,sha256) VALUES($1,$2)',[file,sha256(sql)]);
    }
    await seed(pool);const db={...host,pool},f=await orderFixture(db,1000),deadline=addSeconds(600),model=id('synthetic_asr');
    await insert(pool,'provider_model_versions',{id:model,provider:'SYNTHETIC',actual_model:'SYNTHETIC',status:'ADMITTED',version:'SYNTHETIC',data:{}});
    const originalStage=await enqueueStage(pool,{tenantId:f.principal.tenantId,scopeType:'ORDER',scopeId:f.orderId,name:'POST',
      inputHash:'a'.repeat(64),deadlineAt:deadline});
    expect((await claimStage(pool,id('migration'),['POST']))!.id).toBe(originalStage);
    const cost=await transaction(pool,q=>reserve(q,{tenantId:f.principal.tenantId,orderId:f.orderId},id('original-asr'),100,{}));
    await pool.query("UPDATE budget_reservations SET state='UNKNOWN' WHERE id=$1",[cost]);
    const original={id:id('original_asr'),tenant_id:f.principal.tenantId,order_id:f.orderId,stage_run_id:originalStage,
      generation_kind:'ASR',model_version_id:model,operation_key:'asr:original',intent_key:id('original'),input_hash:'b'.repeat(64),
      state:'UNKNOWN',reservation_id:cost,data:{},private:{audio_contract_hash:'c'.repeat(64),receipts:[]}};
    await insert(pool,'provider_submissions',original);
    const order=(await pool.query('SELECT * FROM orders WHERE id=$1',[f.orderId])).rows[0],money=(await pool.query('SELECT * FROM budget_reservations WHERE id=$1',[cost])).rows[0];
    const prior=(await pool.query('SELECT * FROM provider_submissions WHERE id=$1',[original.id])).rows[0];
    await migrate(pool);await migrate(pool);
    expect((await pool.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n).toBe(28);
    expect((await pool.query('SELECT * FROM orders WHERE id=$1',[f.orderId])).rows[0]).toEqual(order);
    expect((await pool.query('SELECT * FROM budget_reservations WHERE id=$1',[cost])).rows[0]).toEqual(money);
    expect((await pool.query('SELECT * FROM provider_submissions WHERE id=$1',[original.id])).rows[0]).toEqual({...prior,native_asr_attempt:1});
    await expect(insert(pool,'provider_submissions',{...original,id:id('duplicate'),intent_key:id('duplicate'),operation_key:'asr:replacement',native_asr_attempt:1}))
      .rejects.toMatchObject({code:'23505'});
    await expect(pool.query('UPDATE provider_submissions SET native_asr_attempt=2 WHERE id=$1',[original.id])).rejects.toThrow('immutable');
    const repair=await enqueueStage(pool,{tenantId:f.principal.tenantId,scopeType:'ORDER',scopeId:f.orderId,name:'POST',attempt:2,
      inputHash:'a'.repeat(64),deadlineAt:deadline});
    await expect(insert(pool,'provider_submissions',{...original,id:id('ungranted'),intent_key:id('ungranted'),operation_key:'asr:ungranted',stage_run_id:repair,native_asr_attempt:2}))
      .rejects.toThrow('not frozen and authorized');
    expect((await pool.query('SELECT count(*)::int AS n FROM provider_submissions WHERE order_id=$1',[f.orderId])).rows[0].n).toBe(1);
  }finally{await pool.end();await host.pool.query(`DROP SCHEMA ${name} CASCADE`);await host.close();}
},60000);
