import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import { cfg } from './config.js';
import './db.js';
import { registerApi } from './api.js';
import { startBot } from './bot.js';
import { startScheduler } from './scheduler.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const app = Fastify({ logger: { level: 'warn' }, bodyLimit: 1_000_000 });

await app.register(multipart, { limits: { fileSize: 10_000_000, files: 1 } });
await app.register(fastifyStatic, { root: path.join(root, '..', 'public'), prefix: '/' });
await app.register(fastifyStatic, {
  root: path.join(cfg.dataDir, 'uploads'),
  prefix: '/uploads/',
  decorateReply: false,
  maxAge: '30d',
  immutable: true,
});
await registerApi(app);
app.get('/health', async () => ({ ok: true }));

await app.listen({ port: cfg.port, host: '0.0.0.0' });
console.log(`listening on :${cfg.port}, TZ=${process.env.TZ || 'system'}`);

startScheduler();
startBot().catch((e) => console.error('bot failed to start', e));
