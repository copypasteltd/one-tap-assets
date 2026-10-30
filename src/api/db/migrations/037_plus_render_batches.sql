CREATE TABLE plus_render_batches (
 id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL,
 request_key_hash text NOT NULL, input_hash text NOT NULL,
 item_count integer NOT NULL CHECK(item_count BETWEEN 2 AND 10),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,owner_id,request_key_hash),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id)
);
CREATE TABLE plus_render_batch_items (
 id text PRIMARY KEY, tenant_id text NOT NULL, batch_id text NOT NULL,
 position integer NOT NULL CHECK(position BETWEEN 1 AND 10),
 product_id text, request_id text, input jsonb NOT NULL, failure jsonb,
 UNIQUE(tenant_id,batch_id,position),
 FOREIGN KEY(tenant_id,batch_id) REFERENCES plus_render_batches(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,product_id) REFERENCES product_drafts(tenant_id,id),
 FOREIGN KEY(tenant_id,request_id) REFERENCES plus_render_plans(tenant_id,id) ON DELETE CASCADE,
 CHECK((request_id IS NOT NULL AND failure IS NULL) OR (request_id IS NULL AND failure IS NOT NULL))
);
CREATE INDEX plus_render_batches_owner_idx ON plus_render_batches(tenant_id,owner_id,created_at DESC,id DESC);
CREATE INDEX plus_render_batch_items_product_idx ON plus_render_batch_items(tenant_id,product_id);
CREATE TRIGGER immutable_plus_render_batch BEFORE UPDATE ON plus_render_batches FOR EACH ROW EXECUTE FUNCTION ypcc_reject_mutation();
CREATE TRIGGER immutable_plus_render_batch_item BEFORE UPDATE ON plus_render_batch_items FOR EACH ROW EXECUTE FUNCTION ypcc_reject_mutation();
CREATE FUNCTION ypcc_forget_plus_batch_items() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.deleted_at IS NOT NULL THEN DELETE FROM plus_render_batch_items WHERE tenant_id=NEW.tenant_id AND product_id=NEW.id; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER forget_product_plus_batch_items AFTER UPDATE OF deleted_at ON product_drafts FOR EACH ROW EXECUTE FUNCTION ypcc_forget_plus_batch_items();
