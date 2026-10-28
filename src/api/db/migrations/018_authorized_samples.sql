-- Private creator execution and authorized distribution have separate objects.
ALTER TABLE public_samples ADD COLUMN product_id text;
UPDATE public_samples s SET product_id=p.id FROM product_drafts p
 WHERE p.tenant_id=s.tenant_id AND p.owner_id=s.owner_id
 AND p.id=COALESCE(s.private->'request'->>'product_id',s.private->'input_ref'->>'product_id');
ALTER TABLE public_samples ADD FOREIGN KEY(tenant_id,product_id) REFERENCES product_drafts(tenant_id,id);
CREATE INDEX private_sample_product ON public_samples(tenant_id,product_id);

CREATE TABLE authorized_samples (
 id text PRIMARY KEY,tenant_id text NOT NULL,owner_id text NOT NULL,publication_id text NOT NULL,
 source_sample_id text NOT NULL,source_product_id text NOT NULL,input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK(state IN ('PREPARING','READY','PUBLISHED','WITHDRAWN','EXPIRED','FAILED')),
 expires_at timestamptz NOT NULL,data jsonb NOT NULL DEFAULT '{}',private jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES users(tenant_id,id),
 FOREIGN KEY(tenant_id,publication_id) REFERENCES publications(tenant_id,id),
 FOREIGN KEY(tenant_id,source_sample_id) REFERENCES public_samples(tenant_id,id),
 FOREIGN KEY(tenant_id,source_product_id) REFERENCES product_drafts(tenant_id,id),
 UNIQUE(tenant_id,id),UNIQUE(publication_id,source_sample_id)
);
ALTER TABLE private_object_writes ADD COLUMN authorized_sample_id text;
ALTER TABLE private_object_writes ADD FOREIGN KEY(tenant_id,authorized_sample_id) REFERENCES authorized_samples(tenant_id,id);
ALTER TABLE private_object_writes ADD CHECK(authorized_sample_id IS NULL OR
 (product_id IS NULL AND order_id IS NULL AND asset_id IS NULL AND run_id IS NULL AND kind='MEDIA'));
CREATE INDEX authorized_sample_objects ON private_object_writes(tenant_id,authorized_sample_id);

CREATE FUNCTION ypcc_keep_authorized_sample_input() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.tenant_id,NEW.owner_id,NEW.publication_id,NEW.source_sample_id,NEW.source_product_id,NEW.input_hash,NEW.expires_at,NEW.private->'input')
  IS DISTINCT FROM (OLD.tenant_id,OLD.owner_id,OLD.publication_id,OLD.source_sample_id,OLD.source_product_id,OLD.input_hash,OLD.expires_at,OLD.private->'input')
 THEN RAISE EXCEPTION 'authorized sample frozen input is immutable'; END IF;
 IF OLD.state IN ('WITHDRAWN','EXPIRED','FAILED') AND NEW.state<>OLD.state
 THEN RAISE EXCEPTION 'ended authorized sample cannot be revived'; END IF;
 IF OLD.private ? 'media_hash' AND (NEW.private->'media',NEW.private->'media_hash') IS DISTINCT FROM (OLD.private->'media',OLD.private->'media_hash')
 THEN RAISE EXCEPTION 'authorized sample media manifest is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER authorized_sample_input_immutable BEFORE UPDATE ON authorized_samples FOR EACH ROW EXECUTE FUNCTION ypcc_keep_authorized_sample_input();

-- Legacy visibility flags do not prove separate consent or durable copies.
UPDATE publications p SET review_state='SUSPENDED',revision=revision+1,
 data=data||jsonb_build_object('state','SUSPENDED','sale_enabled',false,'revision',revision+1,'public_sample_state','NONE','reason_codes',jsonb_build_array('PUBLIC_SAMPLE_MIGRATION_REQUIRED'))
 WHERE EXISTS(SELECT 1 FROM public_samples s WHERE s.visibility='AUTHORIZED_PUBLIC'
  AND (s.private->>'publication_id'=p.id OR s.id IN (SELECT jsonb_array_elements_text(p.private->'request'->'sample_ids'))));
UPDATE presets SET visibility='PRIVATE' WHERE id IN (SELECT data->>'preset_id' FROM publications WHERE data->'reason_codes' ? 'PUBLIC_SAMPLE_MIGRATION_REQUIRED');
UPDATE execution_variants SET sale_enabled=false,data=jsonb_set(data,'{sale_enabled}','false'),revision=revision+1
 WHERE preset_version_id IN (SELECT v.id FROM preset_versions v JOIN publications p ON p.data->>'preset_id'=v.preset_id WHERE p.data->'reason_codes' ? 'PUBLIC_SAMPLE_MIGRATION_REQUIRED');
UPDATE public_samples SET visibility='PRIVATE',data=jsonb_set(data,'{visibility}','"PRIVATE"') WHERE visibility<>'PRIVATE';
ALTER TABLE public_samples ADD CHECK(visibility='PRIVATE');
CREATE FUNCTION ypcc_keep_private_sample_product() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.product_id IS DISTINCT FROM OLD.product_id THEN RAISE EXCEPTION 'private sample source product is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER private_sample_product_immutable BEFORE UPDATE ON public_samples FOR EACH ROW EXECUTE FUNCTION ypcc_keep_private_sample_product();

-- SAMPLE content/roles were absent from the original privacy projection.
DO $$ DECLARE definition text; BEGIN
 definition := rtrim(pg_get_viewdef('privacy_stage_scope',true),E';\n ');
 EXECUTE 'CREATE OR REPLACE VIEW privacy_stage_scope AS '||definition||
  ' UNION ALL SELECT t.id,t.tenant_id,s.owner_id,s.product_id,NULL::text FROM stage_runs t JOIN public_samples s ON s.tenant_id=t.tenant_id AND s.id=t.scope_id WHERE t.scope_type=''SAMPLE'' AND s.product_id IS NOT NULL';
 definition := rtrim(pg_get_viewdef('privacy_instance_scope',true),E';\n ');
 EXECUTE 'CREATE OR REPLACE VIEW privacy_instance_scope AS '||definition||
  ' UNION ALL SELECT i.id,i.tenant_id,s.owner_id,s.product_id,NULL::text FROM agent_instances i JOIN public_samples s ON s.tenant_id=i.tenant_id AND s.id=i.preview_session_id WHERE i.order_id IS NULL AND s.product_id IS NOT NULL';
 definition := rtrim(pg_get_viewdef('privacy_content_scope',true),E';\n ');
 EXECUTE 'CREATE OR REPLACE VIEW privacy_content_scope AS '||definition||
  ' UNION ALL SELECT ''public_samples''::text,s.id,s.tenant_id,s.owner_id,s.product_id,NULL::text,NULL::text FROM public_samples s WHERE s.product_id IS NOT NULL';
END $$;
ALTER FUNCTION ypcc_privacy_fields(text) RENAME TO ypcc_privacy_fields_before_samples;
CREATE FUNCTION ypcc_privacy_fields(target_table text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN target_table='public_samples' THEN ARRAY['private'] ELSE ypcc_privacy_fields_before_samples(target_table) END
$$;
CREATE TRIGGER prevent_private_restore BEFORE UPDATE ON public_samples FOR EACH ROW EXECUTE FUNCTION ypcc_no_private_content_restore();
CREATE TRIGGER prevent_deleted_scope_insert AFTER INSERT ON public_samples FOR EACH ROW EXECUTE FUNCTION ypcc_no_deleted_scope_insert();
