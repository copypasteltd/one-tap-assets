import {it,expect} from 'vitest';
import type {DTO} from '../../src/shared/contracts/types';
import {revisionProgress} from '../../src/shared/client/revisions';
const repair:DTO<'Revision'>={revision_id:'platform',order_id:'original_order',state:'COMPLETED',result_manifest_revision:2,consumes_user_allowance:false};
it('refreshes a completed platform correction without hiding the customer modification editor',()=>{
  expect(revisionProgress([repair])).toEqual({active:undefined,delivered:repair,customerCompleted:undefined});
});
it('blocks simultaneous work while either a platform correction or a customer modification is active',()=>{
  for(const consumes of [false,true]){const active={...repair,state:'PROCESSING' as const,consumes_user_allowance:consumes};expect(revisionProgress([active,repair]).active).toBe(active);}
});
it('retains the used customer success when a later free correction updates the pack',()=>{
  const customer={...repair,revision_id:'customer',consumes_user_allowance:true};expect(revisionProgress([repair,customer])).toMatchObject({delivered:repair,customerCompleted:customer});
});
it('does not spend the customer success on failed attempts or an empty history',()=>{
  expect(revisionProgress([{...repair,state:'FAILED',consumes_user_allowance:true}])).toEqual({active:undefined,delivered:undefined,customerCompleted:undefined});
  expect(revisionProgress([]).customerCompleted).toBeUndefined();
});
