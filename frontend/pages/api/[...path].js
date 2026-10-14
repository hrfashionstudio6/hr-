import mongoose from 'mongoose';
import {createApp} from '../../../backend/src/app.js';
import {Workspace, Employee, Attendance, Session} from '../../../backend/src/models.js';

const app = createApp();
let connection;
export const config = {api: {bodyParser: false, externalResolver: true}, maxDuration: 60};

export default async function handler(req, res) {
  try {
    if (!process.env.MONGODB_URI || !process.env.APP_ORIGIN) {
      return res.status(503).json({error: 'Server configuration is incomplete.'});
    }
    if (!connection) {
      connection = mongoose.connect(process.env.MONGODB_URI, {
        dbName: 'attendly_hr', maxPoolSize: 5, serverSelectionTimeoutMS: 10000,
      }).then(async () => {
        await Promise.all([Workspace.init(), Employee.init(), Attendance.init(), Session.init()]);
      }).catch(error => {connection = undefined; throw error;});
    }
    await connection;
    return app(req, res);
  } catch {
    return res.status(503).json({error: 'Database unavailable. Please try again.'});
  }
}
