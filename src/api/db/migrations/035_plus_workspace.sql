CREATE TABLE plus_links (
 id text PRIMARY KEY, code_hash text NOT NULL UNIQUE, poll_key_hash text NOT NULL,
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','APPROVED','DENIED')),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 tenant_id text, owner_id text, identity_id text, session_id text,
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id),
 FOREIGN KEY(tenant_id,identity_id) REFERENCES platform_identities(tenant_id,id)
);
CREATE TABLE plus_sessions (
 id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, identity_id text NOT NULL,
 token_hash text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 revoked_at timestamptz, UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id),
 FOREIGN KEY(tenant_id,identity_id) REFERENCES platform_identities(tenant_id,id)
);
ALTER TABLE plus_links ADD FOREIGN KEY(session_id) REFERENCES plus_sessions(id);
CREATE INDEX plus_sessions_owner_idx ON plus_sessions(tenant_id,owner_id,expires_at) WHERE revoked_at IS NULL;
CREATE TABLE plus_edit_drafts (
 id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL,
 order_id text NOT NULL, product_id text NOT NULL, manifest_id text NOT NULL, deliverable_id text NOT NULL,
 revision integer NOT NULL CHECK(revision>0), data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,owner_id,manifest_id,deliverable_id),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id),
 FOREIGN KEY(tenant_id,product_id) REFERENCES product_drafts(tenant_id,id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),
 FOREIGN KEY(tenant_id,manifest_id) REFERENCES delivery_manifests(tenant_id,id)
);
CREATE TABLE plus_edit_versions (
 draft_id text NOT NULL REFERENCES plus_edit_drafts(id) ON DELETE CASCADE,
 revision integer NOT NULL CHECK(revision>0), settings_hash text NOT NULL, settings jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(draft_id,revision)
);
CREATE TRIGGER immutable_plus_edit_version BEFORE UPDATE ON plus_edit_versions FOR EACH ROW EXECUTE FUNCTION ypcc_reject_mutation();
CREATE FUNCTION ypcc_forget_plus_drafts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='orders' THEN
  IF NEW.private->>'media_revoked'='true' THEN DELETE FROM plus_edit_drafts WHERE tenant_id=NEW.tenant_id AND order_id=NEW.id; END IF;
 ELSIF NEW.deleted_at IS NOT NULL THEN
  DELETE FROM plus_edit_drafts WHERE tenant_id=NEW.tenant_id AND product_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER forget_order_plus_drafts AFTER UPDATE OF private ON orders FOR EACH ROW EXECUTE FUNCTION ypcc_forget_plus_drafts();
CREATE TRIGGER forget_product_plus_drafts AFTER UPDATE OF deleted_at ON product_drafts FOR EACH ROW EXECUTE FUNCTION ypcc_forget_plus_drafts();
