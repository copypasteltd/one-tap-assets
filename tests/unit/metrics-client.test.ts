import {it,expect,vi} from 'vitest';
import {MetricsClient,metricsRange} from '../../src/shared/client/metrics';
const range={window_start:'2026-10-01T00:00:00.000Z',window_end:'2026-10-08T00:00:00.000Z'};
const data={...range,paid_orders:5,delivered_orders:3,unknown_submissions:1,refunds_pending:1,hard_deadline_failures:1,cost_currency:'CNY',
  cost_micro_total:3100000,automatic_pack_success_ratio:.6,route_p95_seconds:{PHOTO_LAYOUT:60,PER_SHOT_AI:120,REFERENCE_FILM:null}};
it('binds an authenticated read to its canonical window and fixed same-origin endpoint without cookies or writes',async()=>{
  const transport=vi.fn(async()=>Response.json({data})),client=new MetricsClient(transport);
  await expect(client.read(range.window_start,range.window_end)).rejects.toMatchObject({code:'MANAGEMENT_LOGIN_REQUIRED'});
  client.connect('synthetic-independent-metrics');expect(await client.read(range.window_start,range.window_end)).toEqual(data);
  const call=transport.mock.calls[0] as unknown as [string,RequestInit];expect(call[0]).toBe('/v1/internal/p01/metrics/summary?'+new URLSearchParams(range));
  expect(call[1]).toMatchObject({method:'GET',credentials:'omit',redirect:'error',cache:'no-store',headers:{Authorization:'Bearer synthetic-independent-metrics'}});
  expect(call[1].body).toBeUndefined();client.disconnect();
});
it('rejects another window, impossible success ratios, unsafe money and fabricated route timings',async()=>{
  for(const changed of [{...data,window_end:'2026-10-09T00:00:00.000Z'},{...data,delivered_orders:6},{...data,automatic_pack_success_ratio:1},
    {...data,cost_micro_total:Number.MAX_SAFE_INTEGER+1},{...data,route_p95_seconds:{...data.route_p95_seconds,REFERENCE_FILM:-1}},
    {...data,private:'unexpected'}]){
    const client=new MetricsClient(async()=>Response.json({data:changed}));client.connect('synthetic');
    await expect(client.read(range.window_start,range.window_end)).rejects.toMatchObject({code:'MANAGEMENT_RESPONSE_INVALID'});client.disconnect();
  }
});
it('discards a late response after disconnect or a newer read, including transports which ignore abort',async()=>{
  const resolves:((r:Response)=>void)[]=[],client=new MetricsClient(()=>new Promise<Response>(done=>resolves.push(done)));client.connect('first');
  const old=client.read(range.window_start,range.window_end),oldAssertion=expect(old).rejects.toMatchObject({code:'MANAGEMENT_ACCOUNT_CHANGED'});
  client.disconnect();client.connect('second');resolves[0]!(Response.json({data}));await oldAssertion;
  const a=client.read(range.window_start,range.window_end),aAssertion=expect(a).rejects.toMatchObject({code:'MANAGEMENT_ACCOUNT_CHANGED'});
  const b=client.read(range.window_start,range.window_end);resolves[2]!(Response.json({data}));expect(await b).toEqual(data);
  resolves[1]!(Response.json({data}));await aAssertion;client.disconnect();
});
it('rejects invalid ranges before network I/O and keeps errors from being displayed as empty success',async()=>{
  expect(()=>metricsRange('',range.window_end)).toThrow();expect(()=>metricsRange(range.window_end,range.window_start)).toThrow();
  expect(()=>metricsRange('2026-01-01','2026-10-08')).toThrow();
  const transport=vi.fn(async()=>{throw Error('network');}),client=new MetricsClient(transport);client.connect('synthetic');
  await expect(client.read('',range.window_end)).rejects.toMatchObject({code:'METRICS_WINDOW_INVALID'});expect(transport).not.toHaveBeenCalled();
  await expect(client.read(range.window_start,range.window_end)).rejects.toMatchObject({code:'NETWORK_UNKNOWN'});client.disconnect();
});
