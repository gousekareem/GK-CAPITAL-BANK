import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import { useAutoLogout } from '../hooks/useAutoLogout';
import { fmt, mask } from '../utils/helpers';

const NAV = [
  { to:'/dashboard',     icon:'⊞',  label:'Dashboard'      },
  { to:'/transfer',      icon:'↗',  label:'Transfer'       },
  { to:'/history',       icon:'☰',  label:'Transactions'   },
  { to:'/insights',      icon:'📊', label:'Insights'       },
  { to:'/analytics',     icon:'📈', label:'Analytics'      },
  { to:'/cashflow',      icon:'🔮', label:'Cash Flow AI'   },
  { to:'/agent',         icon:'🤖', label:'AI Agent'       },
  { to:'/beneficiaries', icon:'👥', label:'Beneficiaries'  },
  { to:'/bnpl',          icon:'🗓️', label:'EMI / BNPL'     },
  { to:'/statements',    icon:'📄', label:'Statements'     },
  { to:'/scheduled',     icon:'⏰', label:'Scheduled'      },
  { to:'/kyc',           icon:'🛡️', label:'KYC'            },
  { to:'/sessions',      icon:'🔐', label:'Sessions'       },
  { to:'/ai',            icon:'⭐', label:'AI Insights'    },
  { to:'/profile',       icon:'◎',  label:'Profile'        },
  { to:'/admin',         icon:'🏛️', label:'Admin Panel'    },
];

const TITLES = {
  '/dashboard':'Dashboard','/transfer':'Transfer Money','/history':'Transaction History',
  '/insights':'Spending Insights','/analytics':'Analytics','/cashflow':'Cash Flow Predictor',
  '/agent':'AI Banking Agent','/beneficiaries':'Beneficiaries','/bnpl':'EMI & BNPL',
  '/statements':'Bank Statements','/scheduled':'Scheduled Transfers',
  '/kyc':'KYC Verification','/sessions':'Active Sessions','/ai':'AI Insights',
  '/profile':'My Profile','/admin':'Admin Dashboard',
};

export default function Layout({ children }) {
  const [col, setCol] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate  = useNavigate();
  const location  = useLocation();

  useAutoLogout(15);

  const handleLogout = async () => { await logout(); navigate('/login'); toast.success('Logged out'); };

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className={`flex flex-col flex-shrink-0 transition-all duration-300 ${col?'w-14':'w-56'}`} style={{background:'linear-gradient(180deg,#0d2d44 0%,#1a5276 100%)'}}>
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <div className="w-8 h-8 rounded-xl bg-yellow-400 flex items-center justify-center font-black text-gray-900 text-xs flex-shrink-0">GKC</div>
          {!col&&<div className="min-w-0"><p className="text-white font-bold text-sm leading-tight">GK Capital Bank</p><p className="text-blue-300 text-xs">v3.0 • AI Powered</p></div>}
          <button onClick={()=>setCol(!col)} className="ml-auto text-blue-300 hover:text-white text-sm flex-shrink-0">{col?'→':'←'}</button>
        </div>
        {!col&&user&&<div className="px-4 py-3 border-b border-white/10"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-yellow-400 text-gray-900 font-bold text-xs flex items-center justify-center flex-shrink-0">{user.firstName?.[0]}{user.lastName?.[0]}</div><div className="min-w-0"><p className="text-white text-xs font-semibold truncate">{user.firstName} {user.lastName}</p><p className="text-blue-300 text-xs truncate">{mask(user.accountNumber)}</p></div></div></div>}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV.map(item=>(
            <NavLink key={item.to} to={item.to}
              className={({isActive})=>`flex items-center gap-3 px-4 py-2.5 text-sm transition-all border-l-2 ${isActive?'bg-sbi-600 text-white border-yellow-400':'text-blue-200 hover:bg-white/10 hover:text-white border-transparent'}`}>
              <span className="text-base flex-shrink-0 w-5 text-center">{item.icon}</span>
              {!col&&<span className="font-medium truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-white/10">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-red-300 hover:bg-red-500/20 rounded-xl transition-all text-sm">
            <span className="text-base flex-shrink-0 w-5 text-center">🚪</span>
            {!col&&<span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center gap-4 flex-shrink-0 shadow-sm">
          <h1 className="font-bold text-gray-800 flex-1 text-base">{TITLES[location.pathname]||'GK Capital Bank'}</h1>
          <div className="hidden md:flex items-center gap-1.5 bg-sbi-50 px-3 py-1.5 rounded-full">
            <span className="text-xs text-gray-500">Balance</span>
            <span className="font-bold text-sbi-600 text-sm">{fmt(user?.balance||0)}</span>
          </div>
          <button onClick={()=>toast('No new notifications',{icon:'🔔'})} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100"><span className="text-lg">🔔</span></button>
          <NavLink to="/profile" className="w-8 h-8 rounded-full bg-sbi-600 text-white font-bold text-xs flex items-center justify-center">{user?.firstName?.[0]}{user?.lastName?.[0]}</NavLink>
        </header>
        <main className="flex-1 overflow-y-auto p-5 bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
