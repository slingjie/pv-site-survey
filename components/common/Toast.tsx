import React, { useEffect } from 'react';
import { Check } from '../icons';

interface ToastProps {
  message: string;
  show: boolean;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, show, onClose, duration = 2000 }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  if (!show) {
    return null;
  }

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 max-w-md w-auto px-4 z-50">
       <div className="bg-black bg-opacity-75 text-white text-sm font-medium px-6 py-3 rounded-full shadow-lg flex items-center justify-center">
        <Check size={18} className="mr-2 flex-shrink-0" />
        <span>{message}</span>
      </div>
    </div>
  );
};

export default Toast;
