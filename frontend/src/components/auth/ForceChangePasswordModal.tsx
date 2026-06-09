import React, { useState } from 'react';
import authService from '../../services/authService';
import { isStrongPassword } from '../../utils/userValidation';

interface Props {
  onSuccess: () => void;
}

const ForceChangePasswordModal: React.FC<Props> = ({ onSuccess }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isStrongPassword(newPassword)) {
      setError('Password must be at least 12 characters and include uppercase, lowercase, number, and special character.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from the current password.');
      return;
    }

    try {
      setLoading(true);
      await authService.changePassword(currentPassword, newPassword);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-lg p-8 w-full max-w-md shadow-2xl" style={{ backgroundColor: 'var(--color-secondary)' }}>
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
            Change Password Required
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            For your security, you must set a new password before continuing. This is required on first login and after a password reset.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
              Current Password *
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
              New Password *
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={12}
              placeholder="Min 12 chars with upper/lower/number/special"
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
              Confirm New Password *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={12}
              placeholder="Re-enter new password"
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{ backgroundColor: 'var(--color-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: 'rgb(248, 113, 113)' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-lg font-medium transition-opacity"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForceChangePasswordModal;
