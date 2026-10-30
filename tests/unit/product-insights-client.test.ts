import {it,expect,vi} from 'vitest';
import {MetricsClient} from '../../src/shared/client/metrics';
const range={window_start:'2026-10-01T00:00:00.000Z',window_end:'2026-10-08T00:00:00.000Z'};
const sample=()=>({...range,traffic_group:'INTERNAL_TEST',recognition:{jobs:1,ready_jobs:1,blocked_jobs:0,failed_jobs:0,attempts:2,machine_profiles:1,
  profiles_with_observed_fields:0,observed_fields:0,ocr_fields:0,hypothesis_fields:1,unknown_fields:3,conflicted_fields:0,evidenced_field_share:0,accuracy:null},
  funnel:{selected_product_presets:1,paid_orders:1,paid_buyers:1,first_deliveries:1,recommendation_impressions:null,recommendation_clicks:null,automatic_success_ratio:null},
  album:{saved_files:1,saved_orders:1,unwindowed_receipts:2},feedback:{planned_use:0,used:1,needs_adjustment:0,withdrawn:0},community:{published_versions:0,effective_reuses:0},
  costs:{currency:'CNY',order_settled_micro:200,platform_settled_micro:100,platform_unresolved_reservations:1,platform_unclassified_reservations:0,review_support_micro:null,complete_cost_micro:null}});
it('keeps unknown evidence at zero coverage and binds private reads to their traffic group',async()=>{
  const transport=vi.fn(async()=>Response.json({data:sample()})),client=new MetricsClient(transport);client.connect('synthetic-insights');
  expect(await client.readInsights(range.window_start,range.window_end,'INTERNAL_TEST')).toEqual(sample());
  expect((transport.mock.calls[0] as unknown as [string])[0]).toContain('traffic_group=INTERNAL_TEST');client.disconnect();
});
it('rejects false accuracy, invented missing measurements, stale groups and unsafe amounts',async()=>{
  const mutations=[(s:any)=>{s.recognition.evidenced_field_share=1;},(s:any)=>{s.recognition.accuracy=.99;},(s:any)=>{s.funnel.recommendation_impressions=0;},
    (s:any)=>{s.traffic_group='ALL';},(s:any)=>{s.costs.complete_cost_micro=300;},(s:any)=>{s.costs.platform_settled_micro=Number.MAX_SAFE_INTEGER+1;},
    (s:any)=>{s.feedback.owner_id='private-person';}];
  for(const mutate of mutations){const data=sample();mutate(data);const client=new MetricsClient(async()=>Response.json({data}));client.connect('synthetic-insights');
    await expect(client.readInsights(range.window_start,range.window_end,'INTERNAL_TEST')).rejects.toMatchObject({code:'MANAGEMENT_RESPONSE_INVALID'});client.disconnect();}
});
it('does not accept an aggregate arriving after the operator disconnects',async()=>{
  let resolve!:(value:Response)=>void;const client=new MetricsClient(()=>new Promise<Response>(done=>{resolve=done;}));client.connect('synthetic-insights');
  const pending=client.readInsights(range.window_start,range.window_end,'INTERNAL_TEST');client.disconnect();resolve(Response.json({data:sample()}));
  await expect(pending).rejects.toMatchObject({code:'MANAGEMENT_ACCOUNT_CHANGED'});
});
