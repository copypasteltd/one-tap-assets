CREATE TABLE rights_records (id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, scope text NOT NULL, state text NOT NULL, revision integer NOT NULL DEFAULT 0, data jsonb NOT NULL, private jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), UNIQUE(tenant_id,id));
CREATE TABLE preset_drafts (id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, revision integer NOT NULL DEFAULT 0, parent_version_id text REFERENCES preset_versions(id), data jsonb NOT NULL, private jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), UNIQUE(tenant_id,id));
CREATE TABLE publications (id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, draft_id text NOT NULL, draft_revision integer NOT NULL, review_state text NOT NULL, admission_state text NOT NULL, published_version_id text REFERENCES preset_versions(id), data jsonb NOT NULL, private jsonb NOT NULL, revision integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), FOREIGN KEY(tenant_id,draft_id) REFERENCES preset_drafts(tenant_id,id), UNIQUE(tenant_id,id), UNIQUE(draft_id,draft_revision));
CREATE TABLE public_samples (id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, draft_id text NOT NULL, visibility text NOT NULL DEFAULT 'PRIVATE', state text NOT NULL, data jsonb NOT NULL, private jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), FOREIGN KEY(tenant_id,draft_id) REFERENCES preset_drafts(tenant_id,id), UNIQUE(tenant_id,id));
CREATE TABLE favorites (id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, preset_id text NOT NULL REFERENCES presets(id), data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), UNIQUE(tenant_id,owner_id,preset_id));
CREATE TABLE forks (id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, parent_version_id text NOT NULL REFERENCES preset_versions(id), draft_id text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), FOREIGN KEY(tenant_id,draft_id) REFERENCES preset_drafts(tenant_id,id));
CREATE TABLE moderation_reports (id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, preset_version_id text NOT NULL REFERENCES preset_versions(id), state text NOT NULL, revision integer NOT NULL DEFAULT 0, data jsonb NOT NULL, private jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), UNIQUE(tenant_id,id));
CREATE TABLE moderation_appeals (id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, report_id text NOT NULL REFERENCES moderation_reports(id), state text NOT NULL, data jsonb NOT NULL, private jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), UNIQUE(tenant_id,id));

CREATE TABLE analysis_attempts (id text PRIMARY KEY, tenant_id text NOT NULL, analysis_id text NOT NULL, attempt integer NOT NULL CHECK(attempt BETWEEN 1 AND 2), request_hash text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,analysis_id) REFERENCES analysis_jobs(tenant_id,id), UNIQUE(analysis_id,attempt));
CREATE TABLE correction_versions (id text PRIMARY KEY, tenant_id text NOT NULL, product_id text NOT NULL, parent_profile_id text NOT NULL, new_profile_id text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,product_id) REFERENCES product_drafts(tenant_id,id), FOREIGN KEY(tenant_id,parent_profile_id) REFERENCES profile_versions(tenant_id,id), FOREIGN KEY(tenant_id,new_profile_id) REFERENCES profile_versions(tenant_id,id));
CREATE TABLE scene_locks (id text PRIMARY KEY, tenant_id text NOT NULL, plan_id text NOT NULL, hash text NOT NULL, data jsonb NOT NULL, FOREIGN KEY(tenant_id,plan_id) REFERENCES plan_versions(tenant_id,id), UNIQUE(tenant_id,id));
CREATE TABLE shot_plans (id text PRIMARY KEY, tenant_id text NOT NULL, plan_id text NOT NULL, shot_id text NOT NULL, start_frame integer NOT NULL, end_frame integer NOT NULL, data jsonb NOT NULL, FOREIGN KEY(tenant_id,plan_id) REFERENCES plan_versions(tenant_id,id), UNIQUE(tenant_id,id), UNIQUE(plan_id,shot_id), CHECK(start_frame>=0 AND end_frame>start_frame));
CREATE TABLE reference_frame_sets (id text PRIMARY KEY, tenant_id text NOT NULL, plan_id text NOT NULL, shot_id text NOT NULL, quality_decision text NOT NULL, data jsonb NOT NULL, FOREIGN KEY(tenant_id,plan_id) REFERENCES plan_versions(tenant_id,id), UNIQUE(tenant_id,id));

CREATE TABLE skill_versions (id text PRIMARY KEY, name text NOT NULL, version text NOT NULL, content_hash text NOT NULL, trust_state text NOT NULL, data jsonb NOT NULL, UNIQUE(name,version,content_hash));
CREATE TABLE skill_bundles (id text PRIMARY KEY, version text NOT NULL, bundle_hash text NOT NULL UNIQUE, state text NOT NULL, data jsonb NOT NULL, private jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE agent_instances (
 id text PRIMARY KEY, tenant_id text NOT NULL, order_id text, preview_session_id text, state text NOT NULL,
 fencing_token bigint NOT NULL DEFAULT 1, os_identity_ref text, workspace_ref text NOT NULL, lease_expires_at timestamptz NOT NULL,
 data jsonb NOT NULL, private jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id), UNIQUE(tenant_id,id), CHECK((order_id IS NULL) <> (preview_session_id IS NULL))
);
CREATE TABLE agent_runs (
 id text PRIMARY KEY, tenant_id text NOT NULL, instance_id text NOT NULL, role text NOT NULL CHECK(role IN ('CONTENT','PRODUCTION','POST','REVIEW_FACTS','REVIEW_STYLE')),
 thread_id text, turn_id text, runtime_process_ref text, role_identity_ref text, role_workspace_ref text NOT NULL, state text NOT NULL,
 input_hash text NOT NULL, output_hash text, checkpoint_hash text, spent_micro bigint NOT NULL DEFAULT 0 CHECK(spent_micro>=0),
 data jsonb NOT NULL, private jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,instance_id) REFERENCES agent_instances(tenant_id,id), UNIQUE(tenant_id,id)
);
CREATE TABLE skill_load_evidence (id text PRIMARY KEY, tenant_id text NOT NULL, run_id text NOT NULL, bundle_hash text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,run_id) REFERENCES agent_runs(tenant_id,id));
CREATE TABLE agent_cost_reservations (
 id text PRIMARY KEY, tenant_id text NOT NULL, order_id text, preview_session_id text, subject_ref text NOT NULL, run_id text NOT NULL,
 idempotency_key text NOT NULL UNIQUE, amount_micro bigint NOT NULL CHECK(amount_micro>=0), state text NOT NULL,
 provider_reservation_id text, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id), FOREIGN KEY(tenant_id,run_id) REFERENCES agent_runs(tenant_id,id), UNIQUE(tenant_id,id), CHECK((order_id IS NULL) <> (preview_session_id IS NULL))
);
CREATE TABLE agent_tool_intents (
 id text PRIMARY KEY, tenant_id text NOT NULL, order_id text, preview_session_id text, subject_ref text NOT NULL, run_id text NOT NULL,
 idempotency_key text NOT NULL UNIQUE, request_hash text NOT NULL, reservation_id text, provider_submission_id text, state text NOT NULL,
 data jsonb NOT NULL, private jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id), FOREIGN KEY(tenant_id,run_id) REFERENCES agent_runs(tenant_id,id),
 FOREIGN KEY(tenant_id,reservation_id) REFERENCES agent_cost_reservations(tenant_id,id), FOREIGN KEY(tenant_id,provider_submission_id) REFERENCES provider_submissions(tenant_id,id),
 UNIQUE(tenant_id,id), CHECK((order_id IS NULL) <> (preview_session_id IS NULL))
);
CREATE TABLE review_packets (id text PRIMARY KEY, tenant_id text NOT NULL, order_id text NOT NULL, snapshot_hash text NOT NULL, output_set_hash text NOT NULL, packet_hash text NOT NULL, state text NOT NULL, data jsonb NOT NULL, private jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id), UNIQUE(tenant_id,id), UNIQUE(order_id,packet_hash));
CREATE TABLE review_reports (id text PRIMARY KEY, tenant_id text NOT NULL, packet_id text NOT NULL, run_id text NOT NULL, thread_id text NOT NULL, role text NOT NULL CHECK(role IN ('REVIEW_FACTS','REVIEW_STYLE')), verdict text NOT NULL, evidence_hash text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,packet_id) REFERENCES review_packets(tenant_id,id), FOREIGN KEY(tenant_id,run_id) REFERENCES agent_runs(tenant_id,id), UNIQUE(packet_id,role,run_id));
CREATE TABLE cleanup_receipts (id text PRIMARY KEY, tenant_id text NOT NULL, instance_id text NOT NULL, fencing_token bigint NOT NULL, state text NOT NULL, evidence_hash text NOT NULL, data jsonb NOT NULL, verified_at timestamptz NOT NULL, FOREIGN KEY(tenant_id,instance_id) REFERENCES agent_instances(tenant_id,id), UNIQUE(instance_id,fencing_token));
CREATE INDEX instance_reap_idx ON agent_instances(lease_expires_at) WHERE state<>'RELEASED';
CREATE INDEX run_instance_idx ON agent_runs(tenant_id,instance_id);
CREATE INDEX publication_queue_idx ON publications(review_state,created_at);
CREATE INDEX report_queue_idx ON moderation_reports(state,created_at);
CREATE INDEX privacy_queue_idx ON privacy_deletions(state,created_at);

-- Operator actions and proven admission are implementation extensions to the 67 logical entities.
CREATE TABLE management_actions (id text PRIMARY KEY, tenant_id text, actor text NOT NULL, operation text NOT NULL, target_id text NOT NULL, data jsonb NOT NULL, private jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE admission_evidence (id text PRIMARY KEY, variant_version_id text REFERENCES execution_variants(id), kind text NOT NULL, evidence_hash text NOT NULL, passed boolean NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE platform_bindings (id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), owner_id text NOT NULL, proof_hash text NOT NULL UNIQUE, target_identity_id text REFERENCES platform_identities(id), expires_at timestamptz NOT NULL, consumed_at timestamptz, FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id));
