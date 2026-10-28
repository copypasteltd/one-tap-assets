-- Revision costs are a separately frozen part of the sold service. Failed
-- attempts retain their spend and UNKNOWN holds in the same order account.
CREATE TABLE revision_budgets (
 id text PRIMARY KEY,tenant_id text NOT NULL,owner_id text NOT NULL,order_id text NOT NULL,
 policy_hash text NOT NULL CHECK(policy_hash ~ '^[a-f0-9]{64}$'),ceiling_micro bigint NOT NULL CHECK(ceiling_micro>0),
 reserved_micro bigint NOT NULL DEFAULT 0 CHECK(reserved_micro>=0),spent_micro bigint NOT NULL DEFAULT 0 CHECK(spent_micro>=0),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),UNIQUE(tenant_id,order_id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id),
 CHECK(reserved_micro+spent_micro<=ceiling_micro)
);
CREATE TABLE revision_cost_reservations (
 id text PRIMARY KEY,tenant_id text NOT NULL,budget_id text NOT NULL,revision_id text NOT NULL,
 intent_key text NOT NULL UNIQUE,amount_micro bigint NOT NULL CHECK(amount_micro>0),settled_micro bigint,
 state text NOT NULL CHECK(state IN ('RESERVED','UNKNOWN','SETTLED','RELEASED')),rate_snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,budget_id) REFERENCES revision_budgets(tenant_id,id),
 FOREIGN KEY(tenant_id,revision_id) REFERENCES revision_requests(tenant_id,id)
);
ALTER TABLE revision_requests ADD COLUMN deadline_at timestamptz;
ALTER TABLE revision_requests ADD COLUMN input_hash text;
-- Legacy accepted requests have no independently verifiable frozen inputs.
UPDATE revision_requests r SET state='FAILED',consumes_user_allowance=false,
 data=data||'{"state":"FAILED","consumes_user_allowance":false}'::jsonb
 WHERE state IN ('REQUESTED','PROCESSING') AND NOT EXISTS(SELECT 1 FROM privacy_redactions p
  WHERE p.tenant_id=r.tenant_id AND p.target_table='revision_requests' AND p.target_id=r.id);
UPDATE stage_runs SET state='CANCELLED',fencing_token=fencing_token+1,lease_owner=NULL,lease_expires_at=NULL,
 data=data||'{"state":"CANCELLED","reason_code":"REVISION_INPUT_UNVERIFIED"}'::jsonb
 WHERE scope_type='REVISION' AND state IN ('READY','CLAIMED','RUNNING','UNKNOWN');
CREATE UNIQUE INDEX one_user_revision_claim ON revision_requests(tenant_id,order_id)
 WHERE consumes_user_allowance AND state IN ('REQUESTED','PROCESSING','COMPLETED');

CREATE FUNCTION ypcc_protect_revision_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id,NEW.tenant_id,NEW.owner_id,NEW.order_id,NEW.parent_manifest_revision,NEW.kind,NEW.created_at,NEW.deadline_at,NEW.input_hash)
  IS DISTINCT FROM (OLD.id,OLD.tenant_id,OLD.owner_id,OLD.order_id,OLD.parent_manifest_revision,OLD.kind,OLD.created_at,OLD.deadline_at,OLD.input_hash) THEN
  RAISE EXCEPTION 'revision input binding is immutable';
 END IF;
 IF NEW.private->>'privacy_deleted' IS DISTINCT FROM 'true' AND
  (NEW.private->'input' IS DISTINCT FROM OLD.private->'input' OR NEW.private->'request' IS DISTINCT FROM OLD.private->'request') THEN
  RAISE EXCEPTION 'revision frozen input is immutable';
 END IF;
 IF OLD.state IN ('COMPLETED','FAILED') AND NEW.state<>OLD.state THEN RAISE EXCEPTION 'ended revision cannot restart'; END IF;
 IF OLD.result_manifest_id IS NOT NULL AND NEW.result_manifest_id IS DISTINCT FROM OLD.result_manifest_id THEN
  RAISE EXCEPTION 'revision result is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_revision_binding BEFORE UPDATE ON revision_requests FOR EACH ROW EXECUTE FUNCTION ypcc_protect_revision_binding();
CREATE FUNCTION ypcc_protect_revision_budget() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id,NEW.tenant_id,NEW.owner_id,NEW.order_id,NEW.policy_hash,NEW.ceiling_micro,NEW.created_at)
  IS DISTINCT FROM (OLD.id,OLD.tenant_id,OLD.owner_id,OLD.order_id,OLD.policy_hash,OLD.ceiling_micro,OLD.created_at) THEN
  RAISE EXCEPTION 'revision budget is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_revision_budget BEFORE UPDATE ON revision_budgets FOR EACH ROW EXECUTE FUNCTION ypcc_protect_revision_budget();
CREATE FUNCTION ypcc_protect_revision_reservation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id,NEW.tenant_id,NEW.budget_id,NEW.revision_id,NEW.intent_key,NEW.amount_micro,NEW.rate_snapshot,NEW.created_at)
  IS DISTINCT FROM (OLD.id,OLD.tenant_id,OLD.budget_id,OLD.revision_id,OLD.intent_key,OLD.amount_micro,OLD.rate_snapshot,OLD.created_at) THEN
  RAISE EXCEPTION 'revision cost binding is immutable';
 END IF;
 IF OLD.state IN ('SETTLED','RELEASED') AND (NEW.state,NEW.settled_micro) IS DISTINCT FROM (OLD.state,OLD.settled_micro) THEN
  RAISE EXCEPTION 'revision settlement is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_revision_cost BEFORE UPDATE ON revision_cost_reservations FOR EACH ROW EXECUTE FUNCTION ypcc_protect_revision_reservation();

ALTER TABLE inference_requests DROP CONSTRAINT inference_requests_scope_type_check;
ALTER TABLE inference_requests ADD CHECK(scope_type IN ('ORDER','PLATFORM','REVISION'));
ALTER TABLE private_object_writes ADD COLUMN revision_id text;
ALTER TABLE private_object_writes ADD FOREIGN KEY(tenant_id,revision_id) REFERENCES revision_requests(tenant_id,id);
ALTER TABLE private_object_writes ADD CHECK(revision_id IS NULL OR
 (product_id IS NOT NULL AND order_id IS NOT NULL AND asset_id IS NULL AND authorized_sample_id IS NULL AND preview_id IS NULL AND kind IN ('MEDIA','QC','RECEIPT')));
CREATE INDEX revision_private_objects ON private_object_writes(tenant_id,revision_id);
CREATE FUNCTION ypcc_protect_revision_objects() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.revision_id IS DISTINCT FROM OLD.revision_id THEN RAISE EXCEPTION 'revision object binding is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_revision_object BEFORE UPDATE ON private_object_writes FOR EACH ROW EXECUTE FUNCTION ypcc_protect_revision_objects();
CREATE FUNCTION ypcc_protect_revision_checkpoints() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE key text;
BEGIN
 IF NEW.private->>'privacy_deleted' IS DISTINCT FROM 'true' THEN
  FOREACH key IN ARRAY ARRAY['output_intent','candidate','qc_packet','post_result'] LOOP
   IF OLD.private ? key AND NEW.private->key IS DISTINCT FROM OLD.private->key THEN RAISE EXCEPTION 'revision checkpoint is immutable'; END IF;
  END LOOP;
  FOREACH key IN ARRAY ARRAY['REVIEW_FACTS','REVIEW_STYLE'] LOOP
   IF OLD.private->'review_reports' ? key AND NEW.private->'review_reports'->key IS DISTINCT FROM OLD.private->'review_reports'->key THEN
    RAISE EXCEPTION 'revision review is immutable';
   END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_revision_checkpoint BEFORE UPDATE ON revision_requests FOR EACH ROW EXECUTE FUNCTION ypcc_protect_revision_checkpoints();
DO $$ DECLARE definition text;
BEGIN
 definition := rtrim(pg_get_viewdef('privacy_instance_scope',true),E';\n ');
 EXECUTE 'CREATE OR REPLACE VIEW privacy_instance_scope AS '||definition||
  ' UNION ALL SELECT i.id,i.tenant_id,o.owner_id,o.product_id,o.id FROM agent_instances i JOIN revision_requests r ON r.tenant_id=i.tenant_id AND r.id=i.preview_session_id JOIN privacy_order_scope o ON o.tenant_id=r.tenant_id AND o.id=r.order_id WHERE i.order_id IS NULL';
END $$;
