-- Durable claims are fenced independently from business state. No transient
-- process, browser or client storage is the source of truth for execution.
ALTER TABLE outbox_events ADD COLUMN lease_owner text;
ALTER TABLE outbox_events ADD COLUMN lease_expires_at timestamptz;
ALTER TABLE outbox_events ADD COLUMN fencing_token bigint NOT NULL DEFAULT 0;
ALTER TABLE outbox_events ADD COLUMN last_error_code text;
ALTER TABLE agent_tool_intents ADD COLUMN tool_name text;
ALTER TABLE agent_tool_intents ADD COLUMN stage_run_id text;
ALTER TABLE agent_tool_intents ADD COLUMN lease_owner text;
ALTER TABLE agent_tool_intents ADD COLUMN lease_expires_at timestamptz;
ALTER TABLE agent_tool_intents ADD COLUMN fencing_token bigint NOT NULL DEFAULT 0;
ALTER TABLE agent_tool_intents ADD COLUMN available_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE agent_tool_intents ADD FOREIGN KEY(tenant_id,stage_run_id) REFERENCES stage_runs(tenant_id,id);
CREATE INDEX tool_work_idx ON agent_tool_intents(available_at) WHERE state IN ('QUEUED','RUNNING','UNKNOWN');
CREATE TABLE agent_capabilities (
 id text PRIMARY KEY, token_hash text NOT NULL UNIQUE, tenant_id text NOT NULL,
 instance_id text NOT NULL, run_id text NOT NULL, stage_run_id text NOT NULL,
 stage_fencing_token bigint NOT NULL, instance_fencing_token bigint NOT NULL,
 snapshot_hash text NOT NULL, packet_hash text, expires_at timestamptz NOT NULL,
 revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,instance_id) REFERENCES agent_instances(tenant_id,id),
 FOREIGN KEY(tenant_id,run_id) REFERENCES agent_runs(tenant_id,id),
 FOREIGN KEY(tenant_id,stage_run_id) REFERENCES stage_runs(tenant_id,id)
);
CREATE TABLE platform_cost_accounts (
 id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), scope_id text NOT NULL,
 ceiling_micro bigint NOT NULL CHECK(ceiling_micro>=0), reserved_micro bigint NOT NULL DEFAULT 0,
 spent_micro bigint NOT NULL DEFAULT 0, deadline_at timestamptz NOT NULL,
 CHECK(reserved_micro>=0 AND spent_micro>=0 AND reserved_micro+spent_micro<=ceiling_micro),
 UNIQUE(tenant_id,scope_id)
);
CREATE TABLE inference_requests (
 id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), run_id text NOT NULL,
 intent_key text NOT NULL UNIQUE, request_hash text NOT NULL, state text NOT NULL,
 reserved_micro bigint NOT NULL CHECK(reserved_micro>=0), actual_micro bigint,
 scope_type text NOT NULL CHECK(scope_type IN ('ORDER','PLATFORM')), scope_id text NOT NULL,
 response_key text, data jsonb NOT NULL, private jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,run_id) REFERENCES agent_runs(tenant_id,id)
);
CREATE TABLE deletion_markers (
 id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), owner_id text NOT NULL,
 target_type text NOT NULL, target_id text NOT NULL, request_id text NOT NULL,
 deleted_at timestamptz NOT NULL DEFAULT now(), data jsonb NOT NULL,
 UNIQUE(tenant_id,target_type,target_id)
);
CREATE TABLE worker_heartbeats (
 id text PRIMARY KEY, last_seen_at timestamptz NOT NULL DEFAULT now(), data jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX inference_unresolved_idx ON inference_requests(state) WHERE state IN ('SUBMITTING','UNKNOWN');
