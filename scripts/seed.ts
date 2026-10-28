import { config } from '../src/api/config.js';
import { createPool } from '../src/api/db/pool.js';
import { seed } from '../src/api/db/seed.js';
const pool = createPool(config());
try { await seed(pool); process.stdout.write('Official catalog seeded with sale disabled.\n'); }
finally { await pool.end(); }
