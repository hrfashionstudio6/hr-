import 'dotenv/config';
import mongoose from 'mongoose';
import {createApp} from './app.js';
import {Workspace,Employee,Attendance,Session} from './models.js';
if(!process.env.MONGODB_URI)throw new Error('Set MONGODB_URI in backend/.env');
await mongoose.connect(process.env.MONGODB_URI);
await Promise.all([Workspace.init(),Employee.init(),Attendance.init(),Session.init()]);
const server=createApp().listen(Number(process.env.PORT||4000),'127.0.0.1',()=>console.log('Attendly API: http://127.0.0.1:'+(process.env.PORT||4000)));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await mongoose.disconnect();process.exit(0);}));
