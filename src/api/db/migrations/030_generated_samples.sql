-- Creator samples have their own frozen execution and platform cost ledger.
-- They never acquire an order, customer payment or buyer budget reservation.
ALTER TABLE provider_submissions ADD COLUMN sample_id text;
ALTER TABLE provider_submissions ADD FOREIGN KEY(tenant_id,sample_id) REFERENCES public_samples(tenant_id,id);
DO $$ DECLARE binding_name text; BEGIN
 SELECT conname INTO STRICT binding_name FROM pg_constraint
 WHERE conrelid='provider_submissions'::regclass AND contype='c'
 AND pg_get_constraintdef(oid) LIKE '%generation_kind IS NULL%order_id IS NULL%model_version_id IS NULL%';
 EXECUTE format('ALTER TABLE provider_submissions DROP CONSTRAINT %I',binding_name);
END $$;
ALTER TABLE provider_submissions ADD CONSTRAINT provider_submission_execution_scope CHECK(
 (generation_kind IS NULL AND order_id IS NULL AND sample_id IS NULL AND model_version_id IS NULL AND operation_key IS NULL)
 OR (generation_kind IS NOT NULL AND model_version_id IS NOT NULL AND operation_key IS NOT NULL
   AND ((order_id IS NOT NULL AND sample_id IS NULL)
     OR (order_id IS NULL AND sample_id IS NOT NULL AND generation_kind IN ('IMAGE','VIDEO')))));
CREATE UNIQUE INDEX sample_generation_node_intent ON provider_submissions(tenant_id,sample_id,stage_run_id,operation_key)
 WHERE sample_id IS NOT NULL;
CREATE FUNCTION ypcc_protect_sample_generation_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.sample_id IS DISTINCT FROM OLD.sample_id THEN RAISE EXCEPTION 'original sample binding is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_sample_generation_scope BEFORE UPDATE ON provider_submissions
 FOR EACH ROW EXECUTE FUNCTION ypcc_protect_sample_generation_scope();
CREATE FUNCTION ypcc_protect_sample_execution() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.private ? 'execution' AND NEW.private->>'privacy_deleted' IS DISTINCT FROM 'true'
 AND NEW.private->'execution' IS DISTINCT FROM OLD.private->'execution'
 THEN RAISE EXCEPTION 'original sample execution is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_sample_execution BEFORE UPDATE ON public_samples
 FOR EACH ROW EXECUTE FUNCTION ypcc_protect_sample_execution();
