-- Resolve ownership through relational columns, which survive content redaction.
CREATE VIEW privacy_order_scope AS
 SELECT o.id,o.tenant_id,o.owner_id,p.product_id FROM orders o
 JOIN quotes q ON q.tenant_id=o.tenant_id AND q.id=o.quote_id AND q.owner_id=o.owner_id
 JOIN plan_versions p ON p.tenant_id=q.tenant_id AND p.id=q.plan_id AND p.owner_id=o.owner_id;
CREATE VIEW privacy_stage_scope AS
 SELECT t.id,t.tenant_id,p.owner_id,p.product_id,NULL::text AS order_id FROM stage_runs t
 JOIN plan_versions p ON p.tenant_id=t.tenant_id AND p.id=t.scope_id WHERE t.scope_type='PLAN'
 UNION ALL SELECT t.id,t.tenant_id,a.owner_id,a.product_id,NULL FROM stage_runs t
 JOIN analysis_jobs a ON a.tenant_id=t.tenant_id AND a.id=t.scope_id WHERE t.scope_type='ANALYSIS'
 UNION ALL SELECT t.id,t.tenant_id,p.owner_id,p.product_id,NULL FROM stage_runs t
 JOIN optional_previews p ON p.tenant_id=t.tenant_id AND p.id=t.scope_id WHERE t.scope_type='PREVIEW'
 UNION ALL SELECT t.id,t.tenant_id,o.owner_id,o.product_id,o.id FROM stage_runs t
 JOIN privacy_order_scope o ON o.tenant_id=t.tenant_id AND o.id=t.scope_id WHERE t.scope_type='ORDER'
 UNION ALL SELECT t.id,t.tenant_id,o.owner_id,o.product_id,o.id FROM stage_runs t
 JOIN revision_requests r ON r.tenant_id=t.tenant_id AND r.id=t.scope_id
 JOIN privacy_order_scope o ON o.tenant_id=r.tenant_id AND o.id=r.order_id WHERE t.scope_type='REVISION';
CREATE VIEW privacy_instance_scope AS
 SELECT i.id,i.tenant_id,o.owner_id,o.product_id,o.id AS order_id FROM agent_instances i
 JOIN privacy_order_scope o ON o.tenant_id=i.tenant_id AND o.id=i.order_id
 UNION ALL SELECT i.id,i.tenant_id,p.owner_id,p.product_id,NULL FROM agent_instances i
 JOIN plan_versions p ON p.tenant_id=i.tenant_id AND p.id=i.preview_session_id WHERE i.order_id IS NULL
 UNION ALL SELECT i.id,i.tenant_id,a.owner_id,a.product_id,NULL FROM agent_instances i
 JOIN analysis_jobs a ON a.tenant_id=i.tenant_id AND a.id=i.preview_session_id WHERE i.order_id IS NULL
 UNION ALL SELECT i.id,i.tenant_id,p.owner_id,p.product_id,NULL FROM agent_instances i
 JOIN optional_previews p ON p.tenant_id=i.tenant_id AND p.id=i.preview_session_id WHERE i.order_id IS NULL;
CREATE VIEW privacy_run_scope AS
 SELECT r.id,r.tenant_id,i.owner_id,i.product_id,i.order_id FROM agent_runs r
 JOIN privacy_instance_scope i ON i.tenant_id=r.tenant_id AND i.id=r.instance_id;

CREATE VIEW privacy_content_scope AS
 SELECT 'product_drafts'::text AS table_name,p.id,p.tenant_id,p.owner_id,p.id AS product_id,NULL::text AS order_id,NULL::text AS asset_id FROM product_drafts p
 UNION ALL SELECT 'assets',a.id,a.tenant_id,a.owner_id,a.product_id,NULL,a.id FROM assets a
 UNION ALL SELECT 'product_photo_versions',v.id,v.tenant_id,p.owner_id,v.product_id,NULL,NULL FROM product_photo_versions v JOIN product_drafts p ON p.tenant_id=v.tenant_id AND p.id=v.product_id
 UNION ALL SELECT 'profile_versions',p.id,p.tenant_id,p.owner_id,p.product_id,NULL,NULL FROM profile_versions p
 UNION ALL SELECT 'identity_locks',i.id,i.tenant_id,p.owner_id,p.product_id,NULL,NULL FROM identity_locks i JOIN profile_versions p ON p.tenant_id=i.tenant_id AND p.id=i.profile_id
 UNION ALL SELECT 'correction_versions',c.id,c.tenant_id,p.owner_id,c.product_id,NULL,NULL FROM correction_versions c JOIN product_drafts p ON p.tenant_id=c.tenant_id AND p.id=c.product_id
 UNION ALL SELECT 'analysis_jobs',a.id,a.tenant_id,a.owner_id,a.product_id,NULL,NULL FROM analysis_jobs a
 UNION ALL SELECT 'analysis_attempts',r.id,r.tenant_id,a.owner_id,a.product_id,NULL,NULL FROM analysis_attempts r JOIN analysis_jobs a ON a.tenant_id=r.tenant_id AND a.id=r.analysis_id
 UNION ALL SELECT 'plan_versions',p.id,p.tenant_id,p.owner_id,p.product_id,NULL,NULL FROM plan_versions p
 UNION ALL SELECT 'scene_locks',s.id,s.tenant_id,p.owner_id,p.product_id,NULL,NULL FROM scene_locks s JOIN plan_versions p ON p.tenant_id=s.tenant_id AND p.id=s.plan_id
 UNION ALL SELECT 'shot_plans',s.id,s.tenant_id,p.owner_id,p.product_id,NULL,NULL FROM shot_plans s JOIN plan_versions p ON p.tenant_id=s.tenant_id AND p.id=s.plan_id
 UNION ALL SELECT 'reference_frame_sets',s.id,s.tenant_id,p.owner_id,p.product_id,NULL,NULL FROM reference_frame_sets s JOIN plan_versions p ON p.tenant_id=s.tenant_id AND p.id=s.plan_id
 UNION ALL SELECT 'optional_previews',p.id,p.tenant_id,p.owner_id,p.product_id,NULL,NULL FROM optional_previews p
 UNION ALL SELECT 'quotes',q.id,q.tenant_id,q.owner_id,p.product_id,NULL,NULL FROM quotes q JOIN plan_versions p ON p.tenant_id=q.tenant_id AND p.id=q.plan_id AND p.owner_id=q.owner_id
 UNION ALL SELECT 'orders',o.id,o.tenant_id,o.owner_id,o.product_id,o.id,NULL FROM privacy_order_scope o
 UNION ALL SELECT 'execution_snapshots',s.id,s.tenant_id,o.owner_id,o.product_id,o.id,NULL FROM execution_snapshots s JOIN privacy_order_scope o ON o.tenant_id=s.tenant_id AND o.id=s.order_id
 UNION ALL SELECT 'render_jobs',j.id,j.tenant_id,o.owner_id,o.product_id,o.id,NULL FROM render_jobs j JOIN privacy_order_scope o ON o.tenant_id=j.tenant_id AND o.id=j.order_id
 UNION ALL SELECT 'stage_runs',s.id,s.tenant_id,s.owner_id,s.product_id,s.order_id,NULL FROM privacy_stage_scope s
 UNION ALL SELECT 'provider_submissions',p.id,p.tenant_id,s.owner_id,s.product_id,s.order_id,NULL FROM provider_submissions p JOIN privacy_stage_scope s ON s.tenant_id=p.tenant_id AND s.id=p.stage_run_id
 UNION ALL SELECT 'agent_instances',i.id,i.tenant_id,i.owner_id,i.product_id,i.order_id,NULL FROM privacy_instance_scope i
 UNION ALL SELECT 'agent_runs',r.id,r.tenant_id,r.owner_id,r.product_id,r.order_id,NULL FROM privacy_run_scope r
 UNION ALL SELECT 'agent_tool_intents',t.id,t.tenant_id,r.owner_id,r.product_id,r.order_id,NULL FROM agent_tool_intents t JOIN privacy_run_scope r ON r.tenant_id=t.tenant_id AND r.id=t.run_id
 UNION ALL SELECT 'inference_requests',i.id,i.tenant_id,r.owner_id,r.product_id,r.order_id,NULL FROM inference_requests i JOIN privacy_run_scope r ON r.tenant_id=i.tenant_id AND r.id=i.run_id
 UNION ALL SELECT 'media_operations',m.id,m.tenant_id,o.owner_id,o.product_id,o.id,NULL FROM media_operations m JOIN privacy_order_scope o ON o.tenant_id=m.tenant_id AND o.id=m.order_id
 UNION ALL SELECT 'artifacts',a.id,a.tenant_id,o.owner_id,o.product_id,o.id,NULL FROM artifacts a JOIN privacy_order_scope o ON o.tenant_id=a.tenant_id AND o.id=a.order_id
 UNION ALL SELECT 'qc_decisions',q.id,q.tenant_id,o.owner_id,o.product_id,o.id,NULL FROM qc_decisions q JOIN privacy_order_scope o ON o.tenant_id=q.tenant_id AND o.id=q.order_id
 UNION ALL SELECT 'review_packets',p.id,p.tenant_id,o.owner_id,o.product_id,o.id,NULL FROM review_packets p JOIN privacy_order_scope o ON o.tenant_id=p.tenant_id AND o.id=p.order_id
 UNION ALL SELECT 'review_reports',r.id,r.tenant_id,o.owner_id,o.product_id,o.id,NULL FROM review_reports r JOIN review_packets p ON p.tenant_id=r.tenant_id AND p.id=r.packet_id JOIN privacy_order_scope o ON o.tenant_id=p.tenant_id AND o.id=p.order_id
 UNION ALL SELECT 'review_evidence',e.id,e.tenant_id,o.owner_id,o.product_id,o.id,NULL FROM review_evidence e JOIN privacy_order_scope o ON o.tenant_id=e.tenant_id AND o.id=e.order_id
 UNION ALL SELECT 'delivery_manifests',m.id,m.tenant_id,o.owner_id,o.product_id,o.id,NULL FROM delivery_manifests m JOIN privacy_order_scope o ON o.tenant_id=m.tenant_id AND o.id=m.order_id
 UNION ALL SELECT 'revision_requests',r.id,r.tenant_id,o.owner_id,o.product_id,o.id,NULL FROM revision_requests r JOIN privacy_order_scope o ON o.tenant_id=r.tenant_id AND o.id=r.order_id
 UNION ALL SELECT 'support_tickets',t.id,t.tenant_id,o.owner_id,o.product_id,o.id,NULL FROM support_tickets t JOIN privacy_order_scope o ON o.tenant_id=t.tenant_id AND o.id=t.order_id;

CREATE FUNCTION ypcc_privacy_fields(target_table text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE
 WHEN target_table IN ('profile_versions','analysis_jobs','plan_versions','agent_tool_intents','review_packets','delivery_manifests','revision_requests') THEN ARRAY['data','private']
 WHEN target_table='artifacts' THEN ARRAY['data','spec_json']
 WHEN target_table IN ('quotes','orders','render_jobs','stage_runs','provider_submissions','agent_instances','agent_runs','inference_requests','support_tickets') THEN ARRAY['private']
 WHEN target_table IN ('product_drafts','assets','product_photo_versions','identity_locks','correction_versions','analysis_attempts','scene_locks','shot_plans','reference_frame_sets','optional_previews','execution_snapshots','media_operations','qc_decisions','review_reports','review_evidence') THEN ARRAY['data']
 ELSE ARRAY[]::text[] END
$$;
CREATE FUNCTION ypcc_privacy_projection(target_table text, document jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE field text; fields text[] := ypcc_privacy_fields(target_table); result jsonb := document;
BEGIN
 IF cardinality(fields)=0 THEN RETURN NULL; END IF;
 FOREACH field IN ARRAY fields LOOP
  result := jsonb_set(result,ARRAY[field],CASE WHEN target_table='orders' THEN '{"privacy_deleted":true,"media_revoked":true}'::jsonb ELSE '{"privacy_deleted":true}'::jsonb END);
 END LOOP;
 RETURN result;
END $$;
CREATE FUNCTION ypcc_privacy_digest(document jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT encode(sha256(convert_to(document::text,'UTF8')),'hex')
$$;
CREATE TABLE privacy_redactions (
 id text PRIMARY KEY,tenant_id text NOT NULL,owner_id text NOT NULL,target_table text NOT NULL,target_id text NOT NULL,
 marker_id text NOT NULL REFERENCES deletion_markers(id),before_sha256 text NOT NULL CHECK(before_sha256 ~ '^[a-f0-9]{64}$'),
 after_sha256 text NOT NULL CHECK(after_sha256 ~ '^[a-f0-9]{64}$'),field_names text[] NOT NULL,
 digest_algorithm text NOT NULL DEFAULT 'postgres-jsonb-text-utf8-sha256-v1' CHECK(digest_algorithm='postgres-jsonb-text-utf8-sha256-v1'),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id),UNIQUE(tenant_id,target_table,target_id)
);
CREATE TRIGGER immutable_privacy_redaction BEFORE UPDATE OR DELETE ON privacy_redactions FOR EACH ROW EXECUTE FUNCTION ypcc_reject_mutation();

CREATE FUNCTION ypcc_privacy_authorized(target_table text, old_document jsonb, new_document jsonb) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
BEGIN
 IF ypcc_privacy_projection(target_table,old_document) IS NULL OR new_document IS DISTINCT FROM ypcc_privacy_projection(target_table,old_document) THEN RETURN false; END IF;
 IF NOT EXISTS (SELECT 1 FROM privacy_redactions r WHERE r.target_table=$1 AND r.tenant_id=old_document->>'tenant_id' AND r.target_id=old_document->>'id') THEN RETURN false; END IF;
 RETURN EXISTS (
  SELECT 1 FROM privacy_redactions r JOIN deletion_markers m ON m.id=r.marker_id AND m.tenant_id=r.tenant_id AND m.owner_id=r.owner_id
  JOIN privacy_content_scope s ON s.table_name=r.target_table AND s.id=r.target_id AND s.tenant_id=r.tenant_id AND s.owner_id=r.owner_id
  WHERE r.target_table=$1 AND r.tenant_id=old_document->>'tenant_id' AND r.target_id=old_document->>'id'
  AND r.before_sha256=ypcc_privacy_digest(old_document) AND r.after_sha256=ypcc_privacy_digest(new_document)
  AND r.field_names=ypcc_privacy_fields($1)
  AND ((m.target_type='PRODUCT' AND m.target_id=s.product_id) OR (m.target_type='ORDER' AND m.target_id=s.order_id) OR (m.target_type='ASSET' AND m.target_id=s.asset_id)));
END
$$;
CREATE OR REPLACE FUNCTION ypcc_reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND ypcc_privacy_authorized(TG_TABLE_NAME,to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'immutable snapshot';
END $$;
CREATE OR REPLACE FUNCTION ypcc_protect_artifact() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ypcc_privacy_authorized(TG_TABLE_NAME,to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF (to_jsonb(NEW)-'expires_at') IS DISTINCT FROM (to_jsonb(OLD)-'expires_at') THEN RAISE EXCEPTION 'artifact content is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION ypcc_protect_review_packet() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ypcc_privacy_authorized(TG_TABLE_NAME,to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF (to_jsonb(NEW)-'state'-'data') IS DISTINCT FROM (to_jsonb(OLD)-'state'-'data')
 OR (NEW.data-'state'-'reports'-'publication_decision') IS DISTINCT FROM (OLD.data-'state'-'reports'-'publication_decision') THEN RAISE EXCEPTION 'sealed review packet content is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION ypcc_protect_cleanup_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ypcc_privacy_authorized(TG_TABLE_NAME,to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF OLD.private ? 'cleanup_binding' AND NEW.private->'cleanup_binding' IS DISTINCT FROM OLD.private->'cleanup_binding' THEN RAISE EXCEPTION 'cleanup binding is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION ypcc_no_private_content_restore() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE field text;
BEGIN
 IF EXISTS (SELECT 1 FROM privacy_redactions r WHERE r.tenant_id=OLD.tenant_id AND r.target_table=TG_TABLE_NAME AND r.target_id=OLD.id)
 AND NOT ypcc_privacy_authorized(TG_TABLE_NAME,to_jsonb(OLD),to_jsonb(NEW)) THEN
  FOREACH field IN ARRAY ypcc_privacy_fields(TG_TABLE_NAME) LOOP
   IF to_jsonb(NEW)->field IS DISTINCT FROM to_jsonb(OLD)->field THEN RAISE EXCEPTION 'redacted private content cannot be restored'; END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION ypcc_validate_privacy_redaction() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE before_hash text; after_hash text;
BEGIN
 IF cardinality(ypcc_privacy_fields(NEW.target_table))=0 OR NEW.field_names IS DISTINCT FROM ypcc_privacy_fields(NEW.target_table) THEN RAISE EXCEPTION 'invalid privacy policy'; END IF;
 IF NOT EXISTS (SELECT 1 FROM privacy_content_scope s JOIN deletion_markers m ON m.id=NEW.marker_id AND m.tenant_id=s.tenant_id AND m.owner_id=s.owner_id
   WHERE s.tenant_id=NEW.tenant_id AND s.owner_id=NEW.owner_id AND s.table_name=NEW.target_table AND s.id=NEW.target_id
   AND ((m.target_type='PRODUCT' AND m.target_id=s.product_id AND EXISTS (SELECT 1 FROM product_drafts p WHERE p.tenant_id=s.tenant_id AND p.id=s.product_id AND p.deleted_at IS NOT NULL))
     OR (m.target_type='ORDER' AND m.target_id=s.order_id AND EXISTS (SELECT 1 FROM orders o WHERE o.tenant_id=s.tenant_id AND o.id=s.order_id AND o.private->>'media_revoked'='true'))
     OR (m.target_type='ASSET' AND m.target_id=s.asset_id AND EXISTS (SELECT 1 FROM assets a WHERE a.tenant_id=s.tenant_id AND a.id=s.asset_id AND a.state IN ('DELETED','EXPIRED'))))) THEN
  RAISE EXCEPTION 'privacy redaction marker does not authorize this row';
 END IF;
 EXECUTE format('SELECT ypcc_privacy_digest(to_jsonb(t)),ypcc_privacy_digest(ypcc_privacy_projection($3,to_jsonb(t))) FROM %I t WHERE tenant_id=$1 AND id=$2 FOR UPDATE',NEW.target_table)
  INTO before_hash,after_hash USING NEW.tenant_id,NEW.target_id,NEW.target_table;
 IF before_hash IS DISTINCT FROM NEW.before_sha256 OR after_hash IS DISTINCT FROM NEW.after_sha256 THEN RAISE EXCEPTION 'privacy redaction digest mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_privacy_redaction BEFORE INSERT ON privacy_redactions FOR EACH ROW EXECUTE FUNCTION ypcc_validate_privacy_redaction();
CREATE FUNCTION ypcc_verify_privacy_redaction_commit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE document jsonb; field text; expected jsonb;
BEGIN
 EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE tenant_id=$1 AND id=$2',NEW.target_table) INTO document USING NEW.tenant_id,NEW.target_id;
 expected := ypcc_privacy_projection(NEW.target_table,document);
 IF document IS NULL THEN RAISE EXCEPTION 'privacy redaction target is missing'; END IF;
 FOREACH field IN ARRAY NEW.field_names LOOP
  IF document->field IS DISTINCT FROM expected->field THEN RAISE EXCEPTION 'privacy redaction receipt requires content erasure in the same transaction'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER privacy_redaction_commit AFTER INSERT ON privacy_redactions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ypcc_verify_privacy_redaction_commit();
CREATE FUNCTION ypcc_no_deleted_scope_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM deletion_markers m WHERE m.tenant_id=NEW.tenant_id) THEN RETURN NEW; END IF;
 IF EXISTS (SELECT 1 FROM privacy_content_scope s JOIN deletion_markers m ON m.tenant_id=s.tenant_id AND m.owner_id=s.owner_id
   AND ((m.target_type='PRODUCT' AND m.target_id=s.product_id) OR (m.target_type='ORDER' AND m.target_id=s.order_id) OR (m.target_type='ASSET' AND m.target_id=s.asset_id))
   WHERE s.table_name=TG_TABLE_NAME AND s.tenant_id=NEW.tenant_id AND s.id=NEW.id) THEN RAISE EXCEPTION 'deleted media scope cannot accept new content'; END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE target_table text; BEGIN
 FOREACH target_table IN ARRAY ARRAY['product_drafts','assets','product_photo_versions','profile_versions','identity_locks','correction_versions','analysis_jobs','analysis_attempts','plan_versions','scene_locks','shot_plans','reference_frame_sets','optional_previews','quotes','orders','execution_snapshots','render_jobs','stage_runs','provider_submissions','agent_instances','agent_runs','agent_tool_intents','inference_requests','media_operations','artifacts','qc_decisions','review_packets','review_reports','review_evidence','delivery_manifests','revision_requests','support_tickets'] LOOP
  EXECUTE format('CREATE TRIGGER prevent_private_restore BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION ypcc_no_private_content_restore()',target_table);
  -- New support correspondence is a separate user action; it is redacted on the
  -- next maintenance pass. Production/analysis cannot recreate deleted content.
  IF target_table<>'support_tickets' THEN EXECUTE format('CREATE TRIGGER prevent_deleted_scope_insert AFTER INSERT ON %I FOR EACH ROW EXECUTE FUNCTION ypcc_no_deleted_scope_insert()',target_table); END IF;
 END LOOP;
END $$;
