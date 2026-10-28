-- Private production checkpoints. Object storage may acknowledge a receipt
-- before the tool transaction commits; recovery reuses that original receipt.
CREATE TABLE media_operations (
 id text PRIMARY KEY, tenant_id text NOT NULL, order_id text NOT NULL, stage_run_id text NOT NULL,
 phase text NOT NULL CHECK(phase IN ('PRODUCTION','POST')), input_hash text NOT NULL,
 state text NOT NULL CHECK(state IN ('PREPARING','READY')), generation integer NOT NULL DEFAULT 0 CHECK(generation>=0),
 owner_intent_id text, manifest_key text, manifest_hash text, data jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),
 FOREIGN KEY(tenant_id,stage_run_id) REFERENCES stage_runs(tenant_id,id),
 FOREIGN KEY(tenant_id,owner_intent_id) REFERENCES agent_tool_intents(tenant_id,id),
 UNIQUE(tenant_id,id), UNIQUE(stage_run_id,phase,input_hash)
);
ALTER TABLE artifacts ADD COLUMN media_operation_id text;
ALTER TABLE artifacts ADD CONSTRAINT artifact_media_operation_fk FOREIGN KEY(tenant_id,media_operation_id) REFERENCES media_operations(tenant_id,id);
CREATE UNIQUE INDEX artifact_operation_slot ON artifacts(media_operation_id,slot_id) WHERE media_operation_id IS NOT NULL;
CREATE INDEX media_operation_order ON media_operations(tenant_id,order_id,phase,state);
CREATE FUNCTION ypcc_protect_artifact() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-'expires_at') IS DISTINCT FROM (to_jsonb(OLD)-'expires_at') THEN
  RAISE EXCEPTION 'artifact content is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_artifact BEFORE UPDATE ON artifacts FOR EACH ROW EXECUTE FUNCTION ypcc_protect_artifact();
