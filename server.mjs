import 'dotenv/config';
import express from 'express';
import next from 'next';
import mongoose from 'mongoose';
import {fileURLToPath} from 'node:url';
import {createApp} from './backend/src/app.js';
import {Workspace, Employee, Attendance, Session} from './backend/src/models.js';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
if (!process.env.APP_ORIGIN) throw new Error('APP_ORIGIN is required');
// Always isolate attendance data from any database named in a reused cluster URI.
await mongoose.connect(process.env.MONGODB_URI, {dbName: 'attendly_hr'});
await Promise.all([Workspace.init(), Employee.init(), Attendance.init(), Session.init()]);
const frontend = next({dev: false, dir: fileURLToPath(new URL('./frontend', import.meta.url))});
await frontend.prepare();
const handle = frontend.getRequestHandler();
const api = createApp();
const app = express();
app.disable('x-powered-by');
app.use((req, res, nextMiddleware) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) return api(req, res, nextMiddleware);
  return handle(req, res);
});
const server = app.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
  console.log('Attendly web and API server ready');
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(async () => {
    await frontend.close();
    await mongoose.disconnect();
    process.exit(0);
  }));
}
