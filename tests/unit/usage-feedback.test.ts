import {it,expect} from 'vitest';
import {usageFeedback} from '../../src/shared/client/usage-feedback';
it('binds feedback to its order and distinguishes an unanswered field from a withdrawn revision',()=>{
  const empty={order_id:'order-a',choice:null,revision:0,updated_at:null};expect(usageFeedback(empty,'order-a')).toEqual(empty);
  const withdrawn={...empty,revision:2,updated_at:'2026-10-30T00:00:00.000Z'};expect(usageFeedback(withdrawn,'order-a')).toEqual(withdrawn);
  for(const changed of [{...empty,order_id:'order-b'},{...empty,choice:'USED'},{...empty,revision:1},{...withdrawn,updated_at:'bad'},
    {...withdrawn,choice:'PUBLISHED'},{...withdrawn,tracking_url:'https://invalid.example'}, {...withdrawn,revision:Number.MAX_SAFE_INTEGER}])
    expect(()=>usageFeedback(changed,'order-a')).toThrow();
});
