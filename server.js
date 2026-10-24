import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';

async function start() {
  await connectDB();
  console.log('MongoDB connected');
  app.listen(env.port, () => {
    console.log(`HCM Lite API running on http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
