import {buildApp} from '../../src/api/app.js';
import {config} from '../../src/api/config.js';
import {id} from '../../src/api/lib/crypto.js';
import {CodexRuntimeAdapter} from '../../src/worker/codex/runtime.js';
import {ReferenceIdentityService} from '../../src/worker/generation/reference-service.js';
import {ToolConsumer} from '../../src/worker/tool-gateway/consumer.js';
import {reviewTools} from '../../src/worker/tool-gateway/review-tools.js';
import type {TestDatabase} from './database.js';
import type {mediaFixture} from './media.js';
import {syntheticSse} from './codex.js';
import {FixtureLauncher} from './role-launcher.js';

/** Real HTTPS/MCP, database and image bytes; synthetic inference and isolation.
 * Uses the project build for the bridge; never manufactures an approval row. */
export async function reviewGeneratedReferences(db:TestDatabase,f:Awaited<ReturnType<typeof mediaFixture>>,mode='NORMAL'){
  const cfg=config({...f.cfg,runtimeRoot:db.cfg.runtimeRoot});
  const app=await buildApp({cfg,pool:db.pool,inferenceHttp:async()=>({status:200,headers:{'content-type':'text/event-stream'},
    bytes:syntheticSse(f.admission),json:()=>null})});
  const controller=new AbortController();let task:Promise<void>|undefined;
  try{
    await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();
    if(!address||typeof address==='string')throw new Error('Missing reference review listener');
    cfg.publicBaseUrl=`https://localhost:${address.port}`;
    task=new ToolConsumer(db.pool,id('reference_test_tools'),reviewTools(db.pool,cfg,f.store)).run(controller.signal);
    const launcher=new FixtureLauncher(mode),executor=new CodexRuntimeAdapter(db.pool,cfg,launcher);
    return await new ReferenceIdentityService(db.pool,cfg,f.store,executor).review(f.lease,controller.signal);
  }finally{controller.abort();await task;await app.close();}
}
