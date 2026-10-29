-- Independent listening shares the original order budget, private objects,
-- immutable wire/request binding and append-only provider receipt ledger.
ALTER TABLE provider_submissions DROP CONSTRAINT provider_submissions_generation_kind_check;
ALTER TABLE provider_submissions ADD CONSTRAINT provider_submissions_generation_kind_check
 CHECK(generation_kind IN ('IMAGE','VIDEO','ASR','LISTENING'));
CREATE UNIQUE INDEX listening_original_packet ON provider_submissions(tenant_id,order_id,operation_key)
 WHERE generation_kind='LISTENING';
CREATE INDEX listening_receipt_reconciliation ON provider_submissions(updated_at,id) WHERE generation_kind='LISTENING';
