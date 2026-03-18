import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

export const useAutoLogout = (minutes = 15) => {
  const { logout } = useAuthStore();
  const navigate   = useNavigate();
  const timer  = useRef(null);
  const warn   = useRef(null);
  const warnId = useRef(null);
  const TIMEOUT = minutes * 60 * 1000;
  const WARN    = Math.max(0, TIMEOUT - 60000);

  const reset = useCallback(() => {
    clearTimeout(timer.current);
    clearTimeout(warn.current);
    if (warnId.current) { toast.dismiss(warnId.current); warnId.current = null; }
    warn.current  = setTimeout(() => { warnId.current = toast('⏰ Session expiring in 1 minute', { duration:55000, icon:'⚠️' }); }, WARN);
    timer.current = setTimeout(async () => { toast.dismiss(warnId.current); toast('🔒 Auto logged out due to inactivity'); await logout(); navigate('/login'); }, TIMEOUT);
  }, [TIMEOUT, WARN, logout, navigate]);

  useEffect(() => {
    const events = ['mousemove','mousedown','keypress','scroll','touchstart','click'];
    events.forEach(e => window.addEventListener(e, reset, { passive:true }));
    reset();
    return () => { events.forEach(e => window.removeEventListener(e, reset)); clearTimeout(timer.current); clearTimeout(warn.current); };
  }, [reset]);
};

export const useBiometrics = () => {
  const keys   = useRef([]);
  const mouse  = useRef([]);
  const lastKey= useRef(null);
  const lastPos= useRef({ x:0,y:0,t:0 });

  useEffect(() => {
    const onKey = () => { const now=Date.now(); if(lastKey.current){ const i=now-lastKey.current; if(i>0&&i<2000){ keys.current.push(i); if(keys.current.length>50) keys.current.shift(); } } lastKey.current=now; };
    const onMouse = e => { const now=Date.now(),{x:px,y:py,t:pt}=lastPos.current,dt=now-pt; if(dt>0&&dt<500){ const v=Math.sqrt((e.clientX-px)**2+(e.clientY-py)**2)/dt; if(v<10){ mouse.current.push(v); if(mouse.current.length>30) mouse.current.shift(); } } lastPos.current={x:e.clientX,y:e.clientY,t:now}; };
    document.addEventListener('keydown',onKey);
    document.addEventListener('mousemove',onMouse,{passive:true});
    return () => { document.removeEventListener('keydown',onKey); document.removeEventListener('mousemove',onMouse); };
  },[]);

  const getBiometricData = () => {
    const k=keys.current, m=mouse.current;
    return { typingSpeed: k.length>3 ? parseFloat((1000/(k.reduce((a,b)=>a+b,0)/k.length)).toFixed(2)) : 0, mouseVelocity: m.length>3 ? parseFloat((m.reduce((a,b)=>a+b,0)/m.length).toFixed(3)) : 0 };
  };

  return { getBiometricData };
};
