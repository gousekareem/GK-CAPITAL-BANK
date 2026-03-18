const { Transaction, FraudAlert, BehaviorProfile } = require('../models/index');
const logger = require('../utils/logger');

const THRESHOLDS = {
  largeAmount:  parseFloat(process.env.FRAUD_LARGE_AMOUNT) || 50000,
  rapidCount:   parseInt(process.env.FRAUD_RAPID_TX_COUNT) || 5,
  rapidMins:    parseInt(process.env.FRAUD_RAPID_WINDOW_MINS) || 10,
  blockScore:   parseInt(process.env.FRAUD_RISK_BLOCK_SCORE) || 90,
  spikeMulti:   3,
  unusualStart: 22,
  unusualEnd:   6,
};

const analyzeTransaction = async (userId, accountNumber, amount, toAccountNumber, meta = {}) => {
  const flags = [], reasons = [];
  let riskScore = 0;

  try {
    if (amount >= THRESHOLDS.largeAmount) {
      flags.push('large_amount'); riskScore += 25;
      reasons.push(`Large transfer: ₹${amount.toLocaleString('en-IN')} (threshold ₹${THRESHOLDS.largeAmount.toLocaleString('en-IN')})`);
    }

    const windowStart = new Date(Date.now() - THRESHOLDS.rapidMins * 60 * 1000);
    const recentCount = await Transaction.countDocuments({ fromAccountNumber: accountNumber, createdAt: { $gte: windowStart }, status: 'completed' });
    if (recentCount >= THRESHOLDS.rapidCount) {
      flags.push('rapid_transfers'); riskScore += 30;
      reasons.push(`${recentCount} transfers in ${THRESHOLDS.rapidMins} minutes`);
    }

    const hour = new Date().getHours();
    if (hour >= THRESHOLDS.unusualStart || hour < THRESHOLDS.unusualEnd) {
      flags.push('unusual_time'); riskScore += 15;
      reasons.push(`Transaction at ${hour}:00 (unusual hour)`);
    }

    const profile = await BehaviorProfile.findOne({ userId });
    if (profile?.avgTransactionAmount > 0 && amount / profile.avgTransactionAmount >= THRESHOLDS.spikeMulti) {
      flags.push('amount_spike'); riskScore += 20;
      reasons.push(`Amount ${(amount/profile.avgTransactionAmount).toFixed(1)}x above usual avg of ₹${profile.avgTransactionAmount.toFixed(0)}`);
    }

    const prevTx = await Transaction.countDocuments({ fromAccountNumber: accountNumber, toAccountNumber, status: 'completed' });
    if (prevTx === 0) { flags.push('new_beneficiary'); riskScore += 10; reasons.push('First transfer to this account'); }

    riskScore = Math.min(100, riskScore);

    // Update behavior profile
    const amounts = [...(profile?.transactionAmounts || []), amount].slice(-50);
    const avg     = amounts.reduce((s,a)=>s+a,0) / amounts.length;
    await BehaviorProfile.findOneAndUpdate({ userId }, {
      $set: { avgTransactionAmount: avg, transactionAmounts: amounts, lastUpdated: new Date() },
      $inc: { totalTransactions: 1 },
      $push: { recentTimestamps: { $each: [new Date()], $slice: -20 } },
    }, { upsert: true });

    const suspicious = riskScore >= 50;
    if (suspicious || flags.length > 0) {
      await FraudAlert.create({
        userId, accountNumber, amount, toAccountNumber, flags, riskScore, reasons,
        severity: riskScore >= 80 ? 'high' : riskScore >= 50 ? 'medium' : 'low',
        blocked: riskScore >= THRESHOLDS.blockScore,
        ipAddress: meta.ip,
      });
      logger.warn(`[Fraud] Risk ${riskScore}/100 for ${accountNumber}→${toAccountNumber} ₹${amount}`);
    }

    return { riskScore, flags, reasons, suspicious, blocked: riskScore >= THRESHOLDS.blockScore, reason: reasons.join('; ') };
  } catch (err) {
    logger.error(`[Fraud] Error: ${err.message}`);
    return { riskScore: 0, flags: [], suspicious: false, blocked: false };
  }
};

module.exports = { analyzeTransaction };
