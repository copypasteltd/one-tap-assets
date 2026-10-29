-- Existing six-stage cost grants retain their exact binding and authority.
-- New coordinators may add one paid, original-budget CONTENT preparation.
ALTER TABLE repair_cost_authorizations ADD COLUMN preparation_stage_ids text[] NOT NULL DEFAULT '{}'
 CHECK(cardinality(preparation_stage_ids)<=1);
