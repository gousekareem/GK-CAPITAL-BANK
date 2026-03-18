const { Transaction, Ledger } = require('../models/index');
const logger = require('../utils/logger');

// ── Double-Entry Ledger ───────────────────────────────────────────────────────
const createLedgerEntries = async (txDoc, sender, receiver, session = null) => {
  const entries = [
    { transactionId:txDoc._id, accountNumber:sender.accountNumber, userId:sender._id, entryType:'debit',  amount:txDoc.amount+(txDoc.charges||0), balanceBefore:txDoc.balanceBefore, balanceAfter:txDoc.balanceAfter, description:txDoc.description, category:txDoc.category },
    { transactionId:txDoc._id, accountNumber:receiver.accountNumber, userId:receiver._id, entryType:'credit', amount:txDoc.amount, balanceBefore:receiver.balance-txDoc.amount, balanceAfter:receiver.balance, description:txDoc.description, category:txDoc.category },
  ];
  await Ledger.create(entries, session ? { session } : {});
};

const getLedgerStatement = async (accountNumber, startDate, endDate) => {
  const filter = { accountNumber };
  if (startDate || endDate) { filter.createdAt = {}; if (startDate) filter.createdAt.$gte = new Date(startDate); if (endDate) filter.createdAt.$lte = new Date(endDate); }
  return Ledger.find(filter).sort({ createdAt:-1 }).lean();
};

// ── Cash Flow Predictor (Linear Regression) ───────────────────────────────────
const predictCashFlow = async (userId, accountNumber, currentBalance) => {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000);
    const txs = await Transaction.find({ $or:[{fromAccountNumber:accountNumber},{toAccountNumber:accountNumber}], createdAt:{$gte:ninetyDaysAgo}, status:'completed' }).sort({createdAt:1}).lean();

    if (txs.length < 5) return { prediction:'insufficient_data', message:'Need at least 5 transactions.', willGoNegative:false };

    const dailyFlow = {};
    txs.forEach(tx => {
      const day = tx.createdAt.toISOString().split('T')[0];
      const isCredit = tx.toAccountNumber === accountNumber && tx.type === 'credit';
      dailyFlow[day] = (dailyFlow[day]||0) + (isCredit ? tx.amount : -(tx.amount+(tx.charges||0)));
    });

    const days = Object.keys(dailyFlow).sort();
    const n    = days.length;
    const x    = days.map((_,i)=>i);
    const y    = days.map(d=>dailyFlow[d]);
    const xMean = x.reduce((s,v)=>s+v,0)/n, yMean = y.reduce((s,v)=>s+v,0)/n;
    const num = x.reduce((s,xi,i)=>s+(xi-xMean)*(y[i]-yMean),0);
    const den = x.reduce((s,xi)=>s+Math.pow(xi-xMean,2),0);
    const slope = den !== 0 ? num/den : 0;
    const intercept = yMean - slope * xMean;

    let projectedBalance = currentBalance, lowestBalance = currentBalance, lowestDay = null;
    const predictions = [];
    for (let i = 0; i < 30; i++) {
      const flow = slope*(n+i)+intercept;
      projectedBalance += flow;
      predictions.push({ day:i+1, flow:Math.round(flow), balance:Math.round(projectedBalance) });
      if (projectedBalance < lowestBalance) { lowestBalance = projectedBalance; lowestDay = i+1; }
    }

    const willGoNegative   = lowestBalance < 0;
    const willGoBelowSafe  = lowestBalance < 5000;
    const avgDailySpend    = Math.abs(y.filter(v=>v<0).reduce((s,v)=>s+v,0)/Math.max(1,y.filter(v=>v<0).length));

    return {
      willGoNegative, willGoBelowSafe,
      lowestProjectedBalance: Math.round(lowestBalance), lowestOnDay: lowestDay,
      avgDailySpend: Math.round(avgDailySpend),
      projectedBalance30d: Math.round(projectedBalance),
      trend: slope > 0 ? 'improving' : slope < -100 ? 'declining' : 'stable',
      slopePerDay: Math.round(slope),
      predictions: predictions.slice(0, 10),
      confidence: Math.min(0.9, 0.5 + txs.length * 0.01),
      warning: willGoNegative
        ? `⛔ Balance may reach ₹${Math.round(lowestBalance).toLocaleString('en-IN')} in ~${lowestDay} days. Reduce spending urgently.`
        : willGoBelowSafe
        ? `⚠️ Balance may drop to ₹${Math.round(lowestBalance).toLocaleString('en-IN')} in ~${lowestDay} days.`
        : '✅ Cash flow looks healthy for the next 30 days.',
    };
  } catch (err) {
    logger.error(`[CashFlow] ${err.message}`);
    return { prediction:'error', message:err.message, willGoNegative:false };
  }
};

module.exports = { createLedgerEntries, getLedgerStatement, predictCashFlow };
