const { AgentLog } = require('../models/index');
const logger = require('../utils/logger');

const parseWithKeywords = (text) => {
  const t = text.toLowerCase().trim();
  const amountMatch = t.match(/(?:rs\.?|₹|rupees?|inr)?\s*(\d[\d,]*(?:\.\d{2})?)/i);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g,'')) : null;
  const nameMatch = t.match(/(?:to|for|send to|transfer to|pay)\s+([a-z]+(?:\s+[a-z]+)?)/i);
  const recipientName = nameMatch ? nameMatch[1].trim() : null;
  const categories = ['food','travel','shopping','fuel','utilities','healthcare','entertainment'];
  const category = categories.find(c => t.includes(c));
  let scheduledAt = null;
  if (t.includes('tomorrow')) scheduledAt = new Date(Date.now()+86400000);
  else if (t.includes('next week')) scheduledAt = new Date(Date.now()+7*86400000);

  if (/\b(send|transfer|pay|give)\b/.test(t) && scheduledAt) return { intent:'SCHEDULE', amount, recipientName, scheduledAt, confidence:0.80 };
  if (/\b(send|transfer|pay|give)\b/.test(t)) return { intent:'TRANSFER', amount, recipientName, confidence:0.85 };
  if (/\b(balance|how much|money|account)\b/.test(t)) return { intent:'BALANCE', confidence:0.95 };
  if (/\b(transaction|history|recent|statement|last)\b/.test(t)) { const cm = t.match(/last\s+(\d+)/); return { intent:'HISTORY', count: cm ? parseInt(cm[1]) : 5, confidence:0.90 }; }
  if (/\b(emi|installment|convert|loan)\b/.test(t)) return { intent:'BNPL', amount, tenure:3, confidence:0.80 };
  if (/\b(credit score|cibil)\b/.test(t)) return { intent:'CREDIT_SCORE', confidence:0.95 };
  if (/\b(spend|spent|category|insight)\b/.test(t)) return { intent:'INSIGHTS', category, confidence:0.80 };
  return { intent:'UNKNOWN', confidence:0.10 };
};

const parseIntent = async (text, userId) => {
  let parsed;
  if (process.env.AI_USE_OPENAI === 'true' && process.env.OPENAI_API_KEY) {
    try {
      const axios = require('axios');
      const { data } = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          { role:'system', content:'Parse banking commands into JSON: {intent,amount,recipientName,category,scheduledAt,tenure,count,confidence}. Intents: TRANSFER,BALANCE,HISTORY,SCHEDULE,BNPL,CREDIT_SCORE,INSIGHTS,UNKNOWN. Return only valid JSON.' },
          { role:'user', content: text },
        ],
        max_tokens: 200, temperature: 0.1,
      }, { headers: { Authorization:`Bearer ${process.env.OPENAI_API_KEY}` }, timeout:8000 });
      parsed = JSON.parse(data.choices[0].message.content);
    } catch (e) { logger.warn(`[Agent] OpenAI failed: ${e.message}, using keywords`); parsed = parseWithKeywords(text); }
  } else {
    parsed = parseWithKeywords(text);
  }
  await AgentLog.create({ userId, input:text, intent:parsed.intent, entities:parsed, confidence:parsed.confidence }).catch(()=>{});
  return parsed;
};

const executeIntent = async (parsed, user, beneficiaries = []) => {
  const { intent, amount, recipientName, count, category, scheduledAt, tenure } = parsed;
  const fmt = (n) => `₹${(n||0).toLocaleString('en-IN',{minimumFractionDigits:2})}`;

  switch (intent) {
    case 'BALANCE':
      return { action:'BALANCE', message:`Your current balance is ${fmt(user.balance)}.`, data:{ balance:user.balance } };

    case 'TRANSFER': {
      if (!amount) return { action:'CLARIFY', message:'How much would you like to transfer?' };
      const bene = recipientName ? beneficiaries.find(b => b.name.toLowerCase().includes(recipientName.toLowerCase()) || (b.nickname||'').toLowerCase().includes(recipientName.toLowerCase())) : null;
      if (!bene && recipientName) return { action:'CLARIFY', message:`Could not find "${recipientName}" in your beneficiaries. Please check the name.`, data:{ amount, recipientName } };
      if (user.balance < amount) return { action:'ERROR', message:`Insufficient balance. You have ${fmt(user.balance)} but trying to send ${fmt(amount)}.` };
      return { action:'TRANSFER_DRAFT', message:`Ready to send ${fmt(amount)} to ${bene?.name||recipientName}. Please confirm.`, data:{ amount, toAccountNumber:bene?.accountNumber, beneficiaryName:bene?.name||recipientName, requiresOTP:true, draft:true } };
    }

    case 'HISTORY':
      return { action:'SHOW_HISTORY', message:`Showing your last ${count||5} transactions.`, data:{ limit:count||5 } };

    case 'CREDIT_SCORE':
      return { action:'CREDIT_SCORE', message:`Your credit score is ${user.creditScore||'not yet calculated'}. Fetching latest...`, data:{ triggerCalculation:true } };

    case 'INSIGHTS':
      return { action:'SHOW_INSIGHTS', message: category ? `Showing your ${category} spending.` : 'Showing your spending insights.', data:{ category } };

    case 'BNPL':
      return { action:'BNPL_OFFER', message: amount ? `I can convert ${fmt(amount)} into ${tenure||3} monthly installments.` : 'Which transaction to convert to EMI?', data:{ amount, tenure:tenure||3 } };

    case 'SCHEDULE':
      if (!amount||!scheduledAt) return { action:'CLARIFY', message:'Please specify amount and date for scheduling.' };
      return { action:'SCHEDULE_DRAFT', message:`Ready to schedule ${fmt(amount)} to ${recipientName||'beneficiary'} on ${new Date(scheduledAt).toLocaleDateString('en-IN')}.`, data:{ amount, recipientName, scheduledAt, draft:true } };

    default:
      return { action:'UNKNOWN', message:"I didn't understand. Try: 'Check balance', 'Send 500 to Mom', 'Show last 5 transactions', 'Credit score'.", suggestions:['Check my balance','Send 1000 to Mom','Show last 5 transactions','What is my credit score','Convert to EMI'] };
  }
};

module.exports = { parseIntent, executeIntent };
