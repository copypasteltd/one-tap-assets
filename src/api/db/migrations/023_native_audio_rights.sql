-- Applies only to explicitly registered native-audio rights. Existing font and
-- historical resource formats retain their own admission rules. Evidence and
-- prepaid allocation prices are immutable; expiry/revocation may only tighten.
CREATE FUNCTION ypcc_protect_audio_license() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT (OLD.data ? 'audio_rights') THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'audio license evidence is immutable'; END IF;
 IF (NEW.id,NEW.resource_id,NEW.version,NEW.data-'admission_state') IS DISTINCT FROM
    (OLD.id,OLD.resource_id,OLD.version,OLD.data-'admission_state')
 THEN RAISE EXCEPTION 'audio license evidence and allocation are immutable'; END IF;
 IF NEW.data->>'admission_state' IS DISTINCT FROM OLD.data->>'admission_state'
   AND (OLD.data->>'admission_state'='ADMITTED' AND NEW.data->>'admission_state'='RETIRED') IS NOT TRUE
 THEN RAISE EXCEPTION 'audio license admission cannot be revived'; END IF;
 IF OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
 THEN RAISE EXCEPTION 'audio license revocation cannot be undone'; END IF;
 IF OLD.expires_at IS NOT NULL AND (NEW.expires_at IS NULL OR NEW.expires_at>OLD.expires_at)
 THEN RAISE EXCEPTION 'audio license expiry cannot be extended'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_audio_license BEFORE UPDATE OR DELETE ON resource_licenses
 FOR EACH ROW EXECUTE FUNCTION ypcc_protect_audio_license();

CREATE FUNCTION ypcc_protect_character_voice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT (OLD.data ? 'native_audio_admissions') THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'character voice evidence is immutable'; END IF;
 IF (NEW.id,NEW.character_id,NEW.version,NEW.data-'admission_state') IS DISTINCT FROM
    (OLD.id,OLD.character_id,OLD.version,OLD.data-'admission_state')
 THEN RAISE EXCEPTION 'character voice binding is immutable'; END IF;
 IF NEW.data->>'admission_state' IS DISTINCT FROM OLD.data->>'admission_state'
   AND (OLD.data->>'admission_state'='ADMITTED' AND NEW.data->>'admission_state'='RETIRED') IS NOT TRUE
 THEN RAISE EXCEPTION 'character voice admission cannot be revived'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_character_voice BEFORE UPDATE OR DELETE ON character_versions
 FOR EACH ROW EXECUTE FUNCTION ypcc_protect_character_voice();

CREATE UNIQUE INDEX native_audio_original_asr ON provider_submissions(tenant_id,order_id)
 WHERE generation_kind='ASR' AND private ? 'audio_contract_hash';
CREATE FUNCTION ypcc_protect_speech_audio_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.generation_kind='ASR' AND NEW.private->>'privacy_deleted' IS DISTINCT FROM 'true'
   AND NEW.private->'audio_contract_hash' IS DISTINCT FROM OLD.private->'audio_contract_hash'
 THEN RAISE EXCEPTION 'original audio contract is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_speech_audio_binding BEFORE UPDATE ON provider_submissions
 FOR EACH ROW EXECUTE FUNCTION ypcc_protect_speech_audio_binding();
