// helpers.js
export const fmt = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2}).format(n||0);
export const fmtC= n => n>=10000000?`₹${(n/10000000).toFixed(1)}Cr`:n>=100000?`₹${(n/100000).toFixed(1)}L`:n>=1000?`₹${(n/1000).toFixed(1)}K`:`₹${n}`;
export const fmtDate = d => new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
export const fmtDT   = d => new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
export const mask    = n => n?`xxxx xxxx ${String(n).slice(-4)}`:'';

export const CAT = {
  food:          {icon:'🍽️',label:'Food',          color:'#ef4444',bg:'bg-red-50',   text:'text-red-700'   },
  travel:        {icon:'✈️', label:'Travel',        color:'#eab308',bg:'bg-yellow-50',text:'text-yellow-700'},
  shopping:      {icon:'🛍️',label:'Shopping',      color:'#f97316',bg:'bg-orange-50',text:'text-orange-700'},
  utilities:     {icon:'⚡', label:'Utilities',     color:'#22c55e',bg:'bg-green-50', text:'text-green-700' },
  healthcare:    {icon:'🏥', label:'Healthcare',    color:'#ec4899',bg:'bg-pink-50',  text:'text-pink-700'  },
  entertainment: {icon:'🎬', label:'Entertainment', color:'#8b5cf6',bg:'bg-purple-50',text:'text-purple-700'},
  education:     {icon:'📚', label:'Education',     color:'#6366f1',bg:'bg-indigo-50',text:'text-indigo-700'},
  fuel:          {icon:'⛽', label:'Fuel',          color:'#06b6d4',bg:'bg-cyan-50',  text:'text-cyan-700'  },
  salary:        {icon:'💰', label:'Salary',        color:'#16a34a',bg:'bg-green-50', text:'text-green-700' },
  other:         {icon:'💸', label:'Other',         color:'#6b7280',bg:'bg-gray-100', text:'text-gray-600'  },
};

export const MODES = [
  {value:'IMPS',label:'IMPS – Instant (24x7)',charges:'₹5–15'},
  {value:'NEFT',label:'NEFT – 30 min',        charges:'₹2.5–25'},
  {value:'RTGS',label:'RTGS – Min ₹2 Lakh',   charges:'₹25–50'},
  {value:'UPI', label:'UPI – Free & Instant',  charges:'Free'},
];

export const calcCharges = (a,m) => {
  if(['UPI','INTERNAL'].includes(m)) return 0;
  if(m==='IMPS') return a<=10000?5:a<=100000?10:15;
  if(m==='NEFT') return a<=10000?2.5:a<=100000?5:a<=200000?15:25;
  if(m==='RTGS') return a<=500000?25:50;
  return 0;
};
