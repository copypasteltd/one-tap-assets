import type { Db } from '../db/pool.js';
/** Transaction-scoped gate shared by media creation, payment, writes and
 * privacy enumeration. Prevent a new object scope appearing mid-deletion. */
export async function lockMediaOwner(db: Db, tenantId: string, ownerId: string): Promise<void> {
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`media-owner:${tenantId}:${ownerId}`]);
}
