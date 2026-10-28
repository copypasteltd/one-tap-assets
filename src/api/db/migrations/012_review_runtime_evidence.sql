CREATE TABLE agent_isolation_evidence (
 id text PRIMARY KEY, tenant_id text NOT NULL, instance_id text NOT NULL, run_id text NOT NULL,
 admission_hash text NOT NULL, data jsonb NOT NULL,
 FOREIGN KEY(tenant_id,instance_id) REFERENCES agent_instances(tenant_id,id),
 FOREIGN KEY(tenant_id,run_id) REFERENCES agent_runs(tenant_id,id), UNIQUE(tenant_id,id), UNIQUE(run_id)
);
CREATE TRIGGER immutable_isolation_evidence BEFORE UPDATE ON agent_isolation_evidence FOR EACH ROW EXECUTE FUNCTION ypcc_reject_mutation();
