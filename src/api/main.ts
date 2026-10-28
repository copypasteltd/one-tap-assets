import { config } from './config.js';
import { buildApp } from './app.js';
const cfg = config(); const app = await buildApp({ cfg });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close().then(() => process.exit(0)); });
await app.listen({ host: cfg.host, port: cfg.port });
