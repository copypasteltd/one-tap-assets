import type {DTO} from '../contracts/types';
/** Free platform corrections can advance the pack without spending the buyer's success. */
export function revisionProgress(items:DTO<'Revision'>[]){
  return {active:items.find(r=>r.state==='REQUESTED'||r.state==='PROCESSING'),
    delivered:items.find(r=>r.state==='COMPLETED'),
    customerCompleted:items.find(r=>r.state==='COMPLETED'&&r.consumes_user_allowance)};
}
