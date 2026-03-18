import React from 'react';
import { fmt, fmtDate, CAT, mask } from '../utils/helpers';

export const Spinner = ({ size=5 }) => <div className={`animate-spin rounded-full border-2 border-gray-200 border-t-sbi-600 w-${size} h-${size}`} />;
export const PageLoader = () => <div className="flex items-center justify-center h-64"><div className="text-center"><Spinner size={10} /><p className="text-gray-400 text-sm mt-3">Loading...</p></div></div>;
export const EmptyState = ({ icon='📭', title='No data', subtitle='' }) => <div className="flex flex-col items-center justify-center py-16 text-center"><span className="text-5xl mb-3">{icon}</span><p className="text-gray-600 font-medium">{title}</p>{subtitle&&<p className="text-gray-400 text-sm mt-1">{subtitle}</p>}</div>;
export const Badge = ({ children, color='blue' }) => { const cls={blue:'bg-blue-50 text-blue-700',green:'bg-green-50 text-green-700',red:'bg-red-50 text-red-700',amber:'bg-amber-50 text-amber-700',gray:'bg-gray-100 text-gray-600',purple:'bg-purple-50 text-purple-700'}[color]||'bg-gray-100 text-gray-600'; return <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{children}</span>; };
export const ProgressBar = ({ value, max, color='bg-sbi-600', h='h-1.5' }) => <div className={`w-full ${h} bg-gray-100 rounded-full overflow-hidden`}><div className={`${h} ${color} rounded-full transition-all`} style={{width:`${Math.min(100,Math.round((value/(max||1))*100))}%`}} /></div>;

export const TxRow = ({ tx, accountNumber }) => {
  const isCredit = tx.perspective==='credit' || (tx.toAccountNumber===accountNumber && tx.type==='credit');
  const meta = CAT[tx.category] || CAT.other;
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg}`}><span className="text-base">{meta.icon}</span></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{tx.description||'Transaction'}</p>
        <p className="text-xs text-gray-400 mt-0.5">{tx.merchant&&`${tx.merchant} · `}{fmtDate(tx.createdAt)}{tx.transferMode&&tx.transferMode!=='INTERNAL'&&` · ${tx.transferMode}`}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold ${isCredit?'text-green-600':'text-red-600'}`}>{isCredit?'+':'-'}{fmt(tx.amount)}</p>
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${tx.status==='completed'?'text-green-600':'text-red-500'}`}>{tx.status==='completed'?'✓':tx.status}</span>
      </div>
    </div>
  );
};

export const AccountCard = ({ account, onTransfer }) => {
  const [show, setShow] = React.useState(true);
  return (
    <div className="relative rounded-2xl overflow-hidden text-white" style={{background:'linear-gradient(135deg,#0d2d44,#1a5276,#2e86c1)'}}>
      <div className="absolute inset-0 opacity-10 pointer-events-none"><div className="absolute -top-16 -right-16 w-64 h-64 bg-white rounded-full"/><div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white rounded-full"/></div>
      <div className="relative p-6">
        <div className="flex justify-between items-start mb-4">
          <div><p className="text-blue-200 text-xs uppercase tracking-widest">{account?.accountType?.toUpperCase()||'SAVINGS'} ACCOUNT</p><p className="text-sm font-mono mt-0.5 text-blue-100">{mask(account?.accountNumber)}</p></div>
          <div className="text-right text-xs text-blue-200"><p>IFSC: {account?.ifscCode}</p><p className="mt-0.5">{account?.branchName}</p></div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-blue-200 text-xs mb-1">AVAILABLE BALANCE</p>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black">{show?fmt(account?.balance||0):'₹ ••••••'}</span>
              <button onClick={()=>setShow(!show)} className="bg-white/20 hover:bg-white/30 w-8 h-8 rounded-lg flex items-center justify-center text-sm">{show?'🙈':'👁️'}</button>
            </div>
          </div>
          {onTransfer&&<button onClick={onTransfer} className="bg-sbi-gold hover:bg-yellow-400 text-gray-900 font-bold px-5 py-2.5 rounded-xl text-sm">↗ Send Money</button>}
        </div>
      </div>
    </div>
  );
};
