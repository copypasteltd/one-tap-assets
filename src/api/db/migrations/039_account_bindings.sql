CREATE TABLE account_bindings (
 id text PRIMARY KEY,
 alipay_identity_id text NOT NULL REFERENCES platform_identities(id),
 douyin_identity_id text NOT NULL REFERENCES platform_identities(id),
 created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
 CHECK(alipay_identity_id<>douyin_identity_id)
);
CREATE UNIQUE INDEX account_bindings_alipay_active ON account_bindings(alipay_identity_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX account_bindings_douyin_active ON account_bindings(douyin_identity_id) WHERE revoked_at IS NULL;

CREATE TABLE account_binding_requests (
 id text PRIMARY KEY, code_hash text NOT NULL UNIQUE,
 origin_identity_id text NOT NULL REFERENCES platform_identities(id),
 peer_identity_id text REFERENCES platform_identities(id),
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','CLAIMED','BOUND','CANCELLED','REJECTED')),
 binding_id text UNIQUE REFERENCES account_bindings(id),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 CHECK(peer_identity_id IS NULL OR peer_identity_id<>origin_identity_id),
 CHECK((state='PENDING' AND peer_identity_id IS NULL AND binding_id IS NULL)
    OR (state='CLAIMED' AND peer_identity_id IS NOT NULL AND binding_id IS NULL)
    OR (state='BOUND' AND peer_identity_id IS NOT NULL AND binding_id IS NOT NULL)
    OR (state IN ('CANCELLED','REJECTED') AND binding_id IS NULL))
);
CREATE INDEX account_binding_requests_origin ON account_binding_requests(origin_identity_id,expires_at);
CREATE INDEX account_binding_requests_peer ON account_binding_requests(peer_identity_id,expires_at);

ALTER TABLE plus_links ADD COLUMN account_binding_id text REFERENCES account_bindings(id);
ALTER TABLE plus_links ADD COLUMN approved_by_identity_id text REFERENCES platform_identities(id);
ALTER TABLE plus_sessions ADD COLUMN account_binding_id text REFERENCES account_bindings(id);
ALTER TABLE plus_sessions ADD COLUMN approved_by_identity_id text REFERENCES platform_identities(id);
ALTER TABLE plus_sessions ADD CONSTRAINT plus_sessions_bound_approver CHECK(account_binding_id IS NULL OR approved_by_identity_id IS NOT NULL);
CREATE INDEX plus_sessions_binding_active ON plus_sessions(account_binding_id) WHERE account_binding_id IS NOT NULL AND revoked_at IS NULL;

CREATE FUNCTION guard_account_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.id<>OLD.id OR NEW.alipay_identity_id<>OLD.alipay_identity_id OR NEW.douyin_identity_id<>OLD.douyin_identity_id
    OR NEW.created_at<>OLD.created_at OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN
   RAISE EXCEPTION 'account binding identities and revocation are immutable';
  END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM platform_identities WHERE id=NEW.alipay_identity_id AND platform='alipay')
    OR NOT EXISTS(SELECT 1 FROM platform_identities WHERE id=NEW.douyin_identity_id AND platform='douyin') THEN
  RAISE EXCEPTION 'account binding requires two different approved platforms';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER account_binding_guard BEFORE INSERT OR UPDATE ON account_bindings FOR EACH ROW EXECUTE FUNCTION guard_account_binding();

CREATE FUNCTION guard_account_binding_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id<>OLD.id OR NEW.code_hash<>OLD.code_hash OR NEW.origin_identity_id<>OLD.origin_identity_id
    OR NEW.created_at<>OLD.created_at OR NEW.expires_at>OLD.expires_at
    OR (OLD.peer_identity_id IS NOT NULL AND NEW.peer_identity_id IS DISTINCT FROM OLD.peer_identity_id)
    OR (OLD.binding_id IS NOT NULL AND NEW.binding_id IS DISTINCT FROM OLD.binding_id) THEN
  RAISE EXCEPTION 'account binding request proof and deadline are frozen';
 END IF;
 IF OLD.state<>NEW.state AND NOT (
   (OLD.state='PENDING' AND NEW.state IN ('CLAIMED','CANCELLED'))
   OR (OLD.state='CLAIMED' AND NEW.state IN ('BOUND','CANCELLED','REJECTED'))
 ) THEN RAISE EXCEPTION 'invalid account binding transition'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER account_binding_request_guard BEFORE UPDATE ON account_binding_requests FOR EACH ROW EXECUTE FUNCTION guard_account_binding_request();
