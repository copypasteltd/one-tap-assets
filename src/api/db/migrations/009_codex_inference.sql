-- A response may be replayed; a SUBMITTING/UNKNOWN request is never purchased
-- again. Token/cost ceilings are shared by every fresh run in the same scope.
ALTER TABLE inference_requests ADD COLUMN stage_run_id text;
ALTER TABLE inference_requests ADD COLUMN reserved_input_tokens integer NOT NULL DEFAULT 0 CHECK(reserved_input_tokens>=0);
ALTER TABLE inference_requests ADD COLUMN reserved_output_tokens integer NOT NULL DEFAULT 0 CHECK(reserved_output_tokens>=0);
ALTER TABLE inference_requests ADD COLUMN actual_input_tokens integer CHECK(actual_input_tokens>=0);
ALTER TABLE inference_requests ADD COLUMN actual_output_tokens integer CHECK(actual_output_tokens>=0);
ALTER TABLE inference_requests ADD FOREIGN KEY(tenant_id,stage_run_id) REFERENCES stage_runs(tenant_id,id);
CREATE UNIQUE INDEX inference_replay_idx ON inference_requests(run_id,request_hash);
CREATE INDEX inference_scope_idx ON inference_requests(tenant_id,scope_type,scope_id);
CREATE UNIQUE INDEX agent_run_stage_generation_idx ON agent_runs((private->>'stage_run_id'),(private->>'stage_fencing_token'),role)
 WHERE private ? 'stage_run_id' AND private ? 'stage_fencing_token';
