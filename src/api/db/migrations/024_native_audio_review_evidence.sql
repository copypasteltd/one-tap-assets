ALTER TABLE review_evidence DROP CONSTRAINT review_evidence_kind_check;
ALTER TABLE review_evidence ADD CONSTRAINT review_evidence_kind_check CHECK(kind IN (
 'CANDIDATE_IMAGE','VIDEO_FRAME','CONTRACT','COPY',
 'NATIVE_AUDIO','FINAL_AUDIO','TRANSCRIPT','CAPTION_SCRIPT','AUDIO_QC'
));
-- Existing sealed packets and evidence remain immutable. New kinds contain
-- registered private files; no audio review PASS or delivery permission is added.
