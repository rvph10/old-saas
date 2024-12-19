import { create } from 'zustand';

interface ToastState {
  message: string | null;
  type: 'success' | 'error' | 'info' | 'warning' | null;
  setToast: (
    message: string,
    type: 'success' | 'error' | 'info' | 'warning',
  ) => void;
  clearToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  type: null,
  setToast: (message, type) => set({ message, type }),
  clearToast: () => set({ message: null, type: null }),
}));
