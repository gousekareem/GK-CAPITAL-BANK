import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../services/api';

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      loading: false,
      error: null,

      loginStep1: async (credentials) => {
        set({ loading: true, error: null });
        try {
          const { data } = await authAPI.login(credentials);
          set({ loading: false });
          return { ok: true, data };
        } catch (e) {
          const msg = e.response?.data?.error || 'Login failed';
          set({ error: msg, loading: false });
          return { ok: false, error: msg };
        }
      },

      loginStep2: async (payload) => {
        set({ loading: true, error: null });
        try {
          const { data } = await authAPI.verifyLoginOTP(payload);
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          set({ user: data.user, loading: false });
          return { ok: true };
        } catch (e) {
          const msg = e.response?.data?.error || 'OTP verification failed';
          set({ error: msg, loading: false });
          return { ok: false, error: msg };
        }
      },

      register: async (data) => {
        set({ loading: true, error: null });
        try {
          const res = await authAPI.register(data);
          set({ loading: false });
          return { ok: true, data: res.data };
        } catch (e) {
          const msg = e.response?.data?.error || 'Registration failed';
          set({ error: msg, loading: false });
          return { ok: false, error: msg };
        }
      },

      logout: async () => {
        try { await authAPI.logout(); } catch {}
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null });
      },

      refreshUser: async () => {
        try { const { data } = await authAPI.me(); set({ user: data }); } catch {}
      },

      updateUser: (patch) => set(s => ({ user: { ...s.user, ...patch } })),
      clearError: () => set({ error: null }),
    }),
    { name: 'gkc-auth-v3', partialize: s => ({ user: s.user }) }
  )
);

export default useAuthStore;
