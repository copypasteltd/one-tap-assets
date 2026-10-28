CREATE TABLE platform_budget_reservations (
 id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), account_id text NOT NULL REFERENCES platform_cost_accounts(id),
 intent_key text NOT NULL UNIQUE, amount_micro bigint NOT NULL CHECK(amount_micro>=0), settled_micro bigint,
 state text NOT NULL CHECK(state IN ('RESERVED','UNKNOWN','SETTLED','RELEASED')), rate_snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 CHECK(settled_micro IS NULL OR (settled_micro>=0 AND settled_micro<=amount_micro))
);
CREATE INDEX overdue_order_work_idx ON orders(deadline_at) WHERE fulfillment_state IN ('QUEUED','IN_PROGRESS');
CREATE INDEX overdue_stage_work_idx ON stage_runs(deadline_at) WHERE state IN ('READY','UNKNOWN','CLAIMED','RUNNING');
