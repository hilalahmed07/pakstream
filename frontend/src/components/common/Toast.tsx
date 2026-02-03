import React, { useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeColors } from '../../config/themes';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

const ToastComponent: React.FC<ToastProps> = ({ toast, onClose }) => {
  const { theme } = useTheme();
  const themeColors = getThemeColors(theme);

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return 'ℹ';
    }
  };

  const getColors = () => {
    const isDark = theme === 'dark' || theme === 'pakistan' || theme === 'maritimeHorizon';
    
    // Use theme card color as base, with slight opacity
    const baseBg = isDark 
      ? themeColors.card 
      : themeColors.card;
    
    switch (toast.type) {
      case 'success':
        return {
          bg: baseBg,
          border: '#22c55e',
          text: themeColors.text,
          icon: '#4ade80',
          iconBg: 'rgba(34, 197, 94, 0.2)'
        };
      case 'error':
        return {
          bg: baseBg,
          border: '#ef4444',
          text: themeColors.text,
          icon: '#f87171',
          iconBg: 'rgba(239, 68, 68, 0.2)'
        };
      case 'warning':
        return {
          bg: baseBg,
          border: '#f59e0b',
          text: themeColors.text,
          icon: '#fbbf24',
          iconBg: 'rgba(245, 158, 11, 0.2)'
        };
      case 'info':
        return {
          bg: baseBg,
          border: '#3b82f6',
          text: themeColors.text,
          icon: '#60a5fa',
          iconBg: 'rgba(59, 130, 246, 0.2)'
        };
      default:
        return {
          bg: baseBg,
          border: themeColors.border,
          text: themeColors.text,
          icon: themeColors.textSecondary,
          iconBg: 'rgba(107, 114, 128, 0.2)'
        };
    }
  };

  const colors = getColors();

  return (
    <div
      className="border-l-4 rounded-lg shadow-2xl p-4 mb-3 min-w-[300px] max-w-[500px] animate-slide-in-right backdrop-blur-sm border"
      style={{
        backgroundColor: colors.bg,
        borderLeftColor: colors.border,
        borderColor: themeColors.border,
        borderTopColor: themeColors.border,
        borderRightColor: themeColors.border,
        borderBottomColor: themeColors.border,
      }}
    >
      <div className="flex items-start">
        <div 
          className="text-2xl font-bold mr-3 flex-shrink-0 rounded-full w-8 h-8 flex items-center justify-center"
          style={{
            color: colors.icon,
            backgroundColor: colors.iconBg,
          }}
        >
          {getIcon()}
        </div>
        <div className="flex-1">
          <p 
            className="font-medium text-sm leading-relaxed"
            style={{ color: colors.text }}
          >
            {toast.message}
          </p>
        </div>
        <button
          onClick={() => onClose(toast.id)}
          className="ml-3 flex-shrink-0 text-xl font-bold transition-opacity hover:opacity-70"
          style={{ color: colors.text }}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default ToastComponent;

