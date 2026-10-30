-- Preserve the original single-ASR entitlement. Only a pre-sale, snapshot-bound
-- native repair allowance can create a distinct attempt-2 ASR. Financial rows,
-- historical contracts and settled provider effects are never relabelled.
ALTER TABLE provider_submissions ADD COLUMN native_asr_attempt integer
 CHECK(native_asr_attempt IN (1,2));
UPDATE provider_submissions SET native_asr_attempt=1
 WHERE generation_kind='ASR' AND private ? 'audio_contract_hash';
DROP INDEX native_audio_original_asr;
CREATE UNIQUE INDEX native_audio_asr_attempt ON provider_submissions(tenant_id,order_id,native_asr_attempt)
 WHERE generation_kind='ASR' AND native_asr_attempt IS NOT NULL;

CREATE FUNCTION ypcc_native_asr_attempt_binding() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE phase stage_runs%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.native_asr_attempt IS DISTINCT FROM OLD.native_asr_attempt
  THEN RAISE EXCEPTION 'original native ASR attempt is immutable'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.generation_kind='ASR' AND NEW.private ? 'audio_contract_hash' THEN
  SELECT * INTO phase FROM stage_runs WHERE tenant_id=NEW.tenant_id AND id=NEW.stage_run_id
   AND scope_type='ORDER' AND scope_id=NEW.order_id AND stage_name='POST';
  IF phase.id IS NULL OR phase.attempt NOT IN (1,2) OR NEW.native_asr_attempt IS DISTINCT FROM phase.attempt
  THEN RAISE EXCEPTION 'native ASR requires its exact original stage attempt'; END IF;
  IF phase.attempt=2 AND NOT EXISTS(
   SELECT 1 FROM repair_cost_authorizations a
   JOIN orders o ON o.tenant_id=a.tenant_id AND o.id=a.order_id
   JOIN execution_snapshots e ON e.tenant_id=o.tenant_id AND e.order_id=o.id AND e.hash=a.snapshot_hash
   JOIN budget_reservations b ON b.tenant_id=a.tenant_id AND b.order_id=a.order_id AND b.id=NEW.reservation_id
   JOIN provider_submissions original ON original.tenant_id=a.tenant_id AND original.order_id=a.order_id
   JOIN budget_reservations original_cost ON original_cost.tenant_id=original.tenant_id AND original_cost.id=original.reservation_id
   JOIN stage_runs original_stage ON original_stage.tenant_id=original.tenant_id AND original_stage.id=original.stage_run_id
   WHERE a.tenant_id=NEW.tenant_id AND a.order_id=NEW.order_id AND phase.id=ANY(a.stage_ids)
    AND a.job_id=phase.job_id AND a.snapshot_hash=phase.input_hash AND a.deadline_at=phase.deadline_at
    AND o.deadline_at=a.deadline_at AND o.deadline_at>clock_timestamp() AND o.payment_state='CONFIRMED'
    AND o.fulfillment_state IN ('QUEUED','IN_PROGRESS') AND NOT(o.private ? 'media_revoked')
    AND o.private->'contract'->'native_audio_contract'->'repair'->>'version'='YPCC-NATIVE-REPAIR-1'
    AND o.private->'contract'->'native_audio_contract'->'repair'->>'additional_asr_calls'='1'
    AND o.private->'contract'->'native_audio_contract'->'asr'->>'max_calls'='1'
    AND e.data->>'native_audio_contract_hash'=NEW.private->>'audio_contract_hash'
    AND b.purpose='REPAIR' AND b.repair_authorization_id=a.id AND b.repair_stage_id=phase.id AND b.repair_node_key='ASR'
    AND b.state='RESERVED' AND b.amount_micro::text=o.private->'contract'->'native_audio_contract'->'repair'->>'asr_ceiling_micro'
    AND original.generation_kind='ASR' AND original.native_asr_attempt=1 AND original.state='SUCCEEDED'
    AND original.private->>'audio_contract_hash'=NEW.private->>'audio_contract_hash'
    AND original.private->>'billing_valid'='true' AND original.private->>'provider_terminal'='true'
    AND original_cost.state='SETTLED' AND original_cost.purpose='FIRST_PASS'
    AND original_stage.stage_name='POST' AND original_stage.attempt=1 AND original_stage.state='SUCCEEDED'
  ) THEN RAISE EXCEPTION 'native repair ASR was not frozen and authorized by the original order'; END IF;
 ELSIF NEW.native_asr_attempt IS NOT NULL THEN
  RAISE EXCEPTION 'native ASR attempt requires an original audio contract';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_native_asr_attempt BEFORE INSERT OR UPDATE ON provider_submissions
 FOR EACH ROW EXECUTE FUNCTION ypcc_native_asr_attempt_binding();
