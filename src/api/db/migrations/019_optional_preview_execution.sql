-- A preview is a private derivative of one immutable, completed content plan.
ALTER TABLE optional_previews ADD COLUMN private jsonb NOT NULL DEFAULT '{}';
ALTER TABLE private_object_writes ADD COLUMN preview_id text;
ALTER TABLE private_object_writes ADD FOREIGN KEY(tenant_id,preview_id) REFERENCES optional_previews(tenant_id,id);
ALTER TABLE private_object_writes ADD CHECK(preview_id IS NULL OR
  (kind='MEDIA' AND product_id IS NOT NULL AND order_id IS NULL AND asset_id IS NULL AND run_id IS NULL AND authorized_sample_id IS NULL));
CREATE INDEX private_preview_objects ON private_object_writes(tenant_id,preview_id);

-- Old queued rows have no verifiable frozen inputs. They cannot become READY.
UPDATE optional_previews p SET state='FAILED',data=data||'{"state":"FAILED"}'::jsonb WHERE private='{}'::jsonb
 AND NOT EXISTS(SELECT 1 FROM privacy_redactions r WHERE r.tenant_id=p.tenant_id AND r.target_table='optional_previews' AND r.target_id=p.id);
UPDATE private_object_writes w SET delete_requested=true WHERE EXISTS
  (SELECT 1 FROM optional_previews p WHERE p.object_key=w.object_key AND p.state='FAILED');

CREATE FUNCTION ypcc_protect_preview() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id,NEW.tenant_id,NEW.owner_id,NEW.product_id,NEW.plan_id,NEW.plan_hash,NEW.expires_at,NEW.created_at)
  IS DISTINCT FROM (OLD.id,OLD.tenant_id,OLD.owner_id,OLD.product_id,OLD.plan_id,OLD.plan_hash,OLD.expires_at,OLD.created_at) THEN
  RAISE EXCEPTION 'preview input binding is immutable';
 END IF;
 IF NEW.private->>'privacy_deleted' IS DISTINCT FROM 'true' THEN
  IF NEW.private->'input' IS DISTINCT FROM OLD.private->'input' OR NEW.private->'input_hash' IS DISTINCT FROM OLD.private->'input_hash'
   OR (OLD.private ? 'output' AND NEW.private->'output' IS DISTINCT FROM OLD.private->'output') THEN
   RAISE EXCEPTION 'preview checkpoint is immutable';
  END IF;
 END IF;
 IF (OLD.state='FAILED' AND NEW.state<>'FAILED') OR (OLD.state='READY' AND NEW.state NOT IN ('READY','FAILED')) THEN
  RAISE EXCEPTION 'ended preview cannot restart';
 END IF;
 IF OLD.object_key IS NOT NULL AND NEW.object_key IS DISTINCT FROM OLD.object_key THEN
  RAISE EXCEPTION 'preview object is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_preview_binding BEFORE UPDATE ON optional_previews FOR EACH ROW EXECUTE FUNCTION ypcc_protect_preview();
CREATE FUNCTION ypcc_protect_preview_object() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.preview_id IS DISTINCT FROM OLD.preview_id THEN RAISE EXCEPTION 'preview object binding is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_preview_object BEFORE UPDATE ON private_object_writes FOR EACH ROW EXECUTE FUNCTION ypcc_protect_preview_object();

-- The added private recovery payload belongs to the existing deletion scope.
ALTER FUNCTION ypcc_privacy_fields(text) RENAME TO ypcc_privacy_fields_before_previews;
CREATE FUNCTION ypcc_privacy_fields(target_table text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN target_table='optional_previews' THEN ARRAY['data','private'] ELSE ypcc_privacy_fields_before_previews(target_table) END
$$;
