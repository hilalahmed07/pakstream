import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
  /** Single-button dismiss (no Cancel); use for themed alerts instead of window.alert */
  hideCancel?: boolean;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'warning',
  hideCancel = false,
}) => {
  const { theme } = useTheme();
  const titleId = React.useId();

  if (!isOpen) return null;

  const getColors = () => {
    switch (type) {
      case 'danger':
        return {
          icon: 'text-red-500',
          iconBg: 'bg-red-500/20',
          confirmBg: 'bg-red-600 hover:bg-red-700',
          border: 'border-red-500/30',
        };
      case 'warning':
        return {
          icon: 'text-yellow-500',
          iconBg: 'bg-yellow-500/20',
          confirmBg: 'bg-yellow-600 hover:bg-yellow-700',
          border: 'border-yellow-500/30',
        };
      case 'info':
        return {
          icon: 'text-blue-500',
          iconBg: 'bg-blue-500/20',
          confirmBg: 'bg-blue-600 hover:bg-blue-700',
          border: 'border-blue-500/30',
        };
      default:
        return {
          icon: 'text-gray-500',
          iconBg: 'bg-gray-500/20',
          confirmBg: 'bg-gray-600 hover:bg-gray-700',
          border: 'border-gray-500/30',
        };
    }
  };

  const colors = getColors();
  const getIcon = () => {
    switch (type) {
      case 'danger':
        return '⚠️';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '❓';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[10000] p-4"
      onClick={hideCancel ? onConfirm : undefined}
      role="presentation"
    >
      <div
        className={`rounded-lg p-6 w-full max-w-md shadow-2xl border ${colors.border} backdrop-blur-sm`}
        style={{
          backgroundColor: theme === 'dark' ? 'var(--color-card)' : 'var(--color-card)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-start mb-4">
          <div className={`${colors.iconBg} rounded-full p-3 mr-4`}>
            <span className={`${colors.icon} text-3xl`}>{getIcon()}</span>
          </div>
          <div className="flex-1">
            <h2
              id={titleId}
              className="text-xl font-bold mb-2"
              style={{ color: 'var(--color-text)' }}
            >
              {title}
            </h2>
            <p
              className="text-sm leading-relaxed"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {message}
            </p>
          </div>
        </div>

        <div className={`flex mt-6 ${hideCancel ? 'justify-end' : 'space-x-3'}`}>
          {!hideCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: 'var(--color-secondary)',
                color: 'var(--color-text)',
              }}
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`${hideCancel ? 'min-w-[120px] px-6 py-2' : 'flex-1 px-4 py-2'} rounded-lg font-medium text-white transition-colors ${colors.confirmBg}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;

