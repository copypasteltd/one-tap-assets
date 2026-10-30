ALTER TABLE plus_links ADD COLUMN allow_video_render_plans boolean NOT NULL DEFAULT false;
ALTER TABLE plus_sessions ADD COLUMN allow_video_render_plans boolean NOT NULL DEFAULT false;
ALTER TABLE plus_edit_drafts ADD COLUMN media_kind text NOT NULL DEFAULT 'image' CHECK(media_kind IN ('image','video'));
ALTER TABLE plus_render_plans ADD COLUMN media_kind text NOT NULL DEFAULT 'image' CHECK(media_kind IN ('image','video'));
ALTER TABLE plus_edit_drafts ADD CONSTRAINT plus_video_draft_kind CHECK(media_kind<>'video' OR data->>'media_kind' IS NOT DISTINCT FROM 'video');
ALTER TABLE plus_render_plans ADD CONSTRAINT plus_render_binding_kind CHECK(binding->>'version' IS NOT DISTINCT FROM
 CASE media_kind WHEN 'image' THEN 'YPCC-PLUS-IMAGE-1' ELSE 'YPCC-PLUS-VIDEO-1' END);
CREATE INDEX plus_video_drafts_owner_idx ON plus_edit_drafts(tenant_id,owner_id,created_at DESC,id DESC) WHERE media_kind='video';
CREATE INDEX plus_video_render_owner_idx ON plus_render_plans(tenant_id,owner_id,created_at DESC,id DESC) WHERE media_kind='video';
