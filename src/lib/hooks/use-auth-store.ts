import { create } from 'zustand';
import type { User } from '@/types';

interface AuthState {
  address: string | null;
  token: string | null;
  user: User | null;
  isConnected: boolean;
  setAuth: (address: string, token: string, user: User) => void;
  setAddress: (address: string) => void;
  logout: () => void;
  rehydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  address: null,
  token: null,
  user: null,
  isConnected: false,

  setAuth: (address, token, user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hiresettle_token', token);
      localStorage.setItem('hiresettle_address', address);
      document.cookie = `hiresettle_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
    }
    set({ address, token, user, isConnected: true });
  },

  setAddress: (address) => set({ address, isConnected: true }),

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hiresettle_token');
      localStorage.removeItem('hiresettle_address');
      document.cookie = 'hiresettle_token=; path=/; max-age=0';
    }
    set({ address: null, token: null, user: null, isConnected: false });
  },

  rehydrate: () => {
    if (typeof window !== 'undefined') {
      const token   = localStorage.getItem('hiresettle_token');
      const address = localStorage.getItem('hiresettle_address');
      if (token && address) set({ token, address, isConnected: true });
    }
  },
}));
