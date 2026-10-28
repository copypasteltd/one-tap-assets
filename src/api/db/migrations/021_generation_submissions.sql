-- Generation uses the existing private provider scope and original order ledger.
ALTER TABLE provider_submissions ADD COLUMN order_id text;
ALTER TABLE provider_submissions ADD COLUMN generation_kind text CHECK(generation_kind IN ('IMAGE','VIDEO'));
ALTER TABLE provider_submissions ADD COLUMN model_version_id text;
ALTER TABLE provider_submissions ADD COLUMN operation_key text;
ALTER TABLE provider_submissions ADD COLUMN lease_generation bigint NOT NULL DEFAULT 0;
ALTER TABLE provider_submissions ADD COLUMN lease_owner text;
ALTER TABLE provider_submissions ADD COLUMN lease_expires_at timestamptz;
ALTER TABLE provider_submissions ADD COLUMN next_query_at timestamptz;
ALTER TABLE provider_submissions ADD FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id);
ALTER TABLE provider_submissions ADD FOREIGN KEY(model_version_id) REFERENCES provider_model_versions(id);
ALTER TABLE provider_submissions ADD CHECK((generation_kind IS NULL AND order_id IS NULL AND model_version_id IS NULL AND operation_key IS NULL)
 OR (generation_kind IS NOT NULL AND order_id IS NOT NULL AND model_version_id IS NOT NULL AND operation_key IS NOT NULL));
CREATE UNIQUE INDEX generation_node_intent ON provider_submissions(tenant_id,order_id,stage_run_id,operation_key) WHERE generation_kind IS NOT NULL;
CREATE INDEX generation_reconciliation ON provider_submissions(updated_at,id) WHERE generation_kind IS NOT NULL;
CREATE FUNCTION ypcc_protect_generation_submission() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.tenant_id,NEW.order_id,NEW.stage_run_id,NEW.intent_key,NEW.input_hash,NEW.generation_kind,NEW.model_version_id,NEW.operation_key,NEW.reservation_id)
  IS DISTINCT FROM (OLD.tenant_id,OLD.order_id,OLD.stage_run_id,OLD.intent_key,OLD.input_hash,OLD.generation_kind,OLD.model_version_id,OLD.operation_key,OLD.reservation_id)
 THEN RAISE EXCEPTION 'generation submission binding is immutable'; END IF;
 IF OLD.generation_kind IS NULL THEN RETURN NEW; END IF;
 IF OLD.provider_task_id IS NOT NULL AND NEW.provider_task_id IS DISTINCT FROM OLD.provider_task_id THEN RAISE EXCEPTION 'original provider task is immutable'; END IF;
 IF NEW.private->>'privacy_deleted' IS DISTINCT FROM 'true' THEN
  IF (NEW.private->'wire_contract',NEW.private->'contract_hash',NEW.private->'request_key',NEW.private->'request_sha256',NEW.private->'prepared',NEW.private->'product_id',NEW.private->'owner_id')
   IS DISTINCT FROM (OLD.private->'wire_contract',OLD.private->'contract_hash',OLD.private->'request_key',OLD.private->'request_sha256',OLD.private->'prepared',OLD.private->'product_id',OLD.private->'owner_id')
  THEN RAISE EXCEPTION 'generation frozen request is immutable'; END IF;
  IF jsonb_typeof(NEW.private->'receipts') IS DISTINCT FROM 'array'
    OR jsonb_array_length(NEW.private->'receipts')<jsonb_array_length(OLD.private->'receipts')
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(OLD.private->'receipts') WITH ORDINALITY AS r(value,n)
      WHERE NEW.private->'receipts'->((r.n-1)::int) IS DISTINCT FROM r.value)
  THEN RAISE EXCEPTION 'generation original receipts are append only'; END IF;
  IF OLD.private ? 'sending_started_at' AND NEW.private->'sending_started_at' IS DISTINCT FROM OLD.private->'sending_started_at'
  THEN RAISE EXCEPTION 'generation send marker is immutable'; END IF;
  IF OLD.private ? 'terminal_receipt_ordinal' AND (NEW.private->'terminal_receipt_ordinal',NEW.private->'provider_terminal')
    IS DISTINCT FROM (OLD.private->'terminal_receipt_ordinal',OLD.private->'provider_terminal')
  THEN RAISE EXCEPTION 'generation terminal receipt is immutable'; END IF;
  IF OLD.private ? 'output' AND NEW.private->'output' IS DISTINCT FROM OLD.private->'output' THEN RAISE EXCEPTION 'generation output is immutable'; END IF;
 END IF;
 IF OLD.state IN ('SUCCEEDED','FAILED') AND NEW.state IS DISTINCT FROM OLD.state THEN RAISE EXCEPTION 'generation terminal result cannot revive'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_generation_submission BEFORE UPDATE ON provider_submissions FOR EACH ROW EXECUTE FUNCTION ypcc_protect_generation_submission();
