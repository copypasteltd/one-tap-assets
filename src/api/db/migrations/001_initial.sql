-- Forward-only. Public DTO documents are projections; ownership, money, queues and
-- relationships remain typed relational columns with constraints.
CREATE TABLE tenants (id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE users (id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id));
CREATE TABLE platform_identities (
 id text PRIMARY KEY, tenant_id text NOT NULL, user_id text NOT NULL, platform text NOT NULL CHECK(platform IN ('ALIPAY','DOUYIN')),
 app_id text NOT NULL, subject_id text NOT NULL, data jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id), UNIQUE(platform,app_id,subject_id), UNIQUE(tenant_id,id)
);
CREATE TABLE sessions (
 id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, identity_id text NOT NULL,
 token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz,
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), FOREIGN KEY(tenant_id,identity_id) REFERENCES platform_identities(tenant_id,id)
);
CREATE TABLE product_drafts (
 id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 current_photo_version integer, current_profile_id text, data jsonb NOT NULL,
 deleted_at timestamptz, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), UNIQUE(tenant_id,id)
);
CREATE TABLE assets (
 id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, product_id text, purpose text NOT NULL,
 state text NOT NULL CHECK(state IN ('GRANTED','UPLOADED','VALIDATING','READY','REJECTED','DELETED','EXPIRED')),
 object_key text NOT NULL UNIQUE, upload_token_hash text NOT NULL, expected_bytes integer NOT NULL CHECK(expected_bytes BETWEEN 1 AND 10000000),
 declared_mime text NOT NULL CHECK(declared_mime IN ('image/jpeg','image/png')), sha256 text, expected_sha256 text,
 size_bytes integer, width integer, height integer, expires_at timestamptz NOT NULL, grant_expires_at timestamptz NOT NULL,
 data jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), FOREIGN KEY(tenant_id,product_id) REFERENCES product_drafts(tenant_id,id), UNIQUE(tenant_id,id)
);
CREATE TABLE product_photo_versions (
 id text PRIMARY KEY, tenant_id text NOT NULL, product_id text NOT NULL, revision integer NOT NULL CHECK(revision>0),
 photo_set_hash text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,product_id) REFERENCES product_drafts(tenant_id,id), UNIQUE(tenant_id,id), UNIQUE(tenant_id,product_id,revision)
);
CREATE TABLE product_photo_items (
 id text PRIMARY KEY, tenant_id text NOT NULL, photo_version_id text NOT NULL, asset_id text NOT NULL, position integer NOT NULL CHECK(position BETWEEN 0 AND 4),
 FOREIGN KEY(tenant_id,photo_version_id) REFERENCES product_photo_versions(tenant_id,id), FOREIGN KEY(tenant_id,asset_id) REFERENCES assets(tenant_id,id),
 UNIQUE(photo_version_id,asset_id), UNIQUE(photo_version_id,position)
);
CREATE TABLE analysis_jobs (
 id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, product_id text NOT NULL, photo_version_id text NOT NULL,
 input_hash text NOT NULL, state text NOT NULL, model_version text NOT NULL, deadline_at timestamptz NOT NULL,
 data jsonb NOT NULL, private jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), FOREIGN KEY(tenant_id,product_id) REFERENCES product_drafts(tenant_id,id),
 FOREIGN KEY(tenant_id,photo_version_id) REFERENCES product_photo_versions(tenant_id,id), UNIQUE(tenant_id,id), UNIQUE(tenant_id,product_id,input_hash)
);
CREATE TABLE profile_versions (
 id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, product_id text NOT NULL, photo_version_id text NOT NULL,
 revision integer NOT NULL CHECK(revision>0), profile_hash text NOT NULL, data jsonb NOT NULL, private jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), FOREIGN KEY(tenant_id,product_id) REFERENCES product_drafts(tenant_id,id),
 FOREIGN KEY(tenant_id,photo_version_id) REFERENCES product_photo_versions(tenant_id,id), UNIQUE(tenant_id,id), UNIQUE(tenant_id,product_id,revision)
);
CREATE TABLE identity_locks (
 id text PRIMARY KEY, tenant_id text NOT NULL, profile_id text NOT NULL, hash text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,profile_id) REFERENCES profile_versions(tenant_id,id), UNIQUE(tenant_id,id)
);
ALTER TABLE product_drafts ADD CONSTRAINT current_profile_fk FOREIGN KEY(tenant_id,current_profile_id) REFERENCES profile_versions(tenant_id,id);

CREATE TABLE source_recipes (id text PRIMARY KEY, repository text NOT NULL, commit_ref text NOT NULL, license text NOT NULL, source_hash text NOT NULL, data jsonb NOT NULL);
CREATE TABLE component_versions (id text PRIMARY KEY, type text NOT NULL, version text NOT NULL, data jsonb NOT NULL);
CREATE TABLE presets (id text PRIMARY KEY, author_id text, source text NOT NULL CHECK(source IN ('OFFICIAL','COMMUNITY')), current_version text NOT NULL, visibility text NOT NULL DEFAULT 'PUBLIC', data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE preset_versions (id text PRIMARY KEY, preset_id text NOT NULL REFERENCES presets(id), version text NOT NULL, parent_version_id text REFERENCES preset_versions(id), hash text NOT NULL, license_version text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(preset_id,version));
CREATE TABLE provider_model_versions (id text PRIMARY KEY, provider text NOT NULL, actual_model text NOT NULL, status text NOT NULL, version text NOT NULL, data jsonb NOT NULL, private jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE execution_variants (
 id text PRIMARY KEY, preset_version_id text NOT NULL REFERENCES preset_versions(id), variant_id text NOT NULL, version text NOT NULL,
 engine text NOT NULL CHECK(engine IN ('PHOTO_LAYOUT','PER_SHOT_AI','REFERENCE_FILM')), admission_state text NOT NULL DEFAULT 'NOT_EVALUATED',
 sale_enabled boolean NOT NULL DEFAULT false, price_fen integer CHECK(price_fen>=0), revision integer NOT NULL DEFAULT 0,
 data jsonb NOT NULL, private jsonb NOT NULL DEFAULT '{}', UNIQUE(variant_id,version), CHECK(NOT sale_enabled OR (admission_state='ADMITTED' AND price_fen IS NOT NULL))
);
CREATE TABLE resource_licenses (id text PRIMARY KEY, resource_id text NOT NULL, version text NOT NULL, expires_at timestamptz, revoked_at timestamptz, data jsonb NOT NULL, UNIQUE(resource_id,version));
CREATE TABLE character_versions (id text PRIMARY KEY, character_id text NOT NULL, version text NOT NULL, data jsonb NOT NULL, UNIQUE(character_id,version));

CREATE TABLE plan_versions (
 id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, product_id text NOT NULL, photo_version_id text NOT NULL,
 profile_id text NOT NULL, identity_lock_id text NOT NULL, variant_version_id text NOT NULL REFERENCES execution_variants(id), state text NOT NULL, plan_hash text,
 data jsonb NOT NULL, private jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), FOREIGN KEY(tenant_id,product_id) REFERENCES product_drafts(tenant_id,id),
 FOREIGN KEY(tenant_id,photo_version_id) REFERENCES product_photo_versions(tenant_id,id), FOREIGN KEY(tenant_id,profile_id) REFERENCES profile_versions(tenant_id,id),
 FOREIGN KEY(tenant_id,identity_lock_id) REFERENCES identity_locks(tenant_id,id), UNIQUE(tenant_id,id)
);
CREATE TABLE quotes (
 id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, plan_id text NOT NULL, plan_hash text NOT NULL,
 amount_fen integer NOT NULL CHECK(amount_fen>=0), expires_at timestamptz NOT NULL, state text NOT NULL CHECK(state IN ('ACTIVE','CONSUMED','EXPIRED','REVOKED')),
 consumed_order_id text, data jsonb NOT NULL, private jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), FOREIGN KEY(tenant_id,plan_id) REFERENCES plan_versions(tenant_id,id), UNIQUE(tenant_id,id)
);
CREATE TABLE orders (
 id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, quote_id text NOT NULL UNIQUE, channel text NOT NULL CHECK(channel IN ('ALIPAY','DOUYIN')),
 app_id text NOT NULL, subject_id text NOT NULL, amount_fen integer NOT NULL CHECK(amount_fen>=0), payment_state text NOT NULL, fulfillment_state text NOT NULL,
 payable_until timestamptz NOT NULL, delivery_expires_at timestamptz, budget_micro bigint NOT NULL CHECK(budget_micro>=0),
 spent_micro bigint NOT NULL DEFAULT 0 CHECK(spent_micro>=0), reserved_micro bigint NOT NULL DEFAULT 0 CHECK(reserved_micro>=0),
 deadline_at timestamptz, data jsonb NOT NULL, private jsonb NOT NULL, revision integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), FOREIGN KEY(tenant_id,quote_id) REFERENCES quotes(tenant_id,id), UNIQUE(tenant_id,id),
 CHECK(spent_micro+reserved_micro<=budget_micro)
);
ALTER TABLE quotes ADD CONSTRAINT consumed_order_fk FOREIGN KEY(tenant_id,consumed_order_id) REFERENCES orders(tenant_id,id);
CREATE TABLE execution_snapshots (id text PRIMARY KEY, tenant_id text NOT NULL, order_id text NOT NULL UNIQUE, hash text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id), UNIQUE(tenant_id,id));
CREATE TABLE payments (
 id text PRIMARY KEY, tenant_id text NOT NULL, order_id text NOT NULL UNIQUE, provider text NOT NULL, merchant_id text NOT NULL,
 provider_order_id text, state text NOT NULL, amount_fen integer NOT NULL CHECK(amount_fen>=0), intent_key text NOT NULL UNIQUE,
 data jsonb NOT NULL, private jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id), UNIQUE(tenant_id,id), UNIQUE(provider,merchant_id,provider_order_id)
);
CREATE TABLE payment_events (id text PRIMARY KEY, provider text NOT NULL, merchant_id text NOT NULL, event_key text NOT NULL, payment_id text NOT NULL REFERENCES payments(id), raw_hash text NOT NULL, verified_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider,merchant_id,event_key));
CREATE TABLE refunds (
 id text PRIMARY KEY, tenant_id text NOT NULL, order_id text NOT NULL UNIQUE, payment_id text NOT NULL, refund_intent_key text NOT NULL UNIQUE,
 state text NOT NULL, amount_fen integer NOT NULL CHECK(amount_fen>=0), provider text NOT NULL, merchant_id text NOT NULL, provider_ref text,
 data jsonb NOT NULL, private jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id), FOREIGN KEY(tenant_id,payment_id) REFERENCES payments(tenant_id,id), UNIQUE(tenant_id,id)
);
CREATE TABLE ledger_entries (
 id text PRIMARY KEY, tenant_id text NOT NULL, order_id text NOT NULL, event_key text NOT NULL UNIQUE, entry_type text NOT NULL CHECK(entry_type IN ('PAYMENT','REFUND')),
 amount_fen integer NOT NULL CHECK(amount_fen>=0), currency text NOT NULL CHECK(currency='CNY'), created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id)
);
CREATE TABLE render_jobs (
 id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, order_id text NOT NULL, execution_snapshot_id text NOT NULL,
 state text NOT NULL, deadline_at timestamptz NOT NULL, repair_rounds integer NOT NULL DEFAULT 0 CHECK(repair_rounds BETWEEN 0 AND 1),
 data jsonb NOT NULL, private jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id), FOREIGN KEY(tenant_id,execution_snapshot_id) REFERENCES execution_snapshots(tenant_id,id),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), UNIQUE(tenant_id,id)
);
CREATE TABLE stage_runs (
 id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), job_id text, scope_type text NOT NULL, scope_id text NOT NULL,
 stage_name text NOT NULL, attempt integer NOT NULL DEFAULT 1 CHECK(attempt BETWEEN 1 AND 2), input_hash text NOT NULL,
 state text NOT NULL DEFAULT 'READY', lease_owner text, lease_expires_at timestamptz, fencing_token bigint NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(), deadline_at timestamptz NOT NULL, dependencies text[] NOT NULL DEFAULT '{}',
 data jsonb NOT NULL, private jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,job_id) REFERENCES render_jobs(tenant_id,id), UNIQUE(scope_type,scope_id,stage_name,attempt), UNIQUE(tenant_id,id)
);
CREATE TABLE provider_submissions (
 id text PRIMARY KEY, tenant_id text NOT NULL, stage_run_id text NOT NULL, intent_key text NOT NULL UNIQUE, input_hash text NOT NULL,
 state text NOT NULL, provider_task_id text, reservation_id text, data jsonb NOT NULL, private jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,stage_run_id) REFERENCES stage_runs(tenant_id,id), UNIQUE(tenant_id,id)
);
CREATE TABLE budget_reservations (
 id text PRIMARY KEY, tenant_id text NOT NULL, order_id text NOT NULL, submission_id text, intent_key text NOT NULL UNIQUE,
 amount_micro bigint NOT NULL CHECK(amount_micro>=0), settled_micro bigint CHECK(settled_micro>=0), currency text NOT NULL, rate_snapshot jsonb NOT NULL,
 state text NOT NULL CHECK(state IN ('RESERVED','UNKNOWN','SETTLED','RELEASED')), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id), FOREIGN KEY(tenant_id,submission_id) REFERENCES provider_submissions(tenant_id,id), UNIQUE(tenant_id,id), CHECK(settled_micro IS NULL OR settled_micro<=amount_micro)
);
CREATE TABLE outbox_events (
 id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), aggregate_type text NOT NULL, aggregate_id text NOT NULL, event_key text NOT NULL UNIQUE,
 payload jsonb NOT NULL, available_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz, attempts integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE idempotency_records (
 id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), subject_id text NOT NULL, operation text NOT NULL, target_id text NOT NULL,
 key text NOT NULL, request_hash text NOT NULL, response jsonb NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,subject_id,operation,target_id,key)
);
CREATE TABLE artifacts (
 id text PRIMARY KEY, tenant_id text NOT NULL, order_id text NOT NULL, stage_run_id text NOT NULL, slot_id text NOT NULL,
 object_key text NOT NULL UNIQUE, sha256 text NOT NULL, spec_json jsonb NOT NULL, data jsonb NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id), FOREIGN KEY(tenant_id,stage_run_id) REFERENCES stage_runs(tenant_id,id), UNIQUE(tenant_id,id), UNIQUE(order_id,slot_id,id)
);
CREATE TABLE qc_decisions (id text PRIMARY KEY, tenant_id text NOT NULL, order_id text NOT NULL, artifact_id text, ruleset_version text NOT NULL, decision text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id), FOREIGN KEY(tenant_id,artifact_id) REFERENCES artifacts(tenant_id,id));
CREATE TABLE delivery_manifests (
 id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, order_id text NOT NULL, revision integer NOT NULL CHECK(revision>0), hash text NOT NULL,
 data jsonb NOT NULL, private jsonb NOT NULL DEFAULT '{}', delivered_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id), FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), UNIQUE(order_id,revision), UNIQUE(tenant_id,id)
);

CREATE TABLE quota_buckets (id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, kind text NOT NULL, window_start date NOT NULL, used_count integer NOT NULL CHECK(used_count>=0), limit_count integer NOT NULL CHECK(limit_count>=0), FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), UNIQUE(tenant_id,owner_id,kind,window_start), CHECK(used_count<=limit_count));
CREATE TABLE optional_previews (id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, product_id text NOT NULL, plan_id text NOT NULL, plan_hash text NOT NULL, state text NOT NULL, object_key text, expires_at timestamptz NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), FOREIGN KEY(tenant_id,product_id) REFERENCES product_drafts(tenant_id,id), FOREIGN KEY(tenant_id,plan_id) REFERENCES plan_versions(tenant_id,id), UNIQUE(tenant_id,id));
CREATE TABLE save_sessions (id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, order_id text NOT NULL, installation_id text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id), FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), UNIQUE(tenant_id,id));
CREATE TABLE save_receipts (id text PRIMARY KEY, tenant_id text NOT NULL, save_session_id text NOT NULL, deliverable_id text NOT NULL, attempt integer NOT NULL CHECK(attempt>0), state text NOT NULL, occurred_at timestamptz NOT NULL, data jsonb NOT NULL, FOREIGN KEY(tenant_id,save_session_id) REFERENCES save_sessions(tenant_id,id), UNIQUE(save_session_id,deliverable_id,attempt));
CREATE TABLE revision_requests (id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, order_id text NOT NULL, parent_manifest_revision integer NOT NULL, kind text NOT NULL, state text NOT NULL, consumes_user_allowance boolean NOT NULL, result_manifest_id text, data jsonb NOT NULL, private jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id), FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), FOREIGN KEY(tenant_id,result_manifest_id) REFERENCES delivery_manifests(tenant_id,id), UNIQUE(tenant_id,id));
CREATE UNIQUE INDEX successful_user_revision ON revision_requests(order_id) WHERE consumes_user_allowance AND state='SUCCEEDED';
CREATE TABLE support_tickets (id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, order_id text NOT NULL, category text NOT NULL, state text NOT NULL, data jsonb NOT NULL, private jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id), UNIQUE(tenant_id,id));
CREATE TABLE privacy_deletions (id text PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, state text NOT NULL, data jsonb NOT NULL, private jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id), UNIQUE(tenant_id,id));
CREATE TABLE audit_events (id text PRIMARY KEY, tenant_id text REFERENCES tenants(id), actor text NOT NULL, action text NOT NULL, target text NOT NULL, trace_id text NOT NULL, payload_hash text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now());

CREATE INDEX product_owner_idx ON product_drafts(tenant_id,owner_id,created_at DESC,id DESC);
CREATE INDEX order_owner_idx ON orders(tenant_id,owner_id,created_at DESC,id DESC);
CREATE INDEX stage_queue_idx ON stage_runs(available_at,created_at) WHERE state IN ('READY','CLAIMED','RUNNING','UNKNOWN');
CREATE INDEX outbox_pending_idx ON outbox_events(available_at) WHERE delivered_at IS NULL;
CREATE INDEX assets_expiry_idx ON assets(expires_at) WHERE state NOT IN ('DELETED','EXPIRED');
CREATE INDEX manifests_expiry_idx ON delivery_manifests(expires_at);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

-- Prevent accidental writes to frozen sold/creative snapshots, even from an operator.
CREATE FUNCTION ypcc_reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutable snapshot'; END $$;
CREATE TRIGGER immutable_execution_snapshot BEFORE UPDATE ON execution_snapshots FOR EACH ROW EXECUTE FUNCTION ypcc_reject_mutation();
CREATE TRIGGER immutable_preset_version BEFORE UPDATE ON preset_versions FOR EACH ROW EXECUTE FUNCTION ypcc_reject_mutation();
CREATE TRIGGER immutable_manifest BEFORE UPDATE ON delivery_manifests FOR EACH ROW EXECUTE FUNCTION ypcc_reject_mutation();
CREATE TRIGGER immutable_profile BEFORE UPDATE ON profile_versions FOR EACH ROW EXECUTE FUNCTION ypcc_reject_mutation();
CREATE TRIGGER immutable_identity_lock BEFORE UPDATE ON identity_locks FOR EACH ROW EXECUTE FUNCTION ypcc_reject_mutation();
