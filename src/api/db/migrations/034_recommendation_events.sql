CREATE TABLE metrics_collection_epochs (
 id text PRIMARY KEY, started_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO metrics_collection_epochs(id) VALUES('recommendation-visible-v1');
CREATE TABLE recommendation_events (
 tenant_id text NOT NULL, owner_id text NOT NULL, product_id text NOT NULL,
 profile_id text NOT NULL, preset_version_id text NOT NULL, policy text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('IMPRESSION','CLICK')),
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,owner_id,product_id,profile_id,preset_version_id,policy,kind),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id),
 FOREIGN KEY(tenant_id,product_id) REFERENCES product_drafts(tenant_id,id),
 FOREIGN KEY(tenant_id,profile_id) REFERENCES profile_versions(tenant_id,id),
 FOREIGN KEY(preset_version_id) REFERENCES preset_versions(id)
);
CREATE INDEX recommendation_events_window_idx ON recommendation_events(received_at);
CREATE FUNCTION ypcc_forget_recommendation_events() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.deleted_at IS NOT NULL THEN
  DELETE FROM recommendation_events WHERE tenant_id=NEW.tenant_id AND product_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER forget_product_recommendation_events AFTER UPDATE OF deleted_at ON product_drafts
 FOR EACH ROW EXECUTE FUNCTION ypcc_forget_recommendation_events();
