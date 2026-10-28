import { config } from '../src/api/config.js';
import { createPool } from '../src/api/db/pool.js';
import { migrate } from '../src/api/db/migrate.js';
const pool = createPool(config());
try { await migrate(pool); process.stdout.write('Database migrations applied.\n'); }
finally { await pool.end(); }
