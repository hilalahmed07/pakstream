import React, { useState } from 'react';
import { User } from '../../types/user';
import { PASSWORD_MESSAGE, isStrongPassword } from '../../utils/userValidation';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSubmit: (userId: string, newPassword: string) => Promise<void>;
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ isOpen, onClose, user, onSubmit }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isStrongPassword(newPassword)) {
      setError(PASSWORD_MESSAGE);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await onSubmit(user._id, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="rounded-lg p-8 w-full max-w-md" style={{ backgroundColor: 'var(--color-secondary)' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Reset Password</h2>
          <button
            onClick={onClose}
            className="text-2xl transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            ×
          </button>
        </div>

        <div className="mb-4">
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Reset password for <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{user.username}</span>
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>{user.email}</p>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              New Password *
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: 'var(--color-hover)', 
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)'
              }}
              required
              minLength={8}
              placeholder="Min 8 chars with upper/lower/number/special"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              Confirm Password *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: 'var(--color-hover)', 
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)'
              }}
              required
              minLength={8}
              placeholder="Re-enter password"
            />
          </div>

          <div className="flex justify-end space-x-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 rounded-lg transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordModal;
