const PDFDocument = require('pdfkit');
const fs   = require('fs');
const path = require('path');
const { Transaction } = require('../models/index');
const logger = require('../utils/logger');

const fmtD = (d) => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
const fmtT = (d) => new Date(d).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
const fmtN = (n) => `Rs. ${(n||0).toFixed(2)}`;

const STORAGE = process.env.STATEMENT_STORAGE_PATH || './statements';
if (!fs.existsSync(STORAGE)) fs.mkdirSync(STORAGE, { recursive: true });

const generateStatement = async (user, year, month) => {
  const startDate = new Date(year, month-1, 1);
  const endDate   = new Date(year, month, 0, 23, 59, 59);
  const monthName = startDate.toLocaleString('en-IN', { month:'long', year:'numeric' });

  const txs = await Transaction.find({
    $or:[{fromAccountNumber:user.accountNumber},{toAccountNumber:user.accountNumber}],
    createdAt:{$gte:startDate,$lte:endDate}, status:'completed',
  }).sort({createdAt:1}).lean();

  let totalCredit = 0, totalDebit = 0;
  const enriched = txs.map(tx => {
    const isCredit = tx.toAccountNumber === user.accountNumber && tx.type === 'credit';
    if (isCredit) totalCredit += tx.amount; else totalDebit += tx.amount;
    return { ...tx, isCredit };
  });

  const fileName = `statement_${user.accountNumber}_${year}_${String(month).padStart(2,'0')}.pdf`;
  const filePath = path.join(STORAGE, fileName);
  const doc = new PDFDocument({ size:'A4', margin:40 });
  const ws  = fs.createWriteStream(filePath);
  doc.pipe(ws);

  // Header
  doc.rect(0,0,doc.page.width,75).fill('#1a4b96');
  doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text('GK CAPITAL BANK', 40, 16);
  doc.fontSize(10).font('Helvetica').text('Account Statement — ' + monthName, 40, 42);
  doc.text('Generated: ' + fmtT(new Date()), 40, 56);
  doc.fillColor('#000000').moveDown(2);

  // Account Info
  doc.rect(40,88,doc.page.width-80,85).fill('#f0f4ff').stroke('#1a4b96');
  doc.fillColor('#1a4b96').fontSize(10).font('Helvetica-Bold').text('ACCOUNT DETAILS', 55,97);
  doc.fillColor('#333333').fontSize(9).font('Helvetica');
  const col1=55, col2=310;
  [[`Account Holder`, `${user.firstName} ${user.lastName}`, 'Account Number', user.accountNumber],
   ['Account Type', (user.accountType||'savings').toUpperCase(), 'IFSC Code', user.ifscCode||'GKCB0000001'],
   ['Branch', user.branchName||'Main Branch', 'Period', monthName]].forEach(([k1,v1,k2,v2],i) => {
    const y = 112 + i*18;
    doc.font('Helvetica-Bold').text(k1+':',col1,y).font('Helvetica').text(v1,col1+95,y);
    doc.font('Helvetica-Bold').text(k2+':',col2,y).font('Helvetica').text(v2,col2+95,y);
  });

  // Summary
  const sy = 185;
  doc.rect(40,sy,doc.page.width-80,45).fill('#fafafa').stroke('#e5e7eb');
  const sw = (doc.page.width-80)/4;
  [['Total Credits', fmtN(totalCredit),'#16a34a'],['Total Debits',fmtN(totalDebit),'#dc2626'],['Net Flow',fmtN(totalCredit-totalDebit),totalCredit>=totalDebit?'#16a34a':'#dc2626'],['Transactions',txs.length.toString(),'#1a4b96']].forEach(([l,v,c],i) => {
    const x=40+i*sw+8;
    doc.fontSize(8).font('Helvetica').fillColor('#6b7280').text(l,x,sy+7);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(c).text(v,x,sy+22);
  });

  // Table header
  let rowY = 248;
  doc.rect(40,rowY,doc.page.width-80,18).fill('#1a4b96');
  doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
  doc.text('DATE',48,rowY+5); doc.text('DESCRIPTION',115,rowY+5); doc.text('REF',295,rowY+5);
  doc.text('DEBIT',385,rowY+5); doc.text('CREDIT',445,rowY+5); doc.text('BALANCE',505,rowY+5);
  rowY += 20;

  // Rows
  let runBal = enriched[0]?.balanceBefore ?? user.balance;
  doc.font('Helvetica').fontSize(8).fillColor('#333333');

  if (!enriched.length) {
    doc.fillColor('#9ca3af').text('No transactions in this period.', 48, rowY+10);
  } else {
    enriched.forEach((tx, idx) => {
      if (rowY > doc.page.height-70) { doc.addPage(); rowY=60; }
      if (idx%2===0) doc.rect(40,rowY-2,doc.page.width-80,17).fill('#f9fafb');
      doc.fillColor('#333333');
      runBal = tx.isCredit ? runBal + tx.amount : runBal - tx.amount;
      doc.text(fmtD(tx.createdAt),48,rowY);
      doc.text((tx.description||'Transaction').slice(0,28),115,rowY,{width:175,ellipsis:true});
      doc.text((tx.idempotencyKey||'').slice(0,14),295,rowY,{width:85});
      if (!tx.isCredit) { doc.fillColor('#dc2626').text(tx.amount.toFixed(2),385,rowY); doc.fillColor('#9ca3af').text('-',445,rowY); }
      else              { doc.fillColor('#9ca3af').text('-',385,rowY); doc.fillColor('#16a34a').text(tx.amount.toFixed(2),445,rowY); }
      doc.fillColor('#1a4b96').font('Helvetica-Bold').text(runBal.toFixed(2),505,rowY);
      doc.font('Helvetica');
      doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(40,rowY+13).lineTo(doc.page.width-40,rowY+13).stroke();
      rowY += 17;
    });
  }

  // Footer
  const fy = doc.page.height-45;
  doc.rect(40,fy-2,doc.page.width-80,0.5).fill('#e5e7eb');
  doc.fontSize(8).fillColor('#9ca3af').font('Helvetica')
    .text('Computer generated statement — no signature required.',40,fy+5,{align:'center',width:doc.page.width-80})
    .text('GK Capital Bank | 1800-GK-2024 | www.gkcapitalbank.in',40,fy+17,{align:'center',width:doc.page.width-80});

  doc.end();
  await new Promise((res,rej) => { ws.on('finish',res); ws.on('error',rej); });
  logger.info(`[Statement] Generated: ${fileName}`);
  return { filePath, fileName, transactions:enriched.length, totalCredit, totalDebit };
};

module.exports = { generateStatement };
