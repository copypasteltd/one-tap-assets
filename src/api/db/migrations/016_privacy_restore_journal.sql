CREATE TABLE privacy_journal_state (
 source_id text PRIMARY KEY,head_sha256 text NOT NULL CHECK(head_sha256 ~ '^[a-f0-9]{64}$'),
 sequence bigint NOT NULL CHECK(sequence>=0),initialized boolean NOT NULL DEFAULT false,
 financial_recovery_required boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE privacy_journal_receipts (
 source_id text NOT NULL,sequence bigint NOT NULL CHECK(sequence>0),entry_sha256 text NOT NULL CHECK(entry_sha256 ~ '^[a-f0-9]{64}$'),
 request_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(source_id,sequence),UNIQUE(source_id,request_id)
);
CREATE TRIGGER immutable_privacy_journal_receipt BEFORE UPDATE OR DELETE ON privacy_journal_receipts FOR EACH ROW EXECUTE FUNCTION ypcc_reject_mutation();
CREATE TABLE privacy_replay_receipts (
 source_id text NOT NULL,sequence bigint NOT NULL CHECK(sequence>0),entry_sha256 text NOT NULL CHECK(entry_sha256 ~ '^[a-f0-9]{64}$'),
 original_request_id text NOT NULL,replay_request_id text REFERENCES privacy_deletions(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(source_id,sequence)
);
CREATE TRIGGER immutable_privacy_replay_receipt BEFORE UPDATE OR DELETE ON privacy_replay_receipts FOR EACH ROW EXECUTE FUNCTION ypcc_reject_mutation();
