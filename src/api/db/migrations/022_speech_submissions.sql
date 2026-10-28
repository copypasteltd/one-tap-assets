-- Same original-intent ledger and privacy scope, explicitly disjoint adapters.
ALTER TABLE provider_submissions DROP CONSTRAINT provider_submissions_generation_kind_check;
ALTER TABLE provider_submissions ADD CONSTRAINT provider_submissions_generation_kind_check CHECK(generation_kind IN ('IMAGE','VIDEO','ASR'));
-- The existing immutable binding / request / append-only receipt trigger also
-- applies to ASR. No new customer-content table or independent spending bucket.
CREATE INDEX speech_reconciliation ON provider_submissions(updated_at,id) WHERE generation_kind='ASR';
