import {beforeAll,afterAll,afterEach,it,expect} from 'vitest';
import type {FastifyInstance} from 'fastify';
import {testDatabase,type TestDatabase} from '../helpers/database.js';
import {runningContentFixture} from '../helpers/codex.js';
import {buildApp} from '../../src/api/app.js';
import {insert} from '../../src/api/db/store.js';
import {id,sha256,addSeconds} from '../../src/api/lib/crypto.js';

let db:TestDatabase;let app:FastifyInstance|undefined;
beforeAll(async()=>{db=await testDatabase();});
afterEach(async()=>{await app?.close();app=undefined;await db.pool.query("UPDATE stage_runs SET state='CANCELLED' WHERE state NOT IN ('SUCCEEDED','FAILED')");});
afterAll(async()=>{await db?.close();});
const tools='/v1/internal/p01/agent-tools';
async function start(){app=await buildApp({cfg:db.cfg,pool:db.pool,tls:false});await app.ready();return app;}
it('keeps live runs independent of shared IP traffic while bounding all internal routes together',async()=>{
  const first=await runningContentFixture(db);const second=await runningContentFixture(db);const server=await start();
  const headers={authorization:`Bearer ${first.capability}`};
  for(let n=0;n<600;n++){
    const response=await server.inject({method:'GET',url:n%2?`${tools}/calls/missing-intent`:tools,headers});
    expect(response.statusCode,`live run request ${n+1}`).toBe(n%2?404:200);
    expect(response.headers['x-ratelimit-limit']).toBe('600');
  }
  const rejected=await server.inject({method:'POST',url:'/v1/internal/p01/agent-inference/responses',headers,payload:{}});
  expect(rejected.statusCode).toBe(429);expect(rejected.json().code).toBe('RATE_LIMITED');
  expect((await server.inject({method:'GET',url:tools,headers:{authorization:`Bearer ${second.capability}`}})).statusCode).toBe(200);
  expect((await server.inject({method:'GET',url:'/healthz'})).statusCode).toBe(200);
  expect((await db.pool.query('SELECT count(*) FROM inference_requests')).rows[0].count).toBe('0');
});
it('keeps unknown and revoked tokens in the same IP bucket without starving a live run',async()=>{
  const live=await runningContentFixture(db);const revoked=await runningContentFixture(db);const server=await start();
  await db.pool.query('UPDATE agent_capabilities SET revoked_at=now() WHERE run_id=$1',[revoked.runId]);
  for(let n=0;n<180;n++){
    const response=await server.inject({method:'GET',url:n%2?`${tools}/calls/missing-intent`:tools,
      headers:{authorization:`Bearer ${n%3? id('unknown'):revoked.capability}`}});
    expect(response.statusCode).toBe(401);expect(response.headers['x-ratelimit-limit']).toBe('180');
  }
  expect((await server.inject({method:'GET',url:tools,headers:{authorization:`Bearer ${id('unknown')}`}})).statusCode).toBe(429);
  expect((await server.inject({method:'POST',url:'/v1/internal/p01/agent-inference/responses',headers:{authorization:`Bearer ${revoked.capability}`},payload:{}})).statusCode).toBe(429);
  expect((await server.inject({method:'GET',url:'/healthz'})).statusCode).toBe(429);
  expect((await server.inject({method:'GET',url:tools,headers:{authorization:`Bearer ${live.capability}`}})).statusCode).toBe(200);
});
it('does not renew a run quota by rotating capabilities or using a different IP',async()=>{
  const f=await runningContentFixture(db);const server=await start();const other=id('capability');
  await insert(db.pool,'agent_capabilities',{id:id('cap'),token_hash:sha256(other),tenant_id:f.p.tenantId,instance_id:f.instanceId,
    run_id:f.runId,stage_run_id:f.lease.id,stage_fencing_token:f.lease.fencing_token,instance_fencing_token:1,
    snapshot_hash:f.lease.input_hash,expires_at:addSeconds(120)});
  for(let n=0;n<600;n++)expect((await server.inject({method:'GET',url:tools,
    remoteAddress:n%2?'127.0.0.2':'127.0.0.1',headers:{authorization:`Bearer ${n%2?other:f.capability}`}})).statusCode).toBe(200);
  expect((await server.inject({method:'GET',url:tools,remoteAddress:'127.0.0.3',headers:{authorization:`Bearer ${other}`}})).statusCode).toBe(429);
  await db.pool.query('UPDATE agent_capabilities SET revoked_at=now() WHERE run_id=$1',[f.runId]);
  const ended=await server.inject({method:'GET',url:tools,remoteAddress:'127.0.0.3',headers:{authorization:`Bearer ${other}`}});
  expect(ended.statusCode).toBe(401);expect(ended.headers['x-ratelimit-limit']).toBe('180');
});
