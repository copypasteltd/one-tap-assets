CREATE FUNCTION ypcc_protect_community_commercial() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE k text;
BEGIN
 IF OLD.private ? 'commercial_binding' THEN
  IF NEW.variant_id IS DISTINCT FROM OLD.variant_id OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.engine IS DISTINCT FROM OLD.engine OR NEW.preset_version_id IS DISTINCT FROM OLD.preset_version_id
    OR NEW.price_fen IS DISTINCT FROM OLD.price_fen
    OR (NEW.data-ARRAY['sale_enabled','admission_state','reason_codes']) IS DISTINCT FROM (OLD.data-ARRAY['sale_enabled','admission_state','reason_codes'])
  THEN RAISE EXCEPTION 'frozen community offer is immutable'; END IF;
  FOREACH k IN ARRAY ARRAY['source','community_config','model_version_ids','budget_micro','repair_ceiling_micro','resource_versions','codex_contract','commercial_binding'] LOOP
   IF NEW.private->k IS DISTINCT FROM OLD.private->k THEN RAISE EXCEPTION 'frozen community configuration is immutable: %',k; END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_community_commercial BEFORE UPDATE ON execution_variants
 FOR EACH ROW EXECUTE FUNCTION ypcc_protect_community_commercial();
