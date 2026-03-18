require('dotenv').config();
const cron     = require('node-cron');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { ScheduledTransaction, OTP } = require('../models/index');
const { Transaction } = require('../models/index');
const User   = require('../models/User');
const logger = require('../utils/logger');

const connectDB = async () => { await mongoose.connect(process.env.MONGODB_URI); logger.info('⏰ Scheduler connected'); };

const executeScheduled = async () => {
  const due = await ScheduledTransaction.find({ status:'pending', scheduledAt:{ $lte:new Date() } });
  for (const s of due) {
    const session = await mongoose.startSession(); session.startTransaction();
    try {
      const sender   = await User.findOne({ accountNumber:s.fromAccountNumber }).session(session);
      const receiver = await User.findOne({ accountNumber:s.toAccountNumber   }).session(session);
      if (!sender||!receiver) { s.status='failed'; s.failureReason='Account not found'; await s.save(); await session.abortTransaction(); continue; }
      const charges = s.amount<=10000?5:s.amount<=100000?10:15;
      if (sender.balance < s.amount+charges) { s.status='failed'; s.failureReason='Insufficient balance'; s.retryCount+=1; await s.save(); await session.abortTransaction(); continue; }
      await User.findByIdAndUpdate(sender._id,   { $inc:{ balance:-(s.amount+charges) } }, { session });
      await User.findByIdAndUpdate(receiver._id, { $inc:{ balance:s.amount } }, { session });
      const [tx]=await Transaction.create([{ idempotencyKey:uuidv4(), fromAccountNumber:s.fromAccountNumber, toAccountNumber:s.toAccountNumber, fromUserId:sender._id, toUserId:receiver._id, amount:s.amount, charges, type:'transfer', category:s.category||'other', description:s.description||'Scheduled Transfer', transferMode:s.transferMode||'IMPS', status:'completed', processedAt:new Date() }],{ session });
      s.status='executed'; s.executedAt=new Date(); s.transactionRef=tx._id;
      if (s.recurring?.enabled) {
        const next=new Date(s.scheduledAt);
        if(s.recurring.frequency==='daily') next.setDate(next.getDate()+1);
        else if(s.recurring.frequency==='weekly') next.setDate(next.getDate()+7);
        else next.setMonth(next.getMonth()+1);
        if(!s.recurring.endDate||next<=s.recurring.endDate) {
          await ScheduledTransaction.create([{ userId:s.userId, fromAccountNumber:s.fromAccountNumber, toAccountNumber:s.toAccountNumber, amount:s.amount, description:s.description, transferMode:s.transferMode, category:s.category, scheduledAt:next, recurring:s.recurring }],{ session });
        }
      }
      await s.save({ session }); await session.commitTransaction();
      logger.info(`[Scheduler] ✅ ₹${s.amount} → ${s.toAccountNumber}`);
    } catch (err) { await session.abortTransaction(); s.status='failed'; s.failureReason=err.message; await s.save(); logger.error(`[Scheduler] ${err.message}`); }
    finally { session.endSession(); }
  }
};

const cleanupOTPs = async () => {
  const r = await OTP.deleteMany({ expiresAt:{ $lt:new Date() } });
  if (r.deletedCount > 0) logger.info(`[Scheduler] Cleaned ${r.deletedCount} expired OTPs`);
};

const registerJobs = () => {
  cron.schedule('* * * * *',    executeScheduled);
  cron.schedule('*/30 * * * *', cleanupOTPs);
  logger.info('⏰ Cron: scheduled-tx(1min), otp-cleanup(30min)');
};

if (require.main === module) { connectDB().then(registerJobs); }
module.exports = { registerJobs };
