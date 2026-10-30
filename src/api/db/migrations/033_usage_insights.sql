-- Optional buyer feedback is mutable and separate from immutable delivery data.
CREATE TABLE order_usage_feedback (
 tenant_id text NOT NULL, owner_id text NOT NULL, order_id text NOT NULL,
 choice text CHECK(choice IN ('PLANNED_USE','USED','NEEDS_ADJUSTMENT')),
 revision integer NOT NULL CHECK(revision>0), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,order_id),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id)
);
CREATE INDEX usage_feedback_window_idx ON order_usage_feedback(updated_at);
CREATE TABLE metrics_traffic_classifications (
 tenant_id text NOT NULL, owner_id text NOT NULL, traffic_group text NOT NULL CHECK(traffic_group IN ('UNCLASSIFIED','INTERNAL_TEST','EXTERNAL')),
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,owner_id),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id)
);
-- Old receipts only carry a client clock. Do not invent a server receipt time.
ALTER TABLE save_receipts ADD COLUMN received_at timestamptz;
ALTER TABLE save_receipts ALTER COLUMN received_at SET DEFAULT now();
CREATE FUNCTION ypcc_save_receipt_server_time() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.state IS DISTINCT FROM OLD.state THEN NEW.received_at=now(); ELSE NEW.received_at=OLD.received_at; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER save_receipt_server_time BEFORE UPDATE ON save_receipts FOR EACH ROW EXECUTE FUNCTION ypcc_save_receipt_server_time();
ALTER TABLE platform_cost_accounts ADD COLUMN owner_id text;
ALTER TABLE platform_cost_accounts ADD FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id);
UPDATE platform_cost_accounts a SET owner_id=u.id FROM users u
 WHERE u.tenant_id=a.tenant_id AND u.id=split_part(a.scope_id,':',2);
CREATE FUNCTION ypcc_usage_feedback_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM orders o JOIN privacy_order_scope s ON s.tenant_id=o.tenant_id AND s.id=o.id
   JOIN product_drafts p ON p.tenant_id=s.tenant_id AND p.id=s.product_id
   WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.order_id AND o.owner_id=NEW.owner_id
   AND o.payment_state='CONFIRMED' AND o.fulfillment_state='DELIVERED'
   AND o.private->>'media_revoked' IS DISTINCT FROM 'true' AND p.deleted_at IS NULL) THEN
   RAISE EXCEPTION 'feedback scope unavailable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER usage_feedback_scope BEFORE INSERT OR UPDATE ON order_usage_feedback FOR EACH ROW EXECUTE FUNCTION ypcc_usage_feedback_scope();
CREATE FUNCTION ypcc_forget_usage_feedback() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='orders' THEN
   IF NEW.private->>'media_revoked'='true' THEN DELETE FROM order_usage_feedback WHERE tenant_id=NEW.tenant_id AND order_id=NEW.id; END IF;
 ELSIF NEW.deleted_at IS NOT NULL THEN
   DELETE FROM order_usage_feedback f USING privacy_order_scope s
    WHERE s.tenant_id=NEW.tenant_id AND s.product_id=NEW.id AND f.tenant_id=s.tenant_id AND f.order_id=s.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER forget_order_feedback AFTER UPDATE OF private ON orders FOR EACH ROW EXECUTE FUNCTION ypcc_forget_usage_feedback();
CREATE TRIGGER forget_product_feedback AFTER UPDATE OF deleted_at ON product_drafts FOR EACH ROW EXECUTE FUNCTION ypcc_forget_usage_feedback();
