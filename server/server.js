require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const db = require('./config/db');
const { ensureAnalyticsSchema } = require('./services/schemaService');
const rateLimit = require('./middleware/rateLimit');

const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const apiRoutes = require('./routes/api');
const importRoutes = require('./routes/import');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const allowedOrigins = String(process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(s => s.trim()).filter(Boolean);
const requiredEnv = ['DB_HOST','DB_NAME','DB_USER','DB_PASSWORD','SECRET_KEY'];
for (const key of requiredEnv) if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(cors({ origin: (origin, cb) => !origin || allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error('CORS origin denied')), credentials: true, methods: ['GET','POST','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

app.get('/health', async (req, res) => {
  try { await db.query('SELECT 1'); res.json({ status: 'ok', service: 'eFOT', timestamp: new Date().toISOString() }); }
  catch (error) { res.status(503).json({ status: 'error', service: 'eFOT', message: 'Database unavailable' }); }
});

app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api', apiRoutes);
app.use('/api/import', importRoutes);

app.get('/', (req, res) => res.json({ service: 'eFOT API', version: '2.0' }));
app.use((req, res) => res.status(404).json({ message: 'Endpoint not found' }));
app.use((err, req, res, next) => {
  console.error('[http]', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

let server;
async function start() {
  await sequelize.authenticate();
  await sequelize.sync();
  await ensureAnalyticsSchema();
  server = app.listen(PORT, () => console.log(`eFOT API started on http://localhost:${PORT}`));
}
async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  if (server) await new Promise(resolve => server.close(resolve));
  await Promise.allSettled([sequelize.close(), db.end()]);
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch(error => { console.error('[startup]', error); process.exit(1); });
