import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import mongoose from 'mongoose';
import {MongoMemoryServer} from 'mongodb-memory-server';

const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const mongo = await MongoMemoryServer.create();
const connection = await mongoose.createConnection(mongo.getUri('existing_fashion')).asPromise();
await connection.db.collection('sentinel').insertOne({untouched: true});
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)),
  env: {...process.env, NODE_ENV: 'production', PORT: String(port), APP_ORIGIN: origin,
    MONGODB_URI: mongo.getUri('existing_fashion'), SETUP_KEY: 'smoke-test-only-not-a-production-secret'},
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stdout.on('data', chunk => {logs += chunk;});
child.stderr.on('data', chunk => {logs += chunk;});
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server stopped: ${logs}`);
    try { ready = (await fetch(`${origin}/api/health`)).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, `Server startup timed out: ${logs}`);
  const page = await fetch(origin);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Attendly/);
  assert.equal((await fetch(`${origin}/api/workspace`)).status, 401);
  const setup = await fetch(`${origin}/api/auth/setup`, {
    method: 'POST', headers: {'Content-Type': 'application/json', Origin: origin},
    body: JSON.stringify({company: 'Smoke', name: 'HR', email: 'hr@example.test',
      password: 'SmokePassword123!', timezone: 'Asia/Karachi',
      setupKey: 'smoke-test-only-not-a-production-secret'}),
  });
  assert.equal(setup.status, 201);
  assert.match(setup.headers.get('set-cookie'), /Secure/);
  assert.equal(await connection.db.collection('workspaces').countDocuments(), 0);
  assert.equal(await connection.db.collection('sentinel').countDocuments({untouched: true}), 1);
  assert.equal(await connection.getClient().db('attendly_hr').collection('workspaces').countDocuments(), 1);
  console.log('PASS: production HTML, API, authentication, secure cookies and database isolation');
} finally {
  if (child.exitCode === null) { child.kill(); await once(child, 'exit'); }
  await connection.close();
  await mongo.stop();
}
