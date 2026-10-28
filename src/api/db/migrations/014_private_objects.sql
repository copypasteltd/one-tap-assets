-- Every private write is durable before object I/O. Deletion can therefore
-- find bytes even when their business checkpoint never committed.
CREATE TABLE private_object_writes (
 id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL,
 product_id text, order_id text, asset_id text, run_id text,
 object_key text NOT NULL UNIQUE, sha256 text NOT NULL, kind text NOT NULL CHECK(kind IN ('INPUT','MEDIA','QC','RECEIPT')),
 state text NOT NULL CHECK(state IN ('WRITING','STORED','UNKNOWN','DELETED')),
 write_generation bigint NOT NULL DEFAULT 1, expires_at timestamptz NOT NULL,
 delete_requested boolean NOT NULL DEFAULT false, deleted_at timestamptz,
 erase_owner text, erase_lease_expires_at timestamptz, erase_generation bigint NOT NULL DEFAULT 0,
 erase_attempts integer NOT NULL DEFAULT 0, erase_available_at timestamptz NOT NULL DEFAULT now(),
 last_error text, evidence jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id),
 FOREIGN KEY(tenant_id,product_id) REFERENCES product_drafts(tenant_id,id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),
 FOREIGN KEY(tenant_id,asset_id) REFERENCES assets(tenant_id,id),
 FOREIGN KEY(tenant_id,run_id) REFERENCES agent_runs(tenant_id,id), UNIQUE(tenant_id,id)
);
CREATE INDEX private_object_expiry ON private_object_writes(expires_at) WHERE state<>'DELETED';
CREATE INDEX private_object_erasure ON private_object_writes(erase_available_at) WHERE delete_requested AND state<>'DELETED';
CREATE FUNCTION ypcc_protect_private_object() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id,NEW.tenant_id,NEW.owner_id,NEW.product_id,NEW.order_id,NEW.asset_id,NEW.run_id,NEW.object_key,NEW.sha256,NEW.kind,NEW.created_at)
    IS DISTINCT FROM
    (OLD.id,OLD.tenant_id,OLD.owner_id,OLD.product_id,OLD.order_id,OLD.asset_id,OLD.run_id,OLD.object_key,OLD.sha256,OLD.kind,OLD.created_at) THEN
  RAISE EXCEPTION 'private object binding is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_private_object_binding BEFORE UPDATE ON private_object_writes FOR EACH ROW EXECUTE FUNCTION ypcc_protect_private_object();
CREATE TABLE object_erasure_receipts (
 id text PRIMARY KEY, tenant_id text NOT NULL, object_id text NOT NULL, erase_generation bigint NOT NULL,
 write_generation bigint NOT NULL, state text NOT NULL, evidence_hash text NOT NULL, data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,object_id) REFERENCES private_object_writes(tenant_id,id),
 UNIQUE(object_id,erase_generation)
);
CREATE TRIGGER immutable_object_erasure_receipt BEFORE UPDATE ON object_erasure_receipts FOR EACH ROW EXECUTE FUNCTION ypcc_reject_mutation();
ALTER TABLE idempotency_records ADD COLUMN revoked_at timestamptz;
CREATE TRIGGER immutable_deletion_marker BEFORE UPDATE OR DELETE ON deletion_markers FOR EACH ROW EXECUTE FUNCTION ypcc_reject_mutation();
