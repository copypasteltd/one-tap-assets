ALTER TABLE platform_identities DROP CONSTRAINT platform_identities_platform_check;
ALTER TABLE platform_identities ADD CONSTRAINT platform_identities_platform_check CHECK(platform IN ('alipay','douyin'));
ALTER TABLE orders DROP CONSTRAINT orders_channel_check;
ALTER TABLE orders ADD CONSTRAINT orders_channel_check CHECK(channel IN ('alipay','douyin'));
ALTER TABLE assets DROP CONSTRAINT assets_state_check;
ALTER TABLE assets ADD CONSTRAINT assets_state_check CHECK(state IN ('UPLOADING','VERIFYING','READY','REJECTED','DELETED','EXPIRED'));
ALTER TABLE quotes DROP CONSTRAINT quotes_state_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_state_check CHECK(state IN ('OPEN','CONSUMED','EXPIRED','INVALIDATED'));
