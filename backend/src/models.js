import mongoose from 'mongoose';
const {Schema,model}=mongoose;
export const Workspace=model('Workspace',new Schema({_id:{type:String,default:'main'},company:String,timezone:String,ownerName:String,ownerEmail:String,passwordHash:{type:String,select:false}},{timestamps:true}));
export const Employee=model('Employee',new Schema({_id:String,name:String,email:{type:String,unique:true,required:true},passwordHash:{type:String,select:false,required:true},department:String,title:String,phone:String,address:String,joined:String,emergency:String,start:String,end:String,active:{type:Number,default:1}},{timestamps:true}));
const attendance=new Schema({_id:String,employeeId:{type:String,required:true},day:{type:String,required:true},checkIn:String,checkOut:{type:String,default:null},status:String,shiftStart:String,shiftEnd:String},{timestamps:true});
attendance.index({employeeId:1,day:1},{unique:true});
attendance.index({employeeId:1},{unique:true,partialFilterExpression:{checkOut:null},name:'one_open_session'});
export const Attendance=model('Attendance',attendance);
const session=new Schema({_id:String,userId:String,role:String,expiresAt:Date});session.index({expiresAt:1},{expireAfterSeconds:0});
export const Session=model('Session',session);

