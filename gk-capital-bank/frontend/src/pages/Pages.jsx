import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { v4 as uuidv4 } from 'uuid';
import { authAPI, accountAPI, txAPI, beneAPI, profileAPI, bnplAPI, aiAPI, stmtAPI, schedAPI, agentAPI, analyticsAPI, sessionAPI, kycAPI, adminAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import { fmt, fmtC, fmtDate, fmtDT, mask, CAT, MODES, calcCharges } from '../utils/helpers';
import { PageLoader, EmptyState, TxRow, AccountCard, Badge, ProgressBar } from '../components/Shared';
import { useBiometrics } from '../hooks/useAutoLogout';

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN PAGE (2-step 2FA)
// ─────────────────────────────────────────────────────────────────────────────
export function LoginPage() {
  const navigate = useNavigate();
  const { loginStep1, loginStep2, loading } = useAuthStore();
  const { register, handleSubmit } = useForm({ defaultValues:{ identifier:'demo@gkcapital.in', password:'Demo@1234' } });
  const { getBiometricData } = useBiometrics();
  const [step, setStep]     = useState(1);
  const [info, setInfo]     = useState({});
  const [tempToken, setTmp] = useState('');
  const [otp, setOtp]       = useState('');
  const [showPwd, setShow]  = useState(false);
  const otpRefs = useRef([]);

  const onCredentials = async (data) => {
    const biometricData = getBiometricData();
    const res = await loginStep1({ ...data, biometricData });
    if (!res.ok) { toast.error(res.error); return; }
    setInfo(res.data); setTmp(res.data.tempToken);
    if (res.data.devOtp) toast(`Dev OTP: ${res.data.devOtp}`, { icon:'📱', duration:15000 });
    toast.success(res.data.message || 'OTP sent');
    setStep(2);
  };

  const onOTP = async () => {
    if (otp.length !== 6) { toast.error('Enter 6-digit OTP'); return; }
    const res = await loginStep2({ tempToken, otp });
    if (!res.ok) { toast.error(res.error); return; }
    navigate('/dashboard');
  };

  const handleOtpInput = (e, i) => {
    const v = e.target.value.replace(/\D/,'');
    const arr = (otp + '      ').split('');
    arr[i] = v;
    const joined = arr.slice(0,6).join('').trimEnd();
    setOtp(joined);
    if (v && i < 5) otpRefs.current[i+1]?.focus();
  };

  return (
    <div className="min-h-screen flex" style={{background:'linear-gradient(135deg,#0d2d44,#1a5276,#2e86c1)'}}>
      <div className="hidden lg:flex flex-col justify-center px-16 flex-1 text-white">
        <div className="flex items-center gap-3 mb-8"><div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center font-black text-gray-900 text-lg">GKC</div><div><p className="font-bold text-xl">GK Capital Bank</p><p className="text-blue-300 text-xs">Digital Banking v3.0</p></div></div>
        <h1 className="text-4xl font-black mb-3 leading-tight">Secure. Smart.<br/><span className="text-yellow-400">Real-time.</span></h1>
        <p className="text-blue-200 text-sm mb-8 max-w-sm">2FA on every login, fraud detection on every transfer, AI-powered insights.</p>
        {[['🔐','2FA on every login','OTP via SMS, email, or terminal'],['🛡️','Advanced fraud detection','AI risk scoring 0–100'],['🤖','AI Banking Agent','Voice & text commands'],['📄','PDF Statements','Download monthly statements'],['⏰','Scheduled transfers','Recurring payments']].map(([ic,t,d])=>(
          <div key={t} className="flex items-center gap-3 bg-white/10 rounded-xl p-3 mb-2"><span className="text-xl">{ic}</span><div><p className="font-semibold text-sm">{t}</p><p className="text-blue-300 text-xs">{d}</p></div></div>
        ))}
      </div>
      <div className="flex items-center justify-center p-6 w-full lg:w-auto">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="flex bg-gray-50 border-b">
            {['Credentials','2FA Verify'].map((s,i)=>(
              <div key={s} className={`flex-1 py-3 text-center text-xs font-semibold ${step===i+1?'text-sbi-600 border-b-2 border-sbi-600 bg-white':'text-gray-400'}`}>
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs mr-1 ${step>i+1?'bg-green-500 text-white':step===i+1?'bg-sbi-600 text-white':'bg-gray-200 text-gray-500'}`}>{step>i+1?'✓':i+1}</span>{s}
              </div>
            ))}
          </div>
          <div className="p-8">
            {step===1&&(
              <>
                <div className="text-center mb-6"><div className="text-4xl mb-2">🏦</div><h2 className="text-xl font-bold text-gray-800">Login</h2><p className="text-gray-400 text-xs mt-1">demo@gkcapital.in / Demo@1234</p></div>
                <form onSubmit={handleSubmit(onCredentials)} className="space-y-4">
                  <div><label className="label">Email / Customer ID</label><input {...register('identifier',{required:true})} className="input" placeholder="email or GKC123..." autoComplete="username"/></div>
                  <div><label className="label">Password</label>
                    <div className="relative">
                      <input {...register('password',{required:true})} type={showPwd?'text':'password'} className="input pr-10" autoComplete="current-password"/>
                      <button type="button" onClick={()=>setShow(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPwd?'🙈':'👁️'}</button>
                    </div>
                    <div className="flex justify-end mt-1"><Link to="/forgot-password" className="text-xs text-sbi-600">Forgot?</Link></div>
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary w-full py-3">{loading?<><span className="animate-spin">⟳</span> Sending OTP...</>:'→ Continue'}</button>
                </form>
              </>
            )}
            {step===2&&(
              <>
                <div className="text-center mb-5"><div className="text-4xl mb-2">📱</div><h2 className="text-xl font-bold text-gray-800">Verify OTP</h2>
                  {info.phone&&<p className="text-gray-400 text-sm">Sent to +91 {info.phone}</p>}
                  {info.devOtp&&<p className="text-xs text-sbi-600 mt-1 font-bold">Dev OTP: {info.devOtp}</p>}
                  <p className="text-xs text-gray-400 mt-1">(Also check backend terminal)</p>
                </div>
                <div className="flex gap-2 justify-center mb-5">
                  {[0,1,2,3,4,5].map(i=>(
                    <input key={i} ref={el=>otpRefs.current[i]=el} maxLength={1} value={otp[i]||''}
                      onChange={e=>handleOtpInput(e,i)}
                      onKeyDown={e=>{ if(e.key==='Backspace'&&!otp[i]&&i>0) otpRefs.current[i-1]?.focus(); }}
                      className="w-11 h-13 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-sbi-600 py-2 bg-white"
                    />
                  ))}
                </div>
                <button onClick={onOTP} disabled={otp.length<6||loading} className="btn-primary w-full py-3 mb-2">{loading?<><span className="animate-spin">⟳</span> Verifying...</>:'✅ Verify & Login'}</button>
                <button onClick={()=>{setStep(1);setOtp('');}} className="w-full text-xs text-gray-400 hover:underline">← Back to login</button>
              </>
            )}
            <p className="text-center text-sm text-gray-500 mt-5">New? <Link to="/register" className="text-sbi-600 font-semibold hover:underline">Open Account</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function RegisterPage() {
  const navigate = useNavigate();
  const { register: regStore } = useAuthStore();
  const { register, handleSubmit, watch, formState:{ errors } } = useForm();
  const [step, setStep] = useState('form');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);

  const onSubmit = async (data) => {
    if (data.password !== data.confirmPassword) { toast.error('Passwords do not match'); return; }
    const res = await regStore(data);
    if (!res.ok) { toast.error(res.error); return; }
    setEmail(data.email);
    if (res.data.devOtp) toast(`Dev OTP: ${res.data.devOtp}`, { icon:'📧', duration:15000 });
    toast.success(res.data.message);
    setStep('verify');
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) { toast.error('Enter 6-digit OTP'); return; }
    setVerifying(true);
    try { await authAPI.verifyEmail({ email, otp }); toast.success('Email verified! Please login.'); navigate('/login'); }
    catch (e) { toast.error(e.response?.data?.error || 'Invalid OTP'); }
    finally { setVerifying(false); }
  };

  if (step === 'verify') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'linear-gradient(135deg,#0d2d44,#1a5276)'}}>
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
        <div className="text-4xl mb-3">📧</div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">Verify Email</h2>
        <p className="text-gray-400 text-sm mb-1">OTP sent to <strong>{email}</strong></p>
        <p className="text-xs text-sbi-600 mb-5">(Check email or backend terminal)</p>
        <input value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/,'').slice(0,6))} className="input text-center text-2xl tracking-[.5em] font-bold mb-4" placeholder="••••••"/>
        <button onClick={verifyOTP} disabled={verifying||otp.length!==6} className="btn-primary w-full mb-2">{verifying?'Verifying...':'Verify & Activate'}</button>
        <button onClick={()=>navigate('/login')} className="text-xs text-gray-400 hover:underline">Skip for now</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'linear-gradient(135deg,#0d2d44,#1a5276)'}}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
        <div className="flex items-center gap-3 mb-6"><div className="w-10 h-10 bg-sbi-600 rounded-xl flex items-center justify-center text-white font-black text-xs">GKC</div><div><h2 className="text-xl font-bold text-gray-800">Open Account</h2><p className="text-xs text-gray-400">GK Capital Bank</p></div></div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[['First Name','firstName'],['Last Name','lastName']].map(([l,n])=>(
              <div key={n}><label className="label">{l}</label><input {...register(n,{required:true})} className="input" placeholder={l}/>{errors[n]&&<p className="text-red-500 text-xs mt-0.5">Required</p>}</div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Email</label><input {...register('email',{required:true,pattern:{value:/\S+@\S+\.\S+/,message:'Invalid email'}})} type="email" className="input" placeholder="email@example.com"/>{errors.email&&<p className="text-red-500 text-xs mt-0.5">{errors.email.message||'Required'}</p>}</div>
            <div><label className="label">Phone (10 digits)</label><input {...register('phone',{required:true,pattern:{value:/^\d{10}$/,message:'10 digits'}})} className="input" placeholder="9876543210" maxLength={10}/>{errors.phone&&<p className="text-red-500 text-xs mt-0.5">{errors.phone.message}</p>}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[['Password','password'],['Confirm Password','confirmPassword']].map(([l,n])=>(
              <div key={n}><label className="label">{l}</label><input {...register(n,{required:true,...(n==='password'?{minLength:{value:8,message:'Min 8 chars'},pattern:{value:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,message:'Upper + lower + number'}}:{})})} type="password" className="input" placeholder="••••••••"/>{errors[n]&&<p className="text-red-500 text-xs mt-0.5">{errors[n].message||'Required'}</p>}</div>
            ))}
          </div>
          <button type="submit" className="btn-primary w-full py-3 mt-2">🏦 Create Account</button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">Already have an account? <Link to="/login" className="text-sbi-600 font-semibold">Login</Link></p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────────────────────────────────────────
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep]   = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp]     = useState('');
  const [pwd, setPwd]     = useState('');
  const [loading, setL]   = useState(false);

  const sendOTP = async () => {
    if (!email) { toast.error('Enter email'); return; }
    setL(true);
    try { const {data}=await authAPI.forgotPassword({email}); toast.success(data.message); if(data.devOtp) toast(`Dev OTP: ${data.devOtp}`,{icon:'📱',duration:15000}); setStep(2); }
    catch (e) { toast.error(e.response?.data?.error||'Error'); }
    finally { setL(false); }
  };

  const reset = async () => {
    setL(true);
    try { await authAPI.resetPassword({email,otp,newPassword:pwd}); toast.success('Password reset!'); navigate('/login'); }
    catch (e) { toast.error(e.response?.data?.error||'Invalid OTP'); }
    finally { setL(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'linear-gradient(135deg,#0d2d44,#1a5276)'}}>
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
        <div className="text-center mb-5"><div className="text-3xl mb-2">🔑</div><h2 className="text-xl font-bold text-gray-800">Reset Password</h2></div>
        {step===1?(
          <>
            <label className="label">Registered Email</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} className="input mb-4" placeholder="email@example.com"/>
            <button onClick={sendOTP} disabled={loading} className="btn-primary w-full">{loading?'Sending...':'Send OTP'}</button>
          </>
        ):(
          <>
            <label className="label">OTP</label>
            <input value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/,'').slice(0,6))} className="input text-center tracking-widest font-bold text-lg mb-3" placeholder="••••••"/>
            <label className="label">New Password</label>
            <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} className="input mb-4" placeholder="Min 8 chars"/>
            <button onClick={reset} disabled={loading} className="btn-primary w-full">{loading?'Resetting...':'Reset Password'}</button>
          </>
        )}
        <p className="text-center mt-4 text-sm"><Link to="/login" className="text-sbi-600 hover:underline">← Back to Login</Link></p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setL] = useState(true);

  useEffect(() => { accountAPI.dashboard().then(r=>setData(r.data)).catch(()=>{}).finally(()=>setL(false)); }, []);

  if (loading) return <PageLoader/>;
  const account = data?.account || {};
  const txs     = data?.recentTransactions || [];
  const summary = data?.summary || {};

  const spendMap = {};
  txs.filter(t=>t.perspective==='debit').forEach(t=>{ const c=t.category||'other'; spendMap[c]=(spendMap[c]||0)+t.amount; });
  const spendData = Object.entries(spendMap).map(([cat,amt])=>({ name:CAT[cat]?.label||cat, value:amt, fill:CAT[cat]?.color||'#6b7280' })).sort((a,b)=>b.value-a.value).slice(0,6);
  const totalSpent = Object.values(spendMap).reduce((s,n)=>s+n,0);

  return (
    <div className="space-y-5 page">
      <AccountCard account={account} onTransfer={()=>navigate('/transfer')} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[['📤',fmtC(summary.monthlyDebit||0),'Month Spent','text-red-600'],['📥',fmtC(summary.monthlyCredit||0),'Month Received','text-green-600'],['⭐',account.creditScore||'—','Credit Score','text-amber-600'],['🪙',fmt(account.roundUpBalance||0),'Round-Up Saved','text-sbi-600']].map(([ic,v,l,cl])=>(
          <div key={l} className="card p-4"><div className="text-2xl mb-2">{ic}</div><p className={`text-xl font-bold ${cl}`}>{v}</p><p className="text-xs text-gray-500 mt-1">{l}</p></div>
        ))}
      </div>
      {spendData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 text-sm mb-4">Spend Breakdown</h3>
            <div className="space-y-2">
              {spendData.map((s,i)=>(
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-gray-600">{s.name}</span><span className="font-medium">{fmtC(s.value)}</span></div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-1.5 rounded-full" style={{width:`${Math.round((s.value/(spendData[0]?.value||1))*100)}%`,background:s.fill}}/></div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between text-sm"><span className="text-gray-500">Total Spent</span><span className="font-bold">{fmt(totalSpent)}</span></div>
          </div>
          <div className="card p-5 flex flex-col">
            <h3 className="font-semibold text-gray-800 text-sm mb-4">Summary</h3>
            <div className="space-y-3">
              {[['💰 Money In',fmt(summary.monthlyCredit||0),'bg-green-50','text-green-700'],['💸 Money Out',fmt(summary.monthlyDebit||0),'bg-red-50','text-red-700'],['📊 Net Flow',fmt((summary.monthlyCredit||0)-(summary.monthlyDebit||0)),((summary.monthlyCredit||0)-(summary.monthlyDebit||0))>=0?'bg-green-50':'bg-red-50',((summary.monthlyCredit||0)-(summary.monthlyDebit||0))>=0?'text-green-700':'text-red-700']].map(([l,v,bg,tc])=>(
                <div key={l} className={`flex justify-between items-center p-3 ${bg} rounded-xl`}><span className="text-sm font-medium text-gray-700">{l}</span><span className={`font-bold ${tc}`}>{v}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}
      {totalSpent > 30000 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <span className="text-2xl">💡</span>
          <div><p className="font-semibold text-amber-800 text-sm">Financial Nudge</p><p className="text-amber-700 text-sm mt-0.5">You've spent {fmtC(totalSpent)} this period. Review discretionary spending to improve savings.</p></div>
        </div>
      )}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50"><h3 className="font-semibold text-gray-800 text-sm">Recent Transactions</h3><button onClick={()=>navigate('/history')} className="text-xs text-sbi-600 hover:underline">View All →</button></div>
        {txs.length===0?<EmptyState icon="💳" title="No transactions yet"/>:<div className="divide-y divide-gray-50">{txs.slice(0,8).map(tx=><TxRow key={tx._id} tx={tx} accountNumber={account.accountNumber}/>)}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFER PAGE (2-step: form → OTP → success)
// ─────────────────────────────────────────────────────────────────────────────
export function TransferPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuthStore();
  const [step, setStep]     = useState(1);
  const [benes, setBenes]   = useState([]);
  const [form, setForm]     = useState({ toAccountNumber:'', amount:'', description:'', mode:'IMPS', category:'other', remarks:'' });
  const [otp, setOtp]       = useState('');
  const [loading, setL]     = useState(false);
  const [result, setResult] = useState(null);
  const [otpSecs, setSecs]  = useState(300);
  const [idempKey]          = useState(() => uuidv4());
  const timerRef = useRef(null);
  const otpRefs  = useRef([]);

  useEffect(() => { beneAPI.list().then(r=>setBenes(r.data)).catch(()=>{}); }, []);
  useEffect(() => () => clearInterval(timerRef.current), []);

  const charges  = calcCharges(parseFloat(form.amount)||0, form.mode);
  const total    = (parseFloat(form.amount)||0) + charges;
  const userBal  = user?.balance || 0;

  const startTimer = () => {
    setSecs(300); clearInterval(timerRef.current);
    timerRef.current = setInterval(()=>setSecs(s=>{ if(s<=1){ clearInterval(timerRef.current); return 0; } return s-1; }), 1000);
  };

  const sendOTP = async () => {
    if (!form.toAccountNumber.trim()) { toast.error('Enter recipient account'); return; }
    const amt = parseFloat(form.amount);
    if (!amt||amt<1) { toast.error('Enter valid amount'); return; }
    if (amt > userBal) { toast.error('Insufficient balance'); return; }
    if (form.mode==='RTGS'&&amt<200000) { toast.error('RTGS minimum ₹2,00,000'); return; }
    setL(true);
    try {
      const res = await txAPI.sendOTP();
      toast.success(res.data.message);
      if (res.data.devOtp) toast(`Dev OTP: ${res.data.devOtp}`, { icon:'📱', duration:15000 });
      setStep(2); startTimer();
    } catch (e) { toast.error(e.response?.data?.error||'Failed to send OTP'); }
    finally { setL(false); }
  };

  const confirmTransfer = async () => {
    if (otp.length!==6) { toast.error('Enter 6-digit OTP'); return; }
    setL(true);
    try {
      const res = await txAPI.transfer({ toAccountNumber:form.toAccountNumber, amount:parseFloat(form.amount), otp, idempotencyKey:idempKey, transferMode:form.mode, description:form.description, category:form.category, remarks:form.remarks });
      clearInterval(timerRef.current);
      setResult(res.data.transaction);
      await refreshUser();
      setStep(3);
    } catch (e) {
      const err = e.response?.data;
      toast.error(err?.error || 'Transfer failed');
      if (err?.fallback) toast('OTP service down — retry in 30s', { icon:'⚠️' });
    } finally { setL(false); }
  };

  const Steps = () => (
    <div className="flex items-center gap-2 mb-6">
      {['Details','OTP','Done'].map((s,i)=>(
        <React.Fragment key={s}>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step>i+1?'bg-green-100 text-green-700':step===i+1?'bg-sbi-600 text-white':'bg-gray-100 text-gray-400'}`}>{step>i+1?'✓':i+1}</div>
            <span className={`text-xs font-medium hidden sm:block ${step===i+1?'text-sbi-600':'text-gray-400'}`}>{s}</span>
          </div>
          {i<2&&<div className={`flex-1 h-0.5 ${step>i+1?'bg-sbi-600':'bg-gray-200'}`}/>}
        </React.Fragment>
      ))}
    </div>
  );

  if (step===3&&result) return (
    <div className="max-w-md mx-auto page">
      <Steps/>
      <div className="card p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">✅</div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">Transfer Successful!</h2>
        <p className="text-gray-400 text-sm mb-6">Your money has been transferred.</p>
        <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-6 text-sm">
          {[['Amount',fmt(result.amount)],['Charges',fmt(result.charges||0)],['Balance After',fmt(result.balanceAfter)],['Reference',result.referenceNumber?.slice(0,20)+'...'],['Time',result.timestamp?fmtDT(result.timestamp):'—'],result.riskScore?['Risk Score',`${result.riskScore}/100`]:null].filter(Boolean).map(([k,v])=>(
            <div key={k} className="flex justify-between"><span className="text-gray-500">{k}</span><span className="font-semibold">{v}</span></div>
          ))}
        </div>
        {result.fraudWarning&&<p className="text-xs text-amber-600 bg-amber-50 rounded-xl p-2 mb-4">⚠️ {result.fraudWarning}</p>}
        <div className="flex gap-3"><button onClick={()=>{setStep(1);setOtp('');setResult(null);setForm(f=>({...f,toAccountNumber:'',amount:'',description:'',remarks:''}));}} className="btn-primary flex-1">New Transfer</button><button onClick={()=>navigate('/history')} className="btn-outline flex-1">View History</button></div>
      </div>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto page">
      <Steps/>
      {step===1&&(
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Transfer Money</h3>
            <span className="text-xs bg-sbi-50 text-sbi-600 px-3 py-1 rounded-full font-medium">Balance: {fmt(userBal)}</span>
          </div>
          {benes.length>0&&(
            <div>
              <label className="label">Quick Select</label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {benes.map(b=>(
                  <button key={b._id} onClick={()=>setForm(f=>({...f,toAccountNumber:b.accountNumber}))}
                    className={`flex-shrink-0 flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all min-w-[62px] ${form.toAccountNumber===b.accountNumber?'border-sbi-600 bg-sbi-50':'border-gray-200 hover:border-sbi-200'}`}>
                    <div className="w-8 h-8 rounded-full bg-sbi-600 text-white font-bold text-sm flex items-center justify-center">{b.name[0]}</div>
                    <span className="text-xs text-gray-600">{b.nickname||b.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div><label className="label">Recipient Account *</label><input value={form.toAccountNumber} onChange={e=>setForm(f=>({...f,toAccountNumber:e.target.value}))} className="input font-mono" placeholder="Account number"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Amount (₹) *</label><input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} className="input" placeholder="0.00" min="1"/></div>
            <div><label className="label">Mode</label><select value={form.mode} onChange={e=>setForm(f=>({...f,mode:e.target.value}))} className="input"><option value="IMPS">IMPS (Instant)</option><option value="NEFT">NEFT</option><option value="RTGS">RTGS (Min ₹2L)</option><option value="UPI">UPI (Free)</option></select></div>
          </div>
          <div><label className="label">Category</label>
            <div className="flex flex-wrap gap-1.5">{Object.entries(CAT).map(([k,v])=>(
              <button key={k} onClick={()=>setForm(f=>({...f,category:k}))} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${form.category===k?'bg-sbi-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{v.icon} {v.label}</button>
            ))}</div>
          </div>
          <div><label className="label">Description</label><input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} className="input" placeholder="What's this for?"/></div>
          {form.amount&&parseFloat(form.amount)>0&&(
            <div className="bg-sbi-50 rounded-xl p-4 text-sm space-y-1.5 border border-sbi-100">
              <div className="flex justify-between"><span className="text-gray-500">Transfer</span><span className="font-semibold">{fmt(parseFloat(form.amount))}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Charges ({form.mode})</span><span>{charges>0?fmt(charges):<span className="text-green-600 font-medium">FREE</span>}</span></div>
              <div className="flex justify-between font-bold text-sbi-700 border-t pt-1.5"><span>Total</span><span>{fmt(total)}</span></div>
              {total>userBal&&<p className="text-red-600 text-xs">⚠️ Insufficient — need {fmt(total-userBal)} more</p>}
            </div>
          )}
          <button onClick={sendOTP} disabled={loading||!form.toAccountNumber||!form.amount||total>userBal} className="btn-primary w-full py-3">{loading?<><span className="animate-spin">⟳</span> Sending OTP...</>:'📱 Continue → Send OTP'}</button>
        </div>
      )}
      {step===2&&(
        <div className="card p-8 text-center page">
          <div className="text-4xl mb-3">📱</div>
          <h3 className="font-bold text-gray-800 text-lg mb-1">OTP Verification</h3>
          <p className="text-gray-400 text-sm mb-1">Sent to +91 ****{user?.phone?.slice(-4)}</p>
          <p className="text-xs text-sbi-600 mb-5 font-medium">(Check backend terminal for OTP)</p>
          <div className="flex gap-2 justify-center mb-5">
            {[0,1,2,3,4,5].map(i=>(
              <input key={i} ref={el=>otpRefs.current[i]=el} maxLength={1} value={otp[i]||''}
                onChange={e=>{ const v=e.target.value.replace(/\D/,''); const arr=(otp+'      ').split(''); arr[i]=v; setOtp(arr.slice(0,6).join('').trimEnd()); if(v&&i<5) otpRefs.current[i+1]?.focus(); }}
                onKeyDown={e=>{ if(e.key==='Backspace'&&!otp[i]&&i>0) otpRefs.current[i-1]?.focus(); }}
                className="w-11 h-14 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-sbi-600 bg-white"
              />
            ))}
          </div>
          <p className="text-sm text-gray-400 mb-5">{otpSecs>0?<>Resend in <strong className="text-sbi-600">{Math.floor(otpSecs/60)}:{String(otpSecs%60).padStart(2,'0')}</strong></>:<button onClick={async()=>{ const r=await txAPI.sendOTP(); if(r.data.devOtp) toast(`Dev OTP: ${r.data.devOtp}`,{duration:15000,icon:'📱'}); startTimer(); }} className="text-sbi-600 font-semibold hover:underline">Resend OTP</button>}</p>
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-left mb-5 space-y-1">
            {[['To',mask(form.toAccountNumber)],['Amount',fmt(parseFloat(form.amount))],['Mode',form.mode],['Category',form.category]].map(([k,v])=>(
              <div key={k} className="flex justify-between"><span className="text-gray-500">{k}</span><span className="font-medium">{v}</span></div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={()=>{ setStep(1); clearInterval(timerRef.current); }} className="btn-outline flex-1">← Back</button>
            <button onClick={confirmTransfer} disabled={otp.length!==6||loading} className="btn-primary flex-1">{loading?<><span className="animate-spin">⟳</span> Processing...</>:'✅ Confirm'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function HistoryPage() {
  const { user } = useAuthStore();
  const [txs, setTxs]    = useState([]);
  const [loading, setL]  = useState(true);
  const [pag, setPag]    = useState({ page:1, pages:1, total:0 });
  const [page, setPage]  = useState(1);
  const [filters, setF]  = useState({ type:'', category:'', search:'', startDate:'', endDate:'' });

  const load = useCallback(async () => {
    setL(true);
    try {
      const params = { page, limit:20 };
      if (filters.type)      params.type      = filters.type;
      if (filters.category)  params.category  = filters.category;
      if (filters.search)    params.search    = filters.search;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate)   params.endDate   = filters.endDate;
      const { data } = await txAPI.history(params);
      setTxs(data.transactions); setPag(data.pagination);
    } catch {} finally { setL(false); }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const totalC = txs.filter(t=>t.perspective==='credit').reduce((s,t)=>s+t.amount,0);
  const totalD = txs.filter(t=>t.perspective==='debit').reduce((s,t)=>s+t.amount,0);

  return (
    <div className="space-y-4 page">
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <input value={filters.search} onChange={e=>setF(f=>({...f,search:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&load()} className="input flex-1 min-w-[180px]" placeholder="🔍 Search..."/>
        <select value={filters.type} onChange={e=>{ setF(f=>({...f,type:e.target.value})); setPage(1); }} className="input w-32"><option value="">All Types</option><option value="credit">Credits</option><option value="debit">Debits</option></select>
        <select value={filters.category} onChange={e=>{ setF(f=>({...f,category:e.target.value})); setPage(1); }} className="input w-36"><option value="">All Categories</option>{Object.entries(CAT).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}</select>
        <input type="date" value={filters.startDate} onChange={e=>setF(f=>({...f,startDate:e.target.value}))} className="input w-36"/>
        <input type="date" value={filters.endDate}   onChange={e=>setF(f=>({...f,endDate:e.target.value}))}   className="input w-36"/>
        <button onClick={()=>{ setF({type:'',category:'',search:'',startDate:'',endDate:''}); setPage(1); }} className="btn-outline text-xs px-3 py-2">Clear</button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center"><p className="text-xs text-green-600 font-semibold mb-1">Credits</p><p className="text-lg font-bold text-green-700">{fmt(totalC)}</p></div>
        <div className="card p-4 text-center"><p className="text-xs text-red-600 font-semibold mb-1">Debits</p><p className="text-lg font-bold text-red-700">{fmt(totalD)}</p></div>
        <div className="card p-4 text-center"><p className="text-xs text-sbi-600 font-semibold mb-1">Records</p><p className="text-lg font-bold text-sbi-600">{pag.total}</p></div>
      </div>
      <div className="card">
        {loading?<PageLoader/>:txs.length===0?<EmptyState icon="📭" title="No transactions" subtitle="Try adjusting your filters"/>:<div className="divide-y divide-gray-50">{txs.map(tx=><TxRow key={tx._id} tx={tx} accountNumber={user?.accountNumber}/>)}</div>}
        {pag.pages>1&&(
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
            <span className="text-xs text-gray-400">Page {pag.page} of {pag.pages}</span>
            <div className="flex gap-2">
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1} className="btn-outline text-xs px-3 py-1.5 disabled:opacity-40">← Prev</button>
              <button onClick={()=>setPage(p=>Math.min(pag.pages,p+1))} disabled={page>=pag.pages} className="btn-outline text-xs px-3 py-1.5 disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BENEFICIARIES
// ─────────────────────────────────────────────────────────────────────────────
export function BeneficiariesPage() {
  const navigate = useNavigate();
  const [list, setList]     = useState([]);
  const [loading, setL]     = useState(true);
  const [showForm, setForm] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const load = () => beneAPI.list().then(r=>setList(r.data)).catch(()=>{}).finally(()=>setL(false));
  useEffect(() => { load(); }, []);

  const onAdd = async (data) => {
    try { await beneAPI.add(data); toast.success('Added!'); reset(); setForm(false); load(); }
    catch (e) { toast.error(e.response?.data?.error||'Failed'); }
  };

  return (
    <div className="space-y-4 page">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{list.length} saved</span>
        <button onClick={()=>setForm(!showForm)} className="btn-primary">{showForm?'Cancel':'+ Add Beneficiary'}</button>
      </div>
      {showForm&&(
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Add Beneficiary</h3>
          <form onSubmit={handleSubmit(onAdd)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[['Name *','name','Full name',true],['Account No. *','accountNumber','Account number',true],['IFSC Code *','ifscCode','GKCB0000001',true],['Bank Name','bankName','GKC',false],['Nickname','nickname','Mom, Friend...',false]].map(([l,n,ph,req])=>(
                <div key={n}><label className="label">{l}</label><input {...register(n,req?{required:'Required'}:{})} className="input" placeholder={ph}/></div>
              ))}
            </div>
            <div className="flex gap-2"><button type="submit" className="btn-primary">Add</button><button type="button" onClick={()=>{setForm(false);reset();}} className="btn-outline">Cancel</button></div>
          </form>
        </div>
      )}
      {loading?<PageLoader/>:list.length===0?<EmptyState icon="👥" title="No beneficiaries" subtitle="Add someone to send money quickly"/>:(
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(b=>(
            <div key={b._id} className="card p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-sbi-600 text-white font-bold text-lg flex items-center justify-center">{b.name[0]}</div>
                  <div><p className="font-semibold text-gray-800">{b.name}</p><p className="text-xs text-gray-400">{b.nickname&&<span className="text-sbi-600 mr-1">({b.nickname})</span>}{b.bankName}</p></div>
                </div>
                <button onClick={async()=>{ try{ await beneAPI.remove(b._id); toast.success('Removed'); load(); }catch{ toast.error('Failed'); } }} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-lg">✕</button>
              </div>
              <div className="text-xs text-gray-500 space-y-1 mb-3">
                <div className="flex justify-between"><span>Account</span><span className="font-mono font-medium text-gray-700">{mask(b.accountNumber)}</span></div>
                <div className="flex justify-between"><span>IFSC</span><span className="font-mono text-gray-700">{b.ifscCode}</span></div>
              </div>
              <button onClick={()=>navigate('/transfer',{state:{toAccountNumber:b.accountNumber}})} className="btn-primary w-full text-xs py-2">↗ Transfer</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function ProfilePage() {
  const { user, updateUser, logout } = useAuthStore();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [pwd, setPwd]         = useState({ current:'', new:'', confirm:'' });
  const [saving, setSaving]   = useState(false);
  const { register, handleSubmit } = useForm({ defaultValues:{ firstName:user?.firstName, lastName:user?.lastName, 'address.city':user?.address?.city, 'address.pincode':user?.address?.pincode } });

  const onSave = async (data) => {
    try { const res=await profileAPI.update({ firstName:data.firstName, lastName:data.lastName, address:{ city:data['address.city'], pincode:data['address.pincode'] } }); updateUser(res.data); toast.success('Updated!'); setEditing(false); }
    catch { toast.error('Failed'); }
  };

  const changePwd = async () => {
    if (!pwd.current||!pwd.new) { toast.error('Fill all fields'); return; }
    if (pwd.new!==pwd.confirm) { toast.error('Passwords do not match'); return; }
    if (pwd.new.length<8)      { toast.error('Min 8 characters'); return; }
    setSaving(true);
    try { await profileAPI.changePassword({ currentPassword:pwd.current, newPassword:pwd.new }); toast.success('Password changed. Please login again.'); await logout(); navigate('/login'); }
    catch (e) { toast.error(e.response?.data?.error||'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5 page max-w-3xl">
      <div className="rounded-2xl p-6 text-white" style={{background:'linear-gradient(135deg,#0d2d44,#1a5276)'}}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-yellow-400 text-gray-900 font-black text-2xl flex items-center justify-center">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
          <div><h2 className="text-xl font-bold">{user?.firstName} {user?.lastName}</h2><p className="text-blue-200 text-sm">ID: {user?.customerId}</p>
            <div className="flex gap-2 mt-2">
              {user?.isKYCDone&&<Badge color="green">✓ KYC</Badge>}
              {user?.isEmailVerified&&<Badge color="blue">✓ Email</Badge>}
            </div>
          </div>
        </div>
      </div>
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 text-sm">Account Information</h3>
          <button onClick={()=>setEditing(!editing)} className="text-xs text-sbi-600 hover:underline font-medium">{editing?'Cancel':'✏️ Edit'}</button>
        </div>
        {editing?(
          <form onSubmit={handleSubmit(onSave)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[['First Name','firstName'],['Last Name','lastName']].map(([l,n])=>(
                <div key={n}><label className="label">{l}</label><input {...register(n)} className="input"/></div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[['City','address.city'],['Pincode','address.pincode']].map(([l,n])=>(
                <div key={n}><label className="label">{l}</label><input {...register(n)} className="input"/></div>
              ))}
            </div>
            <button type="submit" className="btn-primary px-5 py-2 text-sm">Save Changes</button>
          </form>
        ):(
          <div className="grid grid-cols-2 gap-3">
            {[['Account Number',mask(user?.accountNumber)],['Account Type',(user?.accountType||'savings').toUpperCase()],['IFSC Code',user?.ifscCode],['Branch',user?.branchName],['Email',user?.email],['Phone',`+91 ${user?.phone}`]].map(([k,v])=>(
              <div key={k} className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-400">{k}</p><p className="font-semibold text-gray-800 text-sm mt-0.5">{v}</p></div>
            ))}
          </div>
        )}
      </div>
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 text-sm mb-4">🔒 Change Password</h3>
        <div className="space-y-3 max-w-sm">
          {[['Current Password','current'],['New Password','new'],['Confirm New','confirm']].map(([l,k])=>(
            <div key={k}><label className="label">{l}</label><input type="password" value={pwd[k]} onChange={e=>setPwd(p=>({...p,[k]:e.target.value}))} className="input" placeholder="••••••••"/></div>
          ))}
          <button onClick={changePwd} disabled={saving} className="btn-primary px-5 py-2 text-sm">{saving?'Updating...':'Change Password'}</button>
        </div>
      </div>
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 text-sm mb-4">⚙️ Preferences</h3>
        <div className="space-y-3">
          {[['Round-Up Savings','roundUpEnabled',user?.roundUpEnabled],['Email Notifications','email',user?.notificationPrefs?.email],['SMS Alerts','sms',user?.notificationPrefs?.sms]].map(([label,field,val])=>(
            <div key={field} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <p className="text-sm font-medium text-gray-700">{label}</p>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked={!!val} onChange={async(e)=>{ try{ const upd=field==='roundUpEnabled'?{roundUpEnabled:e.target.checked}:{notificationPrefs:{...user?.notificationPrefs,[field]:e.target.checked}}; const r=await profileAPI.update(upd); updateUser(r.data); toast.success(`${label} ${e.target.checked?'enabled':'disabled'}`); }catch{ toast.error('Failed'); } }} className="sr-only peer"/>
                <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-sbi-600 peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"/>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI INSIGHTS
// ─────────────────────────────────────────────────────────────────────────────
export function AIPage() {
  const [credit, setCredit] = useState(null);
  const [carbon, setCarbon] = useState(null);
  const [loading, setL]     = useState(true);

  useEffect(() => { Promise.all([aiAPI.creditScore(),aiAPI.carbonFootprint()]).then(([c,ca])=>{ setCredit(c.data); setCarbon(ca.data); }).catch(()=>{}).finally(()=>setL(false)); }, []);

  if (loading) return <PageLoader/>;
  const score = credit?.score||0;
  const treesNeeded = Math.ceil((carbon?.carbonKg||0)/21);

  return (
    <div className="space-y-5 page">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-6">
          <h3 className="font-semibold text-gray-800 text-sm mb-5">⭐ Credit Score</h3>
          <div className="flex items-center gap-6 mb-5">
            <div className="relative w-28 h-28 flex-shrink-0">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8"/>
                <circle cx="50" cy="50" r="42" fill="none" stroke="#1a4b96" strokeWidth="8" strokeDasharray={`${(score/900)*264} 264`} strokeLinecap="round"/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-black text-sbi-600">{score}</span><span className="text-xs text-gray-400">/900</span></div>
            </div>
            <div>
              <p className={`text-2xl font-bold ${score>=750?'text-green-600':score>=650?'text-blue-600':score>=550?'text-amber-600':'text-red-600'}`}>{credit?.rating||'—'}</p>
              <p className="text-sm text-gray-500 mt-1">Based on account activity</p>
              <div className="mt-2 space-y-0.5 text-xs text-gray-500">
                <p>💰 Balance: {fmt(credit?.factors?.balance||0)}</p>
                <p>📊 Transactions: {credit?.factors?.txCount||0}</p>
                <p>📅 Age: {credit?.factors?.ageDays||0} days</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">Score Ranges</p>
            {[['750-900','Excellent','bg-green-500'],['650-749','Good','bg-blue-500'],['550-649','Fair','bg-amber-500'],['300-549','Poor','bg-red-500']].map(([r,l,c])=>(
              <div key={r} className="flex items-center gap-2 mb-1.5"><div className={`w-3 h-3 rounded-full ${c}`}/><span className="text-xs text-gray-500">{r}</span><span className="text-xs font-medium">{l}</span></div>
            ))}
          </div>
        </div>
        <div className="card p-6">
          <h3 className="font-semibold text-gray-800 text-sm mb-3">🌱 Carbon Footprint</h3>
          <div className="rounded-xl p-5 text-white mb-4" style={{background:'linear-gradient(135deg,#14532d,#16a34a)'}}>
            <div className="flex items-center justify-between">
              <div><p className="text-green-200 text-xs uppercase mb-1">Your Carbon Impact</p><p className="text-3xl font-black">{(carbon?.carbonKg||0).toFixed(1)}<span className="text-base font-normal ml-1">kg CO₂e</span></p></div>
              <div className="text-center"><span className="text-4xl">🌳</span><p className="text-green-200 text-xs mt-1">{treesNeeded} trees to offset</p></div>
            </div>
          </div>
          <div className="space-y-2">
            {[['✈️ Reduce travel','Highest CO₂ category'],['⛽ Cut fuel use','Use public transport'],['🛍️ Buy sustainably','Choose eco brands'],['⚡ Switch to renewables','Request green energy plan']].map(([a,d])=>(
              <div key={a} className="flex gap-3 p-3 bg-green-50 rounded-xl"><div><p className="text-sm font-medium text-gray-800">{a}</p><p className="text-xs text-green-600">{d}</p></div></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BNPL PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function BNPLPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setL]   = useState(true);
  const [amount, setAmt]  = useState(25000);
  const [tenure, setTen]  = useState(6);
  const [desc, setDesc]   = useState('');
  const [applying, setAp] = useState(false);

  const r   = 12/12/100;
  const emi = Math.ceil((amount*r*Math.pow(1+r,tenure))/(Math.pow(1+r,tenure)-1));
  const total = emi*tenure;

  useEffect(() => { bnplAPI.plans().then(r=>setPlans(r.data)).catch(()=>{}).finally(()=>setL(false)); }, []);

  const apply = async () => {
    if (!desc) { toast.error('Add a description'); return; }
    setAp(true);
    try { const res=await bnplAPI.convert({amount,tenure,description:desc}); toast.success(`BNPL created! EMI: ${fmt(res.data.summary.emiAmount)}/mo`); setPlans(p=>[res.data.plan,...p]); setDesc(''); }
    catch (e) { toast.error(e.response?.data?.error||'Failed'); }
    finally { setAp(false); }
  };

  return (
    <div className="space-y-5 page">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-5">EMI Calculator</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2"><span className="font-medium text-gray-700">Amount</span><span className="font-bold text-sbi-600">{fmt(amount)}</span></div>
              <input type="range" min={1000} max={500000} step={1000} value={amount} onChange={e=>setAmt(+e.target.value)} className="w-full accent-sbi-600"/>
              <div className="flex justify-between text-xs text-gray-400"><span>₹1K</span><span>₹5L</span></div>
            </div>
            <div>
              <label className="label">Tenure</label>
              <div className="flex gap-2">{[3,6,12,24].map(t=><button key={t} onClick={()=>setTen(t)} className={`flex-1 py-2 rounded-xl text-sm font-semibold ${tenure===t?'bg-sbi-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{t}m</button>)}</div>
            </div>
            <div className="rounded-xl p-4 text-white" style={{background:'linear-gradient(135deg,#0d2d44,#1a5276)'}}>
              <div className="grid grid-cols-3 gap-4 text-center">{[['EMI',fmt(emi)],['Total',fmtC(total)],['Interest',fmtC(total-amount)]].map(([l,v])=><div key={l}><p className="text-blue-200 text-xs mb-1">{l}</p><p className="text-lg font-black">{v}</p></div>)}</div>
            </div>
            <div><label className="label">Description *</label><input value={desc} onChange={e=>setDesc(e.target.value)} className="input" placeholder="e.g. iPhone purchase"/></div>
            <button onClick={apply} disabled={applying} className="btn-primary w-full">{applying?'Creating...':'Apply for BNPL Plan'}</button>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Active Plans</h3>
          {loading?<PageLoader/>:plans.length===0?<EmptyState icon="🗓️" title="No active plans"/>:(
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {plans.map(p=>(
                <div key={p._id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div><p className="font-semibold text-sm text-gray-800">{p.description||'BNPL Plan'}</p><p className="text-xs text-gray-400">Principal: {fmt(p.originalAmount)}</p></div>
                    <Badge color={p.status==='active'?'green':p.status==='completed'?'blue':'red'}>{p.status}</Badge>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mb-2"><span>EMI: <strong className="text-sbi-600">{fmt(p.emiAmount)}/mo</strong></span><span>{p.paidInstallments}/{p.tenure} paid</span></div>
                  <ProgressBar value={p.paidInstallments} max={p.tenure}/>
                  {p.nextDueDate&&<p className="text-xs text-gray-400 mt-1">Next: {fmtDate(p.nextDueDate)}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATEMENTS PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function StatementsPage() {
  const now   = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()+1);
  const [summary, setSummary] = useState(null);
  const [loading, setL]       = useState(false);
  const [downloading, setDl]  = useState(false);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const loadSummary = useCallback(async () => {
    setL(true);
    try { const {data}=await stmtAPI.summary(year,month); setSummary(data); }
    catch {} finally { setL(false); }
  }, [year, month]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const download = async () => {
    setDl(true);
    try {
      const res=await stmtAPI.download(year,month);
      const url=window.URL.createObjectURL(new Blob([res.data]));
      const a=document.createElement('a'); a.href=url; a.download=`SBI_Statement_${year}_${String(month).padStart(2,'0')}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      toast.success('Downloaded!');
    } catch { toast.error('No data for this period'); }
    finally { setDl(false); }
  };

  return (
    <div className="space-y-5 max-w-2xl page">
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 text-sm mb-4">Select Period</h3>
        <div className="flex flex-wrap gap-3 items-center">
          <select value={year} onChange={e=>setYear(+e.target.value)} className="input w-24">
            {[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex flex-wrap gap-1.5">
            {months.map((m,i)=><button key={m} onClick={()=>setMonth(i+1)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${month===i+1?'bg-sbi-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{m}</button>)}
          </div>
        </div>
      </div>
      {loading?<PageLoader/>:summary&&(
        <div className="card p-5">
          <div className="flex items-center justify-between mb-5">
            <div><h3 className="font-semibold text-gray-800">Summary — {months[month-1]} {year}</h3></div>
            <button onClick={download} disabled={downloading} className="btn-primary text-sm px-4 py-2">{downloading?'Generating...':'📄 Download PDF'}</button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-xl p-4 text-center"><p className="text-xs text-green-600 font-semibold mb-1">Credits</p><p className="text-lg font-bold text-green-700">{fmt(summary.totalCredit)}</p></div>
            <div className="bg-red-50 rounded-xl p-4 text-center"><p className="text-xs text-red-600 font-semibold mb-1">Debits</p><p className="text-lg font-bold text-red-700">{fmt(summary.totalDebit)}</p></div>
            <div className="bg-sbi-50 rounded-xl p-4 text-center"><p className="text-xs text-sbi-600 font-semibold mb-1">Transactions</p><p className="text-lg font-bold text-sbi-600">{summary.transactions}</p></div>
          </div>
        </div>
      )}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 text-sm mb-3">Quick Download</h3>
        <div className="space-y-2">
          {Array.from({length:6},(_,i)=>{ const d=new Date(); d.setMonth(d.getMonth()-i); const y=d.getFullYear(),m=d.getMonth()+1; return (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <span className="text-sm text-gray-700">{months[m-1]} {y}</span>
              <button onClick={async()=>{ try{ const r=await stmtAPI.download(y,m); const url=window.URL.createObjectURL(new Blob([r.data])); const a=document.createElement('a'); a.href=url; a.download=`SBI_Statement_${y}_${String(m).padStart(2,'0')}.pdf`; a.click(); toast.success('Downloaded!'); }catch{ toast.error('No data'); } }} className="text-xs text-sbi-600 hover:underline font-medium">📄 PDF</button>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function ScheduledPage() {
  const [list, setList]     = useState([]);
  const [loading, setL]     = useState(true);
  const [showForm, setForm] = useState(false);
  const [form, setF]        = useState({ toAccountNumber:'', amount:'', scheduledAt:'', description:'', recurring:false, recurringFrequency:'monthly' });
  const [saving, setSaving] = useState(false);

  const load = () => schedAPI.list().then(r=>setList(r.data)).catch(()=>{}).finally(()=>setL(false));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.toAccountNumber||!form.amount||!form.scheduledAt) { toast.error('Fill all required fields'); return; }
    setSaving(true);
    try { await schedAPI.create(form); toast.success('Scheduled!'); setF({toAccountNumber:'',amount:'',scheduledAt:'',description:'',recurring:false,recurringFrequency:'monthly'}); setForm(false); load(); }
    catch (e) { toast.error(e.response?.data?.error||'Failed'); }
    finally { setSaving(false); }
  };

  const cancel = async (id) => {
    if (!window.confirm('Cancel this scheduled transfer?')) return;
    try { await schedAPI.cancel(id); toast.success('Cancelled'); load(); }
    catch { toast.error('Failed'); }
  };

  const statusColors = { pending:'bg-amber-50 text-amber-700', executed:'bg-green-50 text-green-700', failed:'bg-red-50 text-red-600', cancelled:'bg-gray-100 text-gray-500' };

  return (
    <div className="space-y-4 page">
      <div className="flex items-center justify-between"><span className="text-sm text-gray-500">{list.length} scheduled</span><button onClick={()=>setForm(!showForm)} className="btn-primary">{showForm?'Cancel':'+ Schedule Transfer'}</button></div>
      {showForm&&(
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">New Scheduled Transfer</h3>
          <div className="grid grid-cols-2 gap-3">
            {[['Recipient Account','toAccountNumber','Account number','text'],['Amount (₹)','amount','0.00','number']].map(([l,k,ph,t])=>(
              <div key={k}><label className="label">{l}</label><input type={t} value={form[k]} onChange={e=>setF(f=>({...f,[k]:e.target.value}))} className="input" placeholder={ph}/></div>
            ))}
            <div><label className="label">Date & Time *</label><input type="datetime-local" value={form.scheduledAt} onChange={e=>setF(f=>({...f,scheduledAt:e.target.value}))} className="input" min={new Date().toISOString().slice(0,16)}/></div>
            <div><label className="label">Description</label><input value={form.description} onChange={e=>setF(f=>({...f,description:e.target.value}))} className="input" placeholder="Rent, EMI..."/></div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.recurring} onChange={e=>setF(f=>({...f,recurring:e.target.checked}))} className="rounded"/><span className="text-sm text-gray-700">Recurring</span></label>
            {form.recurring&&<select value={form.recurringFrequency} onChange={e=>setF(f=>({...f,recurringFrequency:e.target.value}))} className="input w-32 text-sm"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>}
          </div>
          <div className="flex gap-3 mt-4"><button onClick={save} disabled={saving} className="btn-primary">{saving?'Scheduling...':'⏰ Schedule'}</button><button onClick={()=>setForm(false)} className="btn-outline">Cancel</button></div>
        </div>
      )}
      {loading?<PageLoader/>:list.length===0?<EmptyState icon="⏰" title="No scheduled transfers"/>:(
        <div className="space-y-3">
          {list.map(s=>(
            <div key={s._id} className="card p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-sbi-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">⏰</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><p className="font-semibold text-gray-800 text-sm">{fmt(s.amount)}</p><span className="text-gray-400 text-xs">→ {mask(s.toAccountNumber)}</span>{s.recurring?.enabled&&<span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">🔄 {s.recurring.frequency}</span>}</div>
                <p className="text-xs text-gray-500 mt-0.5">{s.description||'Transfer'}</p>
                <p className="text-xs text-gray-400">📅 {fmtDT(s.scheduledAt)}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColors[s.status]||'bg-gray-100 text-gray-500'}`}>{s.status}</span>
                {s.status==='pending'&&<button onClick={()=>cancel(s._id)} className="block mt-1 text-xs text-red-500 hover:underline ml-auto">Cancel</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI AGENT PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function AgentPage() {
  const navigate = useNavigate();
  const [messages, setMsgs] = useState([{ from:'bot', text:"Hi! I'm your GK Capital AI Agent. Try: 'Check balance', 'Send 500 to Mom', 'Credit score'.", time:new Date() }]);
  const [input, setInput]   = useState('');
  const [loading, setL]     = useState(false);
  const [listening, setLis] = useState(false);
  const bottomRef = useRef(null);
  const recRef    = useRef(null);

  const SUGGESTIONS = ['Check my balance','Send 500 to Mom','Show last 5 transactions','What is my credit score','Convert 5000 to EMI','How much did I spend on food'];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  const send = async (text) => {
    const cmd = (text||input).trim();
    if (!cmd) return;
    setInput('');
    setMsgs(m=>[...m,{ from:'user', text:cmd, time:new Date() }]);
    setL(true);
    try {
      const { data } = await agentAPI.command({ text:cmd });
      const { intent, confidence, response } = data;
      let actionBtn = null;
      if (response.action==='TRANSFER_DRAFT'&&response.data?.toAccountNumber) actionBtn={ label:`✅ Send ${fmt(response.data.amount)}`, onClick:()=>navigate('/transfer') };
      if (response.action==='SHOW_HISTORY')  actionBtn={ label:'📋 View Transactions', onClick:()=>navigate('/history') };
      if (response.action==='CREDIT_SCORE')  actionBtn={ label:'⭐ View Score', onClick:()=>navigate('/ai') };
      if (response.action==='SHOW_INSIGHTS') actionBtn={ label:'📊 View Insights', onClick:()=>navigate('/insights') };
      if (response.action==='BNPL_OFFER')    actionBtn={ label:'💳 EMI Options', onClick:()=>navigate('/bnpl') };
      setMsgs(m=>[...m,{ from:'bot', text:response.message, time:new Date(), intent, confidence, action:response.action, suggestions:response.suggestions, actionBtn, data:response.data }]);
    } catch (e) {
      setMsgs(m=>[...m,{ from:'bot', text:e.response?.data?.error||'Something went wrong.', time:new Date() }]);
    } finally { setL(false); }
  };

  const startVoice = () => {
    const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
    if (!SR) { toast.error('Voice not supported. Use Chrome.'); return; }
    const rec=new SR(); rec.lang='en-IN'; rec.interimResults=false;
    rec.onstart=()=>setLis(true); rec.onend=()=>setLis(false);
    rec.onerror=()=>{ setLis(false); toast.error('Voice error'); };
    rec.onresult=e=>{ const t=e.results[0][0].transcript; setInput(t); toast.success(`Heard: "${t}"`); };
    recRef.current=rec; rec.start();
    setTimeout(()=>{ try{rec.stop();}catch{} }, 6000);
  };

  const fmt12 = d => new Date(d).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});

  return (
    <div className="flex flex-col h-[calc(100vh-112px)] max-w-2xl mx-auto page">
      <div className="card mb-3 p-4 flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl" style={{background:'linear-gradient(135deg,#1a4b96,#8b5cf6)'}}>🤖</div>
        <div><p className="font-semibold text-gray-800 text-sm">GK Capital AI Agent</p><p className="text-xs text-gray-400">Natural language • Voice commands</p></div>
        <div className="ml-auto flex items-center gap-1.5"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/><span className="text-xs text-green-600 font-medium">Active</span></div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4 px-1 pb-2">
        {messages.map((msg,i)=>(
          <div key={i} className={`flex ${msg.from==='user'?'justify-end':'justify-start'}`}>
            {msg.from==='bot'&&<div className="w-8 h-8 rounded-full bg-sbi-600 flex items-center justify-center text-white text-sm flex-shrink-0 mr-2 mt-1">🤖</div>}
            <div className={`max-w-[78%] flex flex-col gap-1 ${msg.from==='user'?'items-end':'items-start'}`}>
              <div className={`rounded-2xl px-4 py-3 text-sm ${msg.from==='user'?'bg-sbi-600 text-white rounded-tr-sm':'bg-white border border-gray-100 shadow-sm text-gray-800 rounded-tl-sm'}`}>
                {msg.intent&&msg.from==='bot'&&<div className="flex items-center gap-1.5 mb-1.5"><span className="text-xs font-semibold text-gray-400">{msg.intent}</span>{msg.confidence&&<span className="text-xs text-gray-300">({Math.round(msg.confidence*100)}%)</span>}</div>}
                {msg.text}
                {msg.data?.balance&&<div className="mt-2 bg-sbi-50 rounded-xl p-3 text-center"><p className="text-xs text-sbi-600 mb-0.5">Balance</p><p className="text-xl font-bold text-sbi-700">{fmt(msg.data.balance)}</p></div>}
              </div>
              {msg.actionBtn&&<button onClick={msg.actionBtn.onClick} className="text-xs bg-sbi-600 hover:bg-sbi-700 text-white font-semibold px-4 py-2 rounded-xl transition-all">{msg.actionBtn.label}</button>}
              {msg.suggestions?.length>0&&<div className="flex flex-wrap gap-1.5 mt-1">{msg.suggestions.map(s=><button key={s} onClick={()=>send(s)} className="text-xs bg-sbi-50 hover:bg-sbi-100 text-sbi-600 border border-sbi-100 px-3 py-1 rounded-full">{s}</button>)}</div>}
              <span className="text-xs text-gray-300 px-1">{fmt12(msg.time)}</span>
            </div>
          </div>
        ))}
        {loading&&<div className="flex justify-start"><div className="w-8 h-8 rounded-full bg-sbi-600 flex items-center justify-center text-white text-sm mr-2">🤖</div><div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3"><div className="flex gap-1.5">{[0,1,2].map(i=><div key={i} className="w-2 h-2 bg-sbi-400 rounded-full animate-bounce" style={{animationDelay:`${i*.15}s`}}/>)}</div></div></div>}
        <div ref={bottomRef}/>
      </div>
      <div className="flex gap-2 overflow-x-auto py-2 flex-shrink-0">
        {SUGGESTIONS.map(s=><button key={s} onClick={()=>send(s)} className="flex-shrink-0 text-xs bg-white border border-gray-200 hover:border-sbi-300 text-gray-600 px-3 py-1.5 rounded-full transition-all">{s}</button>)}
      </div>
      <div className="flex gap-2 pt-2 flex-shrink-0">
        <button onClick={listening?()=>recRef.current?.stop():startVoice} className={`w-11 h-11 flex items-center justify-center rounded-xl border-2 transition-all flex-shrink-0 ${listening?'border-red-400 bg-red-50 text-red-600 animate-pulse':'border-gray-200 bg-white text-gray-500 hover:border-sbi-300'}`}>🎤</button>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!loading&&send()} placeholder={listening?'Listening...':'Type or speak a command...'} className="flex-1 input" disabled={loading}/>
        <button onClick={()=>send()} disabled={!input.trim()||loading} className="btn-primary px-5 disabled:opacity-50">Send</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setL] = useState(true);
  const [period, setPer]= useState('30');

  useEffect(() => { setL(true); analyticsAPI.get({period}).then(r=>setData(r.data)).catch(()=>{}).finally(()=>setL(false)); }, [period]);

  if (loading) return <PageLoader/>;

  const catData    = (data?.categoryBreakdown||[]).map(c=>({ name:CAT[c._id]?.label||c._id, value:c.total, count:c.count, fill:CAT[c._id]?.color||'#6b7280' }));
  const monthData  = (data?.monthlyTrend||[]).map(m=>({ month:m._id, Received:Math.round(m.received), Spent:Math.round(m.spent) }));

  return (
    <div className="space-y-5 page">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-600">Period:</span>
        {[['7','7D'],['30','30D'],['90','3M'],['180','6M']].map(([v,l])=><button key={v} onClick={()=>setPer(v)} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${period===v?'bg-sbi-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 text-center"><p className="text-xs text-red-600 font-semibold mb-1">Total Spent</p><p className="text-xl font-bold text-red-700">{fmt(data?.summary?.totalSpent||0)}</p></div>
        <div className="card p-4 text-center"><p className="text-xs text-gray-500 font-semibold mb-1">Categories</p><p className="text-xl font-bold text-gray-700">{catData.length}</p></div>
      </div>
      {monthData.length>0&&(
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Monthly Cash Flow</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="month" tick={{fontSize:10}}/>
              <YAxis tick={{fontSize:10}} tickFormatter={v=>fmtC(v)}/>
              <Tooltip formatter={v=>fmt(v)}/>
              <Bar dataKey="Received" fill="#22c55e" radius={[3,3,0,0]}/>
              <Bar dataKey="Spent"    fill="#ef4444" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {catData.length>0?(
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Spend by Category</h3>
          <div className="space-y-3">
            {catData.map((c,i)=>(
              <div key={i}>
                <div className="flex justify-between text-sm mb-1.5"><span className="flex items-center gap-1.5 text-gray-600"><span>{CAT[c.name?.toLowerCase()]?.icon||'💸'}</span>{c.name}<span className="text-xs text-gray-400">({c.count})</span></span><span className="font-semibold">{fmt(c.value)}</span></div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-2 rounded-full" style={{width:`${Math.round((c.value/(catData[0]?.value||1))*100)}%`,background:c.fill}}/></div>
              </div>
            ))}
          </div>
        </div>
      ):<EmptyState icon="📊" title="No spending data" subtitle={`No transactions in last ${period} days`}/>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CASH FLOW PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function CashFlowPage() {
  const [data, setData] = useState(null);
  const [loading, setL] = useState(true);

  useEffect(() => { agentAPI.cashflow().then(r=>setData(r.data)).catch(()=>{}).finally(()=>setL(false)); }, []);

  if (loading) return <PageLoader/>;
  if (!data||data.prediction==='error') return <EmptyState icon="📉" title="Could not generate prediction" subtitle={data?.message}/>;
  if (data.prediction==='insufficient_data') return <div className="card p-8 text-center max-w-md mx-auto"><div className="text-4xl mb-3">📊</div><p className="font-semibold text-gray-700">Need More Data</p><p className="text-sm text-gray-400 mt-1">{data.message}</p></div>;

  const trendColor = data.trend==='improving'?'text-green-600':data.trend==='declining'?'text-red-600':'text-amber-600';

  return (
    <div className="space-y-5 page">
      <div className={`rounded-2xl p-5 ${data.willGoNegative?'bg-red-50 border-2 border-red-200':data.willGoBelowSafe?'bg-amber-50 border border-amber-200':'bg-green-50 border border-green-200'}`}>
        <p className={`font-bold text-base ${data.willGoNegative?'text-red-800':data.willGoBelowSafe?'text-amber-800':'text-green-800'}`}>{data.warning}</p>
        <div className="flex gap-6 mt-3 text-sm flex-wrap">
          {[['30-Day Forecast',fmt(data.projectedBalance30d)],['Lowest Point',fmt(data.lowestProjectedBalance)],['Avg Daily Spend',fmt(data.avgDailySpend)],['Trend',data.trend]].map(([l,v])=>(
            <div key={l}><p className="text-xs text-gray-500 mb-0.5">{l}</p><p className={`font-bold ${l==='Trend'?trendColor:''}`}>{v}</p></div>
          ))}
        </div>
      </div>
      {data.predictions?.length>0&&(
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">10-Day Balance Forecast (Linear Regression)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.predictions}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="day" tick={{fontSize:11}} tickFormatter={v=>`D${v}`}/>
              <YAxis tick={{fontSize:11}} tickFormatter={v=>fmtC(v)}/>
              <Tooltip formatter={v=>fmt(v)} labelFormatter={l=>`Day ${l}`}/>
              <Line type="monotone" dataKey="balance" stroke={data.willGoNegative?'#dc2626':'#1a4b96'} strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-2 flex gap-4 text-xs text-gray-500">
            <span>Confidence: <strong>{Math.round((data.confidence||.7)*100)}%</strong></span>
            {data.likelyPayday&&<span>Est. payday: <strong>~{data.likelyPayday}th</strong></span>}
            <span>Daily trend: <strong className={trendColor}>{data.slopePerDay>0?'+':''}{fmt(data.slopePerDay)}/day</strong></span>
          </div>
        </div>
      )}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 text-sm mb-3">💡 Recommendations</h3>
        <div className="space-y-2">
          {data.willGoNegative&&<div className="p-3 bg-red-50 rounded-xl text-sm text-red-700">⛔ Reduce daily spending by {fmt(Math.abs(data.slopePerDay))} per day to avoid negative balance.</div>}
          {data.avgDailySpend>2000&&<div className="p-3 bg-amber-50 rounded-xl text-sm text-amber-700">💡 Avg daily spend of {fmt(data.avgDailySpend)} is high. Review recurring subscriptions.</div>}
          {!data.willGoNegative&&!data.willGoBelowSafe&&<div className="p-3 bg-green-50 rounded-xl text-sm text-green-700">✅ Cash flow looks healthy. Consider setting up a savings plan.</div>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSIONS PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function SessionsPage() {
  const [sessions, setS]  = useState([]);
  const [loading, setL]   = useState(true);
  const [anomalies, setA] = useState([]);

  const load = () => {
    setL(true);
    Promise.all([sessionAPI.list(), analyticsAPI.geo()])
      .then(([s, a]) => { setS(s.data); setA(a.data); })
      .catch(() => {})
      .finally(() => setL(false));
  };

  useEffect(() => { load(); }, []);

  const revoke = async (id) => {
    try { await sessionAPI.revoke(id); toast.success('Session terminated'); setS(s=>s.filter(x=>x.sessionId!==id)); }
    catch { toast.error('Failed'); }
  };

  const revokeAll = async () => {
    if (!window.confirm('Logout from ALL devices?')) return;
    try { await sessionAPI.revokeAll(); toast.success('All sessions terminated'); localStorage.clear(); window.location.href='/login'; }
    catch { toast.error('Failed'); }
  };

  const osIcons = { Windows:'🪟', macOS:'🍎', Android:'🤖', iOS:'📱', Linux:'🐧', Unknown:'💻' };

  return (
    <div className="space-y-5 max-w-2xl page">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{sessions.length} active session{sessions.length!==1?'s':''}</span>
        {sessions.length>1&&<button onClick={revokeAll} className="btn-red text-xs px-3 py-2">🚪 Logout All Devices</button>}
      </div>
      {loading?<PageLoader/>:sessions.map(s=>(
        <div key={s.sessionId} className={`card p-5 ${s.isCurrent?'border-sbi-200 bg-sbi-50/30':''}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="text-3xl flex-shrink-0">{osIcons[s.deviceInfo?.os]||'💻'}</span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-800 text-sm">{s.deviceInfo?.browser} on {s.deviceInfo?.os}</p>
                  {s.isCurrent&&<Badge color="green">Current Device</Badge>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">📍 {s.location?.city||'Unknown'}, {s.location?.country||''} · {s.ipAddress}</p>
                <p className="text-xs text-gray-400">Last active: {fmtDT(s.lastActivity)}</p>
              </div>
            </div>
            {!s.isCurrent&&<button onClick={()=>revoke(s.sessionId)} className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-all flex-shrink-0">Terminate</button>}
          </div>
        </div>
      ))}
      {anomalies.length>0&&(
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-3">⚠️ Location Anomalies</h3>
          <div className="space-y-2">
            {anomalies.slice(0,5).map(a=>(
              <div key={a._id} className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-lg">🌍</span>
                <div><p className="text-xs font-semibold text-amber-800">Login from new location</p><p className="text-xs text-amber-700">{a.fromCity} → {a.toCity} · Risk: {a.riskScore}/100</p><p className="text-xs text-amber-500">{fmtDate(a.createdAt)}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KYC PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function KYCPage() {
  const [kycStatus, setKyc]   = useState(null);
  const [loading, setL]       = useState(true);
  const [uploading, setUpl]   = useState(false);
  const [docType, setDocType] = useState('aadhaar');
  const [file, setFile]       = useState(null);
  const fileRef = useRef(null);

  const load = () => kycAPI.status().then(r=>setKyc(r.data)).catch(()=>{}).finally(()=>setL(false));
  useEffect(() => { load(); }, []);

  const upload = async () => {
    if (!file) { toast.error('Select a file'); return; }
    setUpl(true);
    const fd = new FormData(); fd.append('document',file); fd.append('documentType',docType);
    try { const {data}=await kycAPI.upload(fd); toast.success(data.message); setFile(null); load(); }
    catch (e) { toast.error(e.response?.data?.error||'Upload failed'); }
    finally { setUpl(false); }
  };

  const statusBg = { incomplete:'bg-gray-100 text-gray-600', pending:'bg-amber-100 text-amber-700', verified:'bg-green-100 text-green-700', rejected:'bg-red-100 text-red-600' };
  const docIcons = { aadhaar:'🪪', pan:'💳', passport:'📘', voter_id:'🗳️', driving_license:'🚗' };

  return (
    <div className="space-y-5 max-w-xl page">
      <div className="card p-5">
        <div className="flex items-center gap-3">
          <span className="text-4xl">🛡️</span>
          <div><h3 className="font-semibold text-gray-800">KYC Verification</h3><p className="text-xs text-gray-400 mt-0.5">Required for full banking access</p></div>
          <div className="ml-auto">{kycStatus&&<span className={`text-xs font-bold px-3 py-1.5 rounded-full ${statusBg[kycStatus.kycStatus]||statusBg.incomplete}`}>{kycStatus.kycStatus?.toUpperCase()}</span>}</div>
        </div>
        {kycStatus?.kycStatus==='verified'&&<div className="mt-4 bg-green-50 rounded-xl p-3 text-sm text-green-700 font-medium">✅ KYC verified. Full banking access enabled.</div>}
        {(!kycStatus?.kycStatus||kycStatus?.kycStatus==='incomplete')&&<div className="mt-4 bg-amber-50 rounded-xl p-3 text-sm text-amber-700">⚠️ Complete KYC to unlock higher transfer limits.</div>}
      </div>
      {kycStatus?.documents?.length>0&&(
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-3">Uploaded Documents</h3>
          <div className="space-y-2">
            {kycStatus.documents.map((doc,i)=>(
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <span className="text-2xl">{docIcons[doc.type]||'📄'}</span>
                <div className="flex-1"><p className="text-sm font-medium text-gray-800 capitalize">{doc.type?.replace(/_/g,' ')}</p><p className="text-xs text-gray-400">{fmtDate(doc.uploadedAt)}</p></div>
                <Badge color={doc.status==='verified'?'green':doc.status==='rejected'?'red':'amber'}>{doc.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 text-sm mb-4">Upload Document</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Document Type</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(docIcons).map(([k,v])=>(
                <button key={k} onClick={()=>setDocType(k)} className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-medium transition-all ${docType===k?'bg-sbi-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{v} {k.replace(/_/g,' ')}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">File (JPG, PNG, PDF — max 5MB)</label>
            <div onClick={()=>fileRef.current?.click()} className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${file?'border-sbi-400 bg-sbi-50':'border-gray-200 hover:border-sbi-300 hover:bg-gray-50'}`}>
              <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={e=>setFile(e.target.files[0])}/>
              {file?<div><p className="text-sm font-semibold text-sbi-600">📎 {file.name}</p><p className="text-xs text-gray-400">{(file.size/1024).toFixed(0)} KB</p></div>:<div><p className="text-2xl mb-1">📁</p><p className="text-sm text-gray-500">Click to select</p><p className="text-xs text-gray-400">JPG, PNG, or PDF</p></div>}
            </div>
          </div>
          <button onClick={upload} disabled={!file||uploading} className="btn-primary w-full">{uploading?<><span className="animate-spin">⟳</span> Uploading...</>:'📤 Upload Document'}</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export function AdminDashboard() {
  const [tab, setTab]   = useState('overview');
  const [stats, setS]   = useState(null);
  const [loading, setL] = useState(true);

  useEffect(() => { adminAPI.dashboard().then(r=>setS(r.data)).catch(()=>toast.error('Admin data failed')).finally(()=>setL(false)); }, []);

  const TABS = [['overview','📊 Overview'],['fraud','🚨 Fraud'],['users','👥 Users'],['audit','📋 Audit'],['reversals','↩️ Reversals']];

  return (
    <div className="space-y-5 page">
      <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1.5 w-fit flex-wrap shadow-sm">
        {TABS.map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab===id?'bg-sbi-600 text-white shadow-md':'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>{label}</button>)}
      </div>
      {tab==='overview'&&<AdminOverview stats={stats} loading={loading}/>}
      {tab==='fraud'&&<AdminFraud/>}
      {tab==='users'&&<AdminUsers/>}
      {tab==='audit'&&<AdminAudit/>}
      {tab==='reversals'&&<AdminReversals/>}
    </div>
  );
}

function AdminOverview({ stats, loading }) {
  if (loading) return <PageLoader/>;
  if (!stats) return <EmptyState icon="📊" title="No data"/>;
  const { stats:s, recentTransactions:rt, fraudSummary:fs } = stats;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[['👥','Total Users',s.totalUsers,'text-sbi-600'],['✅','Active Users',s.activeUsers,'text-green-600'],['💸','Transactions',s.totalTransactions,'text-gray-700'],['🚨','Fraud Alerts',s.fraudAlerts,'text-red-600']].map(([ic,l,v,cl])=>(
          <div key={l} className="card p-4"><div className="text-2xl mb-2">{ic}</div><p className={`text-2xl font-bold ${cl}`}>{v?.toLocaleString('en-IN')}</p><p className="text-xs text-gray-500 mt-1">{l}</p></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-50"><h3 className="font-semibold text-gray-800 text-sm">Recent Transactions</h3></div>
          <div className="divide-y divide-gray-50">
            {rt?.slice(0,8).map(tx=>(
              <div key={tx._id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 bg-sbi-50 rounded-lg flex items-center justify-center text-sm">💸</div>
                <div className="flex-1 min-w-0"><p className="text-xs font-medium text-gray-700 truncate">{tx.fromUserId?.firstName} {tx.fromUserId?.lastName} → {tx.toAccountNumber}</p><p className="text-xs text-gray-400">{fmtDate(tx.createdAt)}</p></div>
                <span className="text-sm font-bold text-sbi-600">{fmt(tx.amount)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Fraud Distribution</h3>
          {fs?.topFlags?.length?(
            <div className="space-y-3">
              {fs.topFlags.map(f=>(
                <div key={f._id}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-gray-600 capitalize">{f._id?.replace(/_/g,' ')}</span><span className="font-semibold text-red-600">{f.count}</span></div>
                  <ProgressBar value={f.count} max={fs.topFlags[0]?.count||1} color="bg-red-400"/>
                </div>
              ))}
            </div>
          ):<div className="text-center text-gray-400 text-sm py-8">No fraud alerts</div>}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-red-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-red-700">{fs?.high||0}</p><p className="text-xs text-red-600">High Risk</p></div>
            <div className="bg-amber-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-amber-700">{fs?.total||0}</p><p className="text-xs text-amber-600">Total Flagged</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminFraud() {
  const [alerts, setA] = useState([]);
  const [loading, setL]= useState(true);
  const [reviewing, setR]= useState(null);
  const [note, setNote]= useState('');
  const [filter, setF] = useState({ status:'', severity:'' });

  const load = () => { setL(true); adminAPI.fraudAlerts(filter).then(r=>setA(r.data.alerts||[])).catch(()=>{}).finally(()=>setL(false)); };
  useEffect(() => { load(); }, [filter]);

  const review = async (id, status) => {
    try { await adminAPI.reviewFraud(id,{status,reviewNote:note}); toast.success(`Alert ${status}`); setR(null); setNote(''); load(); }
    catch { toast.error('Failed'); }
  };

  const sev = { high:'bg-red-100 text-red-700', medium:'bg-amber-100 text-amber-700', low:'bg-yellow-50 text-yellow-700', critical:'bg-red-200 text-red-900' };
  const sta = { open:'bg-red-50 text-red-600', reviewed:'bg-blue-50 text-blue-600', dismissed:'bg-gray-100 text-gray-500', blocked:'bg-red-200 text-red-800' };

  return (
    <div className="space-y-4">
      <div className="card p-4 flex gap-3 flex-wrap">
        <select value={filter.status} onChange={e=>setF(f=>({...f,status:e.target.value}))} className="input w-32"><option value="">All Status</option>{['open','reviewed','dismissed','blocked'].map(s=><option key={s} value={s}>{s}</option>)}</select>
        <select value={filter.severity} onChange={e=>setF(f=>({...f,severity:e.target.value}))} className="input w-32"><option value="">All Severity</option>{['low','medium','high','critical'].map(s=><option key={s} value={s}>{s}</option>)}</select>
      </div>
      {loading?<PageLoader/>:alerts.length===0?<EmptyState icon="✅" title="No fraud alerts"/>:alerts.map(a=>(
        <div key={a._id} className="card p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🚨</div>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sev[a.severity]}`}>{a.severity?.toUpperCase()}</span><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sta[a.status]}`}>{a.status}</span><span className="text-xs font-bold text-gray-700">Risk: {a.riskScore}/100</span></div>
                <p className="text-sm font-semibold text-gray-800">{a.userId?.firstName} {a.userId?.lastName} — {fmt(a.amount)}</p>
                <p className="text-xs text-gray-500">{a.userId?.accountNumber} → {a.toAccountNumber} · {fmtDate(a.createdAt)}</p>
                <div className="flex flex-wrap gap-1 mt-1">{a.flags?.map(f=><span key={f} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{f.replace(/_/g,' ')}</span>)}</div>
              </div>
            </div>
            {a.status==='open'&&<button onClick={()=>setR(a._id)} className="text-xs bg-sbi-600 text-white px-3 py-1.5 rounded-lg hover:bg-sbi-700">Review</button>}
          </div>
          {reviewing===a._id&&(
            <div className="mt-3 pt-3 border-t border-gray-100">
              <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Review note..." className="input resize-none h-14 mb-2"/>
              <div className="flex gap-2">
                {[['reviewed','bg-green-600','Mark Reviewed'],['dismissed','bg-gray-500','Dismiss'],['blocked','bg-red-600','Block']].map(([s,bg,l])=>(
                  <button key={s} onClick={()=>review(a._id,s)} className={`text-xs ${bg} hover:opacity-80 text-white px-3 py-1.5 rounded-lg`}>{l}</button>
                ))}
                <button onClick={()=>setR(null)} className="text-xs border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg">Cancel</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminUsers() {
  const [users, setU]  = useState([]);
  const [loading, setL]= useState(true);
  const [search, setS] = useState('');
  const [reasons, setR]= useState({});

  const load = (q='') => { setL(true); adminAPI.users({search:q,limit:30}).then(r=>setU(r.data.users||[])).catch(()=>{}).finally(()=>setL(false)); };
  useEffect(()=>{ load(); },[]);

  const freeze = async (uid) => {
    const reason=reasons[uid]; if(!reason){toast.error('Enter reason');return;}
    try { await adminAPI.freeze({userId:uid,reason}); toast.success('Frozen'); load(search); }
    catch { toast.error('Failed'); }
  };
  const unfreeze = async (uid) => { try { await adminAPI.unfreeze({userId:uid}); toast.success('Unfrozen'); load(search); } catch { toast.error('Failed'); } };

  return (
    <div className="space-y-4">
      <div className="card p-4 flex gap-3">
        <input value={search} onChange={e=>setS(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load(search)} placeholder="Search name, email, account..." className="input flex-1"/>
        <button onClick={()=>load(search)} className="btn-primary">Search</button>
      </div>
      {loading?<PageLoader/>:users.map(u=>(
        <div key={u._id} className={`card p-4 ${u.isFrozen?'border-red-200 bg-red-50/30':''}`}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sbi-600 text-white font-bold text-sm flex items-center justify-center">{u.firstName?.[0]}{u.lastName?.[0]}</div>
              <div>
                <div className="flex items-center gap-2 flex-wrap"><p className="font-semibold text-gray-800 text-sm">{u.firstName} {u.lastName}</p>{u.isFrozen&&<Badge color="red">🔒 FROZEN</Badge>}{u.isAdmin&&<Badge color="purple">Admin</Badge>}</div>
                <p className="text-xs text-gray-400">{u.email} · +91{u.phone}</p>
                <p className="text-xs text-gray-500 mt-0.5">Acc: {u.accountNumber} · Balance: <strong className="text-sbi-600">{fmt(u.balance)}</strong></p>
              </div>
            </div>
            <div className="flex gap-2 items-center flex-shrink-0">
              {!u.isFrozen?(
                <><input value={reasons[u._id]||''} onChange={e=>setR(r=>({...r,[u._id]:e.target.value}))} placeholder="Reason..." className="input text-xs w-28 py-1.5"/><button onClick={()=>freeze(u._id)} className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg">🔒 Freeze</button></>
              ):(
                <button onClick={()=>unfreeze(u._id)} className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg">🔓 Unfreeze</button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminAudit() {
  const [logs, setL]   = useState([]);
  const [loading, setLd]= useState(true);
  const [filter, setF] = useState({ severity:'', action:'', page:1 });
  const [total, setT]  = useState(0);

  const load = () => { setLd(true); adminAPI.auditLogs(filter).then(r=>{ setL(r.data.logs||[]); setT(r.data.total||0); }).catch(()=>{}).finally(()=>setLd(false)); };
  useEffect(()=>{ load(); },[filter]);

  const dot = { info:'bg-blue-400', warn:'bg-amber-400', error:'bg-red-500' };

  return (
    <div className="space-y-4">
      <div className="card p-4 flex gap-3 flex-wrap items-center">
        <select value={filter.severity} onChange={e=>setF(f=>({...f,severity:e.target.value,page:1}))} className="input w-28"><option value="">All</option><option value="info">Info</option><option value="warn">Warn</option><option value="error">Error</option></select>
        <select value={filter.action} onChange={e=>setF(f=>({...f,action:e.target.value,page:1}))} className="input w-44"><option value="">All Actions</option>{['LOGIN_SUCCESS','LOGIN_FAILED','TRANSFER_SUCCESS','TRANSFER_FAILED','FRAUD_FLAGGED','ACCOUNT_FROZEN'].map(a=><option key={a} value={a}>{a}</option>)}</select>
        <span className="text-xs text-gray-400 ml-auto">{total.toLocaleString()} logs</span>
      </div>
      <div className="card divide-y divide-gray-50">
        {loading?<PageLoader/>:logs.length===0?<EmptyState icon="📋" title="No logs found"/>:logs.map(log=>(
          <div key={log._id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50">
            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${dot[log.severity]||'bg-gray-300'}`}/>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-bold text-gray-700">{log.action}</span>{log.userId&&<span className="text-xs text-gray-400">{log.userId.email||log.userId}</span>}</div>
              {log.metadata&&Object.keys(log.metadata).length>0&&<p className="text-xs text-gray-400 mt-0.5 font-mono truncate">{JSON.stringify(log.metadata)}</p>}
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">{fmtDate(log.timestamp)}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-2">
        <button disabled={filter.page<=1} onClick={()=>setF(f=>({...f,page:f.page-1}))} className="btn-outline text-xs px-4 py-2 disabled:opacity-40">← Prev</button>
        <span className="text-sm text-gray-500 px-3 py-2">Page {filter.page}</span>
        <button onClick={()=>setF(f=>({...f,page:f.page+1}))} className="btn-outline text-xs px-4 py-2">Next →</button>
      </div>
    </div>
  );
}

function AdminReversals() {
  const [reversals, setR] = useState([]);
  const [loading, setL]   = useState(true);
  const [note, setNote]   = useState({});

  const load = () => { setL(true); adminAPI.reversals().then(r=>setR(r.data||[])).catch(()=>{}).finally(()=>setL(false)); };
  useEffect(()=>{ load(); },[]);

  const process = async (id, approve) => {
    try { await adminAPI.processReversal({reversalId:id,approve,adminNote:note[id]||''}); toast.success(approve?'Refund processed':'Rejected'); load(); }
    catch (e) { toast.error(e.response?.data?.error||'Failed'); }
  };

  const statusColors = { pending:'bg-amber-50 text-amber-700', approved:'bg-green-50 text-green-700', rejected:'bg-red-50 text-red-600', completed:'bg-blue-50 text-blue-700' };

  return (
    <div className="space-y-4">
      {loading?<PageLoader/>:reversals.length===0?<EmptyState icon="↩️" title="No reversal requests" subtitle="Customer refund requests appear here"/>:reversals.map(r=>(
        <div key={r._id} className="card p-5">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
            <div><div className="flex items-center gap-2 mb-1"><span className="text-sm font-bold text-gray-800">{r.requestedBy?.firstName} {r.requestedBy?.lastName}</span><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[r.status]}`}>{r.status}</span></div><p className="text-xs text-gray-500">{r.requestedBy?.email}</p></div>
            {r.originalTransactionId&&<div className="text-right"><p className="text-lg font-bold text-sbi-600">{fmt(r.originalTransactionId.amount)}</p><p className="text-xs text-gray-400">{fmtDate(r.originalTransactionId.createdAt)}</p></div>}
          </div>
          <div className="bg-gray-50 rounded-xl p-3 mb-3"><p className="text-xs font-semibold text-gray-600 mb-1">Reason:</p><p className="text-sm text-gray-700">{r.reason}</p></div>
          {r.status==='pending'&&(
            <>
              <textarea value={note[r._id]||''} onChange={e=>setNote(n=>({...n,[r._id]:e.target.value}))} placeholder="Admin note..." rows={2} className="input resize-none mb-3"/>
              <div className="flex gap-3">
                <button onClick={()=>process(r._id,true)} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 rounded-xl transition-all">✅ Approve Refund</button>
                <button onClick={()=>process(r._id,false)} className="flex-1 border-2 border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold py-2 rounded-xl transition-all">✕ Reject</button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// Insights page (simple wrapper around HistoryPage insights)
export function InsightsPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setL] = useState(true);
  const [period, setPer]= useState('30');

  useEffect(() => { setL(true); txAPI.insights({period}).then(r=>setData(r.data)).catch(()=>{}).finally(()=>setL(false)); }, [period]);

  if (loading) return <PageLoader/>;

  const catData   = (data?.categoryBreakdown||[]).map(c=>({ name:CAT[c._id]?.label||c._id, value:c.total, fill:CAT[c._id]?.color||'#6b7280' }));
  const monthData = (data?.monthlyTrend||[]).map(m=>({ month:m._id, Received:Math.round(m.received), Spent:Math.round(m.spent) }));

  return (
    <div className="space-y-5 page">
      <div className="flex items-center gap-2 flex-wrap">
        {[['7','7D'],['30','30D'],['90','3M'],['180','6M']].map(([v,l])=><button key={v} onClick={()=>setPer(v)} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${period===v?'bg-sbi-600 text-white':'bg-gray-100 text-gray-600'}`}>{l}</button>)}
      </div>
      {monthData.length>0&&(
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Monthly Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}} tickFormatter={v=>fmtC(v)}/>
              <Tooltip formatter={v=>fmt(v)}/>
              <Bar dataKey="Received" fill="#22c55e" radius={[3,3,0,0]}/><Bar dataKey="Spent" fill="#ef4444" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {catData.length>0&&(
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Category Breakdown</h3>
          <div className="space-y-3">
            {catData.map((c,i)=>(
              <div key={i}>
                <div className="flex justify-between text-sm mb-1"><span className="flex items-center gap-1.5 text-gray-600"><span>{CAT[c.name?.toLowerCase()]?.icon||'💸'}</span>{c.name}</span><span className="font-semibold">{fmt(c.value)}</span></div>
                <ProgressBar value={c.value} max={catData[0]?.value||1} color="" h="h-2"/>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden -mt-2"><div className="h-2 rounded-full" style={{width:`${Math.round((c.value/(catData[0]?.value||1))*100)}%`,background:c.fill}}/></div>
              </div>
            ))}
          </div>
        </div>
      )}
      {catData.length===0&&<EmptyState icon="📊" title="No spending data" subtitle={`No transactions in last ${period} days`}/>}
    </div>
  );
}
