CREATE TABLE community_licenses (
 id text PRIMARY KEY, version text NOT NULL, state text NOT NULL CHECK(state IN ('DRAFT','ACTIVE','RETIRED')),
 content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'), data jsonb NOT NULL,
 review_reference text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (data ?& ARRAY['license_id','version','state','content_hash','name','full_text','fork_allowed','attribution_required']),
 CHECK (data->>'license_id'=id AND data->>'version'=version AND data->>'state'=state AND data->>'content_hash'=content_hash),
 CHECK (content_hash=encode(sha256(convert_to(data->>'full_text','UTF8')),'hex')),
 CHECK (state<>'ACTIVE' OR (review_reference IS NOT NULL AND length(trim(review_reference))>0))
);
CREATE FUNCTION guard_community_license() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'license history is immutable'; END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
    OR (NEW.data-'state') IS DISTINCT FROM (OLD.data-'state') THEN
  RAISE EXCEPTION 'license content is immutable; register a new version';
 END IF;
 IF NEW.state<>OLD.state AND NOT ((OLD.state='DRAFT' AND NEW.state IN ('ACTIVE','RETIRED'))
    OR (OLD.state='ACTIVE' AND NEW.state='RETIRED')) THEN
  RAISE EXCEPTION 'license state transition is forbidden';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER community_license_immutable BEFORE UPDATE OR DELETE ON community_licenses
 FOR EACH ROW EXECUTE FUNCTION guard_community_license();
