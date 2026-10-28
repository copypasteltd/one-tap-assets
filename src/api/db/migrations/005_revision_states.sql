DROP INDEX successful_user_revision;
CREATE UNIQUE INDEX successful_user_revision ON revision_requests(order_id) WHERE consumes_user_allowance AND state='COMPLETED';
CREATE UNIQUE INDEX active_user_revision ON revision_requests(order_id) WHERE consumes_user_allowance AND state IN ('REQUESTED','PROCESSING');
