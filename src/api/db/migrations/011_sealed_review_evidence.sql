CREATE TABLE review_evidence (
 id text PRIMARY KEY, tenant_id text NOT NULL, packet_id text NOT NULL, order_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('CANDIDATE_IMAGE','VIDEO_FRAME','CONTRACT','COPY')),
 artifact_id text, object_key text NOT NULL, sha256 text NOT NULL, mime_type text NOT NULL,
 frame_index integer, time_ms integer, data jsonb NOT NULL,
 FOREIGN KEY(tenant_id,packet_id) REFERENCES review_packets(tenant_id,id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id),
 FOREIGN KEY(tenant_id,artifact_id) REFERENCES artifacts(tenant_id,id), UNIQUE(tenant_id,id)
);
CREATE INDEX review_evidence_packet ON review_evidence(tenant_id,packet_id);
ALTER TABLE review_packets ADD COLUMN qc_stage_id text;
ALTER TABLE review_packets ADD CONSTRAINT review_packet_stage_fk FOREIGN KEY(tenant_id,qc_stage_id) REFERENCES stage_runs(tenant_id,id);
CREATE UNIQUE INDEX one_packet_per_qc_stage ON review_packets(qc_stage_id) WHERE qc_stage_id IS NOT NULL;
CREATE FUNCTION ypcc_protect_review_packet() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-'state'-'data') IS DISTINCT FROM (to_jsonb(OLD)-'state'-'data')
    OR (NEW.data-'state'-'reports'-'publication_decision') IS DISTINCT FROM (OLD.data-'state'-'reports'-'publication_decision') THEN
  RAISE EXCEPTION 'sealed review packet content is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_review_packet BEFORE UPDATE ON review_packets FOR EACH ROW EXECUTE FUNCTION ypcc_protect_review_packet();
CREATE TRIGGER immutable_review_evidence BEFORE UPDATE ON review_evidence FOR EACH ROW EXECUTE FUNCTION ypcc_reject_mutation();
CREATE TRIGGER immutable_review_report BEFORE UPDATE ON review_reports FOR EACH ROW EXECUTE FUNCTION ypcc_reject_mutation();
