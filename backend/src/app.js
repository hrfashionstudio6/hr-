import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import {randomBytes,randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {Workspace,Employee,Attendance,Session} from './models.js';
import {localDay,arrivalStatus,validZone,validSchedule} from './time.js';
const hash=t=>createHash('sha256').update(t).digest('hex');
const password=z.string().min(12).max(72).refine(v=>Buffer.byteLength(v)<=72,'Password must be at most 72 bytes');
const text=z.string().trim().min(1).max(100);
const optional=z.string().trim().max(250).default('');
const profile=z.object({id:z.string().max(60).optional(),name:text,email:z.email().max(254).transform(v=>v.toLowerCase()),department:text,title:text,phone:optional,address:optional,joined:z.iso.date(),emergency:optional,start:z.string(),end:z.string(),password:password.optional()}).refine(v=>validSchedule(v.start,v.end),'Work end must be after start on the same day');
const settings=z.object({company:z.string().trim().min(1).max(80),timezone:z.string().max(100).refine(validZone,'Invalid timezone')});
const publicDoc=d=>{const {_id,__v,passwordHash,...rest}=d;return {...rest,id:_id};};
const fail=(res,status,error)=>res.status(status).json({error});
export function createApp(){
const app=express();app.disable('x-powered-by');app.use(helmet());app.use(express.json({limit:'16kb'}));app.use(cookieParser());
app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
app.get('/api/health',(_req,res)=>res.json({ok:true}));
app.use('/api',(req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)){if(req.get('origin')!==(process.env.APP_ORIGIN||'http://localhost:3000'))return fail(res,403,'Invalid request origin.');if(!req.is('application/json'))return fail(res,415,'JSON required.');}next();});
const authLimit=rateLimit({windowMs:15*60*1000,limit:15,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many attempts. Please try again in 15 minutes.'}});
async function issue(res,id,role){const token=randomBytes(32).toString('hex');await Session.create({_id:hash(token),userId:id,role,expiresAt:new Date(Date.now()+8*3600000)});res.cookie('attendly_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:8*3600000,path:'/'});}
app.get('/api/auth/status',async(_req,res)=>res.json({needsSetup:!(await Workspace.exists({_id:'main'}))}));
app.post('/api/auth/setup',authLimit,async(req,res)=>{const input=settings.extend({name:text,email:z.email().transform(v=>v.toLowerCase()),password,setupKey:z.string().max(200)}).parse(req.body);const expected=process.env.SETUP_KEY||'';if(expected.length<32||hash(input.setupKey)!==hash(expected))return fail(res,403,'Invalid setup key. Ask the server administrator.');if(await Workspace.exists({_id:'main'}))return fail(res,409,'Workspace already exists.');await Workspace.create({_id:'main',company:input.company,timezone:input.timezone,ownerName:input.name,ownerEmail:input.email,passwordHash:await bcrypt.hash(input.password,12)});await issue(res,'main','hr');res.status(201).json({ok:true});});
app.post('/api/auth/login',authLimit,async(req,res)=>{const input=z.object({email:z.email().transform(v=>v.toLowerCase()),password:z.string().max(200)}).parse(req.body);const work=await Workspace.findById('main').select('+passwordHash');let account=work?.ownerEmail===input.email?work:await Employee.findOne({email:input.email,active:1}).select('+passwordHash');if(!account||!await bcrypt.compare(input.password,account.passwordHash))return fail(res,401,'Email or password is incorrect.');await issue(res,String(account._id),account===work?'hr':'employee');res.json({ok:true});});
app.post('/api/auth/logout',async(req,res)=>{if(req.cookies.attendly_session)await Session.deleteOne({_id:hash(req.cookies.attendly_session)});res.clearCookie('attendly_session',{path:'/'});res.json({ok:true});});
app.use('/api',async(req,res,next)=>{const token=req.cookies.attendly_session;if(!token)return fail(res,401,'Please sign in.');const session=await Session.findOne({_id:hash(token),expiresAt:{$gt:new Date()}});if(!session)return fail(res,401,'Session expired. Please sign in.');const work=await Workspace.findById('main').lean();const employee=session.role==='employee'?await Employee.findOne({_id:session.userId,active:1}).lean():null;if(!work||(session.role==='employee'&&!employee))return fail(res,403,'Your account is inactive. Contact HR.');req.identity={work,employee,hr:session.role==='hr',session};next();});
app.post('/api/auth/password',async(req,res)=>{const input=z.object({currentPassword:z.string().max(200),newPassword:password}).parse(req.body);const {hr,session}=req.identity;const Model=hr?Workspace:Employee;const account=await Model.findById(session.userId).select('+passwordHash');if(!await bcrypt.compare(input.currentPassword,account.passwordHash))return fail(res,401,'Current password is incorrect.');account.passwordHash=await bcrypt.hash(input.newPassword,12);await account.save();await Session.deleteMany({userId:session.userId});await issue(res,session.userId,session.role);res.json({ok:true});});
app.get('/api/workspace',async(req,res)=>{const {work,employee,hr}=req.identity;const employees=await Employee.find(hr?{}:{_id:employee._id}).sort({name:1}).lean();const records=await Attendance.find(hr?{}:{employeeId:employee._id}).sort({day:-1,checkIn:-1}).lean();res.json({mode:'live',me:{name:hr?work.ownerName:employee.name,email:hr?work.ownerEmail:employee.email,id:hr?'main':employee._id,role:hr?'hr':'employee'},employees:employees.map(publicDoc),records:records.map(publicDoc),settings:{company:work.company,timezone:work.timezone},today:localDay(new Date(),work.timezone)});});
app.post('/api/workspace',async(req,res)=>{
const {work,employee,hr}=req.identity;const {action}=req.body;
if(action==='checkin'||action==='checkout'){
if(!employee)return fail(res,403,'An employee account is required.');const now=new Date(),day=localDay(now,work.timezone);
if(action==='checkin'){await Attendance.create({_id:randomUUID(),employeeId:employee._id,day,checkIn:now.toISOString(),status:arrivalStatus(now,work.timezone,employee.start),shiftStart:employee.start,shiftEnd:employee.end});}
else{const updated=await Attendance.findOneAndUpdate({employeeId:employee._id,checkOut:null},{$set:{checkOut:now.toISOString()}},{sort:{checkIn:-1}});if(!updated)return fail(res,409,'No open check-in found.');}
return res.json({ok:true});}
if(!hr)return fail(res,403,'Only HR can change employee details or schedules.');
if(action==='employee'){const p=profile.parse(req.body);if(p.email===work.ownerEmail)return fail(res,400,'This email belongs to HR.');const {id,password:rawPassword,...fields}=p;if(!id&&!rawPassword)return fail(res,400,'A password of at least 12 characters is required for a new employee.');if(rawPassword)fields.passwordHash=await bcrypt.hash(rawPassword,12);if(id){const updated=await Employee.findByIdAndUpdate(id,{$set:fields});if(!updated)return fail(res,404,'Employee not found.');if(rawPassword)await Session.deleteMany({userId:id});}else await Employee.create({_id:'EMP-'+randomUUID().slice(0,8).toUpperCase(),...fields});return res.json({ok:true});}
if(action==='toggle'){const p=z.object({id:z.string(),active:z.union([z.literal(0),z.literal(1)])}).parse(req.body);const e=await Employee.findByIdAndUpdate(p.id,{$set:{active:p.active}});if(!e)return fail(res,404,'Employee not found.');if(!p.active)await Session.deleteMany({userId:p.id});return res.json({ok:true});}
if(action==='settings'){const p=settings.parse(req.body);if(p.timezone!==work.timezone&&await Attendance.exists({checkOut:null}))return fail(res,409,'Close open attendance sessions before changing timezone.');await Workspace.updateOne({_id:'main'},{$set:p});return res.json({ok:true});}
return fail(res,400,'Unknown action.');
});
app.use((err,_req,res,_next)=>{if(err instanceof z.ZodError)return fail(res,400,err.issues.map(i=>i.message).join(' '));if(err.code===11000)return fail(res,409,'This account or attendance record already exists.');if(err.type==='entity.parse.failed')return fail(res,400,'Invalid JSON.');if(err.type==='entity.too.large')return fail(res,413,'Request too large.');console.error(err.name,err.message);fail(res,500,'Unable to complete request. Please try again.');});
return app;
}
