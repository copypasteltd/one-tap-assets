-- One pre-delivery repair uses the original order account. This is a cost
-- authorization, never a new sale, deadline, model contract or publication grant.
CREATE TABLE repair_cost_authorizations (
 id text PRIMARY KEY, tenant_id text NOT NULL, order_id text NOT NULL, job_id text NOT NULL,
 source_packet_id text NOT NULL, source_packet_hash text NOT NULL CHECK(source_packet_hash ~ '^[a-f0-9]{64}$'),
 snapshot_hash text NOT NULL CHECK(snapshot_hash ~ '^[a-f0-9]{64}$'), binding_hash text NOT NULL CHECK(binding_hash ~ '^[a-f0-9]{64}$'),
 ceiling_micro bigint NOT NULL CHECK(ceiling_micro>0), extra_calls_limit integer NOT NULL CHECK(extra_calls_limit>0),
 deadline_at timestamptz NOT NULL, stage_ids text[] NOT NULL CHECK(cardinality(stage_ids)=6),
 generation_nodes jsonb NOT NULL CHECK(jsonb_typeof(generation_nodes)='array'), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,order_id), UNIQUE(tenant_id,job_id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),
 FOREIGN KEY(tenant_id,job_id) REFERENCES render_jobs(tenant_id,id),
 FOREIGN KEY(tenant_id,source_packet_id) REFERENCES review_packets(tenant_id,id)
);
CREATE FUNCTION ypcc_immutable_repair_cost_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'original repair cost authorization is immutable';
END $$;
CREATE TRIGGER immutable_repair_cost_authorization BEFORE UPDATE OR DELETE ON repair_cost_authorizations
 FOR EACH ROW EXECUTE FUNCTION ypcc_immutable_repair_cost_authorization();

-- Historical rows remain FIRST_PASS. No old liability is relabelled as a
-- repair or released by this migration.
ALTER TABLE budget_reservations ADD COLUMN purpose text NOT NULL DEFAULT 'FIRST_PASS' CHECK(purpose IN ('FIRST_PASS','REPAIR'));
ALTER TABLE budget_reservations ADD COLUMN repair_authorization_id text;
ALTER TABLE budget_reservations ADD COLUMN repair_stage_id text;
ALTER TABLE budget_reservations ADD COLUMN repair_node_key text;
ALTER TABLE budget_reservations ADD FOREIGN KEY(tenant_id,repair_authorization_id) REFERENCES repair_cost_authorizations(tenant_id,id);
ALTER TABLE budget_reservations ADD FOREIGN KEY(tenant_id,repair_stage_id) REFERENCES stage_runs(tenant_id,id);
ALTER TABLE budget_reservations ADD CHECK((purpose='FIRST_PASS' AND repair_authorization_id IS NULL AND repair_stage_id IS NULL AND repair_node_key IS NULL)
 OR (purpose='REPAIR' AND repair_authorization_id IS NOT NULL AND repair_stage_id IS NOT NULL AND repair_node_key IS NOT NULL));
CREATE UNIQUE INDEX one_extra_generation_per_repair_node ON budget_reservations(tenant_id,repair_authorization_id,repair_node_key)
 WHERE purpose='REPAIR' AND (repair_node_key LIKE 'IMAGE:%' OR repair_node_key LIKE 'VIDEO:%');
CREATE FUNCTION ypcc_protect_order_cost_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id,NEW.tenant_id,NEW.order_id,NEW.intent_key,NEW.amount_micro,NEW.currency,NEW.rate_snapshot,NEW.created_at,
     NEW.purpose,NEW.repair_authorization_id,NEW.repair_stage_id,NEW.repair_node_key)
  IS DISTINCT FROM
    (OLD.id,OLD.tenant_id,OLD.order_id,OLD.intent_key,OLD.amount_micro,OLD.currency,OLD.rate_snapshot,OLD.created_at,
     OLD.purpose,OLD.repair_authorization_id,OLD.repair_stage_id,OLD.repair_node_key)
 THEN RAISE EXCEPTION 'original order cost binding is immutable'; END IF;
 IF OLD.submission_id IS NOT NULL AND NEW.submission_id IS DISTINCT FROM OLD.submission_id
 THEN RAISE EXCEPTION 'original order submission is immutable'; END IF;
 IF OLD.purpose='REPAIR' AND OLD.state IN ('SETTLED','RELEASED') AND (NEW.state,NEW.settled_micro) IS DISTINCT FROM (OLD.state,OLD.settled_micro)
 THEN RAISE EXCEPTION 'original order settlement is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_order_cost_binding BEFORE UPDATE ON budget_reservations
 FOR EACH ROW EXECUTE FUNCTION ypcc_protect_order_cost_binding();
