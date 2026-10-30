ALTER TABLE plus_links ADD COLUMN allow_community_drafts boolean NOT NULL DEFAULT false;
ALTER TABLE plus_sessions ADD COLUMN allow_community_drafts boolean NOT NULL DEFAULT false;

-- Existing grants stay read/edit-only. A shared-project grant cannot act as
-- the author of its source identity's community work.
ALTER TABLE plus_links ADD CONSTRAINT plus_creator_link_native CHECK(NOT allow_community_drafts OR account_binding_id IS NULL);
ALTER TABLE plus_sessions ADD CONSTRAINT plus_creator_session_native CHECK(NOT allow_community_drafts OR account_binding_id IS NULL);
CREATE FUNCTION guard_plus_creator_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.allow_community_drafts IS DISTINCT FROM OLD.allow_community_drafts THEN
  RAISE EXCEPTION 'Plus creator scope is frozen; request a new native approval';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER plus_creator_link_scope BEFORE UPDATE ON plus_links FOR EACH ROW EXECUTE FUNCTION guard_plus_creator_scope();
CREATE TRIGGER plus_creator_session_scope BEFORE UPDATE ON plus_sessions FOR EACH ROW EXECUTE FUNCTION guard_plus_creator_scope();
