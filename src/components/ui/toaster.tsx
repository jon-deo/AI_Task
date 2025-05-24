'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToasterProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const toastStyles = {
  success: 'bg-green-500 text-white',
  error: 'bg-red-500 text-white',
  warning: 'bg-yellow-500 text-black',
  info: 'bg-blue-500 text-white',
};

export function Toaster({ toasts, onRemove }: ToasterProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col space-y-2 max-w-sm w-full">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [isVisible, setIsVisible] = useState(true);
  const Icon = toastIcons[toast.type || 'info'];

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onRemove(toast.id), 300);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300, scale: 0.3 }}
      animate={{ opacity: isVisible ? 1 : 0, x: isVisible ? 0 : 300, scale: isVisible ? 1 : 0.3 }}
      exit={{ opacity: 0, x: 300, scale: 0.3 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`
        relative flex items-start space-x-3 p-4 rounded-lg shadow-lg backdrop-blur-sm
        ${toastStyles[toast.type || 'info']}
      `}
    >
      <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        {toast.title && (
          <div className="font-semibold text-sm">{toast.title}</div>
        )}
        {toast.description && (
          <div className="text-sm opacity-90 mt-1">{toast.description}</div>
        )}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="text-sm underline mt-2 hover:no-underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        onClick={handleClose}
        className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

// Toast manager hook
let toastId = 0;
const toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

function updateToasts() {
  toastListeners.forEach(listener => listener([...toasts]));
}

export function useToast() {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>([]);

  useEffect(() => {
    toastListeners.push(setCurrentToasts);
    return () => {
      const index = toastListeners.indexOf(setCurrentToasts);
      if (index > -1) {
        toastListeners.splice(index, 1);
      }
    };
  }, []);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const newToast: Toast = {
      ...toast,
      id: (++toastId).toString(),
    };
    toasts.push(newToast);
    updateToasts();
    return newToast.id;
  };

  const removeToast = (id: string) => {
    toasts = toasts.filter(toast => toast.id !== id);
    updateToasts();
  };

  const toast = {
    success: (title: string, description?: string) =>
      addToast({ title, description, type: 'success' }),
    error: (title: string, description?: string) =>
      addToast({ title, description, type: 'error' }),
    warning: (title: string, description?: string) =>
      addToast({ title, description, type: 'warning' }),
    info: (title: string, description?: string) =>
      addToast({ title, description, type: 'info' }),
    custom: (toast: Omit<Toast, 'id'>) => addToast(toast),
  };

  return {
    toast,
    toasts: currentToasts,
    removeToast,
  };
}

// Default Toaster component that uses the hook
export function DefaultToaster() {
  const { toasts, removeToast } = useToast();
  return <Toaster toasts={toasts} onRemove={removeToast} />;
}
