ALTER TABLE agent_instances ADD COLUMN cleanup_owner text;
ALTER TABLE agent_instances ADD COLUMN cleanup_lease_expires_at timestamptz;
ALTER TABLE agent_instances ADD COLUMN cleanup_generation bigint NOT NULL DEFAULT 0;
ALTER TABLE agent_instances ADD COLUMN cleanup_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE agent_instances ADD COLUMN cleanup_available_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE agent_instances ADD COLUMN cleanup_requested_at timestamptz;
ALTER TABLE cleanup_receipts ADD COLUMN private jsonb NOT NULL DEFAULT '{}';
CREATE INDEX instance_cleanup_queue ON agent_instances(cleanup_available_at,created_at) WHERE state IN ('DRAINING','RELEASING','CLEANUP_FAILED');
CREATE FUNCTION ypcc_protect_cleanup_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.private ? 'cleanup_binding' AND NEW.private->'cleanup_binding' IS DISTINCT FROM OLD.private->'cleanup_binding' THEN
  RAISE EXCEPTION 'cleanup binding is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_cleanup_binding BEFORE UPDATE ON agent_instances FOR EACH ROW EXECUTE FUNCTION ypcc_protect_cleanup_binding();
CREATE TRIGGER immutable_cleanup_receipt BEFORE UPDATE ON cleanup_receipts FOR EACH ROW EXECUTE FUNCTION ypcc_reject_mutation();
