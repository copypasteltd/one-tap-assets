-- Image edits are optional sold capabilities. Preserve their first output
-- intent across retries and cleanup; the original source/contract is unchanged.
CREATE FUNCTION ypcc_protect_revision_image_output() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.private ? 'image_text_output' AND NEW.private->>'privacy_deleted' IS DISTINCT FROM 'true'
  AND NEW.private->'image_text_output' IS DISTINCT FROM OLD.private->'image_text_output'
 THEN RAISE EXCEPTION 'revision image output intent is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_revision_image_output BEFORE UPDATE ON revision_requests
 FOR EACH ROW EXECUTE FUNCTION ypcc_protect_revision_image_output();
