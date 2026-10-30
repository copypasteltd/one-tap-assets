ALTER TABLE plus_links ADD COLUMN allow_render_plans boolean NOT NULL DEFAULT false;
ALTER TABLE plus_sessions ADD COLUMN allow_render_plans boolean NOT NULL DEFAULT false;
CREATE TABLE plus_render_plans (
 id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, product_id text NOT NULL,
 draft_id text NOT NULL, draft_revision integer NOT NULL CHECK(draft_revision>0),
 source_order_id text NOT NULL, plan_id text NOT NULL, input_hash text NOT NULL,
 binding jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,owner_id,input_hash), UNIQUE(tenant_id,plan_id),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id),
 FOREIGN KEY(tenant_id,product_id) REFERENCES product_drafts(tenant_id,id),
 FOREIGN KEY(tenant_id,source_order_id) REFERENCES orders(tenant_id,id),
 FOREIGN KEY(tenant_id,plan_id) REFERENCES plan_versions(tenant_id,id)
);
CREATE INDEX plus_render_plans_owner_idx ON plus_render_plans(tenant_id,owner_id,created_at DESC,id DESC);
CREATE TRIGGER immutable_plus_render_plan BEFORE UPDATE ON plus_render_plans FOR EACH ROW EXECUTE FUNCTION ypcc_reject_mutation();
CREATE FUNCTION ypcc_forget_plus_render_plans() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.deleted_at IS NOT NULL THEN DELETE FROM plus_render_plans WHERE tenant_id=NEW.tenant_id AND product_id=NEW.id; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER forget_product_plus_render_plans AFTER UPDATE OF deleted_at ON product_drafts FOR EACH ROW EXECUTE FUNCTION ypcc_forget_plus_render_plans();
