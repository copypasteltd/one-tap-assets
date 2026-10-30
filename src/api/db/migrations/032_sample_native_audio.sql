-- Explicit sample scope. Never backfill capabilities or use buyer cost reservations.
ALTER TABLE provider_submissions DROP CONSTRAINT provider_submission_execution_scope;
ALTER TABLE provider_submissions ADD CONSTRAINT provider_submission_execution_scope CHECK(
 (generation_kind IS NULL AND order_id IS NULL AND sample_id IS NULL AND model_version_id IS NULL AND operation_key IS NULL)
 OR (generation_kind IS NOT NULL AND model_version_id IS NOT NULL AND operation_key IS NOT NULL
   AND ((order_id IS NOT NULL AND sample_id IS NULL)
     OR (order_id IS NULL AND sample_id IS NOT NULL AND generation_kind IN ('IMAGE','VIDEO','ASR','LISTENING')))));
CREATE UNIQUE INDEX sample_native_original_asr ON provider_submissions(tenant_id,sample_id)
 WHERE sample_id IS NOT NULL AND generation_kind='ASR';
CREATE UNIQUE INDEX sample_native_original_listening ON provider_submissions(tenant_id,sample_id,operation_key)
 WHERE sample_id IS NOT NULL AND generation_kind='LISTENING';
CREATE FUNCTION ypcc_sample_native_audio_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE stage_name_value text; frozen_input jsonb; frozen_hash text; rate_value jsonb; budget_tenant text;
BEGIN
 IF NEW.sample_id IS NULL OR NEW.generation_kind NOT IN ('ASR','LISTENING') THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.private->>'privacy_deleted' IS DISTINCT FROM 'true' AND
   NEW.private->'sample_audio_contract_hash' IS DISTINCT FROM OLD.private->'sample_audio_contract_hash'
  THEN RAISE EXCEPTION 'sample native audio binding is immutable'; END IF;
  RETURN NEW;
 END IF;
 SELECT s.stage_name,p.private->'execution'->'input',p.private->'execution'->>'hash' INTO stage_name_value,frozen_input,frozen_hash
 FROM stage_runs s JOIN public_samples p ON p.tenant_id=s.tenant_id AND p.id=s.scope_id
 WHERE s.tenant_id=NEW.tenant_id AND s.id=NEW.stage_run_id AND s.scope_type='SAMPLE' AND s.scope_id=NEW.sample_id
 AND s.attempt=1 AND s.input_hash=p.private->'execution'->>'hash'
 AND s.deadline_at=(p.private->'execution'->'input'->>'deadline_at')::timestamptz;
 IF NEW.order_id IS NOT NULL OR frozen_input->'generation'->'audio'->>'license_use' IS DISTINCT FROM 'SAMPLE'
  OR frozen_input->'generation'->'audio'->>'version' IS DISTINCT FROM 'YPCC-SAMPLE-NATIVE-AUDIO-1'
  OR stage_name_value IS DISTINCT FROM (CASE NEW.generation_kind WHEN 'ASR' THEN 'SAMPLE_POST' ELSE 'SAMPLE_QC' END)
  OR NEW.private->>'sample_audio_contract_hash' IS NULL
 THEN RAISE EXCEPTION 'sample audio requires original frozen sample and stage'; END IF;
 SELECT tenant_id,rate_snapshot INTO budget_tenant,rate_value FROM platform_budget_reservations WHERE id=NEW.reservation_id;
 IF budget_tenant IS DISTINCT FROM NEW.tenant_id OR rate_value->>'component' IS DISTINCT FROM 'SAMPLE_NATIVE_AUDIO'
  OR rate_value->>'sample_id' IS DISTINCT FROM NEW.sample_id OR rate_value->>'input_hash' IS DISTINCT FROM frozen_hash
 THEN RAISE EXCEPTION 'sample audio requires its original platform reservation'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_sample_native_audio BEFORE INSERT OR UPDATE ON provider_submissions
 FOR EACH ROW EXECUTE FUNCTION ypcc_sample_native_audio_scope();
