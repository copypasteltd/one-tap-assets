import {beforeAll,afterAll,it,expect} from 'vitest';
import {metricsEnvironment} from '../helpers/metrics';
let env:Awaited<ReturnType<typeof metricsEnvironment>>;
beforeAll(async()=>{env=await metricsEnvironment();});afterAll(async()=>{await env?.close();});
const path=(window:Record<string,string>)=>`/v1/internal/p01/metrics/summary?${new URLSearchParams(window)}`;
it('requires independent metrics permission and audits a private aggregate without buyer identifiers',async()=>{
  const url=path(env.window);
  expect((await env.app.inject({url,headers:env.headers(env.buyer.accessToken)})).statusCode).toBe(401);
  expect((await env.app.inject({url,headers:env.headers(env.other)})).statusCode).toBe(403);
  const result=await env.app.inject({url,headers:env.headers()});expect(result.statusCode,result.body).toBe(200);
  expect(result.headers['cache-control']).toBe('no-store');
  for(const value of [...env.orders,env.buyer.principal.userId,env.buyer.principal.tenantId,env.reader,'object_key','private'])expect(result.body).not.toContain(value);
  const audit=await env.db.pool.query("SELECT actor,target,payload_hash FROM audit_events WHERE action='OPERATIONAL_SUMMARY_READ'");
  expect(audit.rows).toHaveLength(1);expect(audit.rows[0]).toMatchObject({actor:'synthetic-operator',target:'aggregate'});
});
it('honors both window boundaries and counts only paid first deliveries without revision or stage duplication',async()=>{
  const result=await env.app.inject({url:path(env.window),headers:env.headers()});expect(result.statusCode,result.body).toBe(200);
  expect(result.json().data).toEqual({...env.window,...env.expected,cost_currency:'CNY'});
  // Both the pre-window 99,999-second delivery and the order at the exact end
  // boundary must stay out. Redacted timing stays null, not zero or an error.
  const following={window_start:env.window.window_end,window_end:'2026-10-09T00:00:00.000Z'};
  const next=await env.app.inject({url:path(following),headers:env.headers()});expect(next.statusCode,next.body).toBe(200);
  expect(next.json().data).toMatchObject({paid_orders:1,delivered_orders:1,cost_micro_total:9000000,automatic_pack_success_ratio:1,
    route_p95_seconds:{PHOTO_LAYOUT:null,PER_SHOT_AI:null,REFERENCE_FILM:99999}});
});
it('returns truthful empty measures and rejects missing, malformed, duplicate and excessive windows',async()=>{
  const empty=await env.app.inject({url:path({window_start:'2026-10-15T00:00:00.000Z',window_end:'2026-10-16T00:00:00.000Z'}),headers:env.headers()});
  expect(empty.statusCode,empty.body).toBe(200);expect(empty.json().data).toMatchObject({paid_orders:0,delivered_orders:0,cost_micro_total:0,
    automatic_pack_success_ratio:null,unknown_submissions:0,refunds_pending:0,hard_deadline_failures:0,route_p95_seconds:{PHOTO_LAYOUT:null,PER_SHOT_AI:null,REFERENCE_FILM:null}});
  for(const window of [{},{...env.window,window_start:'2026-02-30T00:00:00Z'},{...env.window,window_start:env.window.window_end},
    {window_start:'2026-01-01T00:00:00Z',window_end:'2026-10-01T00:00:00Z'},{...env.window,window_start:'2026-10-01T08:00:00+08:00'}]){
    const response=await env.app.inject({url:path(window),headers:env.headers()});expect(response.statusCode,response.body).toBe(400);expect(response.json().code).toBe('METRICS_WINDOW_INVALID');
  }
  const repeated=await env.app.inject({url:path(env.window)+'&window_start=2026-10-02T00:00:00Z',headers:env.headers()});expect(repeated.statusCode).toBe(400);
});
