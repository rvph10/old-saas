import { toast, ToastOptions } from 'react-toastify';

const defaultOptions: ToastOptions = {
  position: 'top-right',
  autoClose: 3000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
  theme: 'light', // or 'dark' or 'colored'
};

export function showToast(message: string, type: 'success' | 'error' | 'info' | 'warning', options?: ToastOptions) {
  const toastFn = {
    success: toast.success,
    error: toast.error,
    info: toast.info,
    warning: toast.warn,
  }[type];

  return toastFn(message, { ...defaultOptions, ...options });
}


class ToastService {
  success(message: string, options?: ToastOptions) {
    return toast.success(message, { ...defaultOptions, ...options });
  }

  error(message: string, options?: ToastOptions) {
    return toast.error(message, { ...defaultOptions, ...options });
  }

  warn(message: string, options?: ToastOptions) {
    return toast.warn(message, { ...defaultOptions, ...options });
  }

  info(message: string, options?: ToastOptions) {
    return toast.info(message, { ...defaultOptions, ...options });
  }

  dismiss(toastId?: number | string) {
    toast.dismiss(toastId);
  }
}

export const toastService = new ToastService();