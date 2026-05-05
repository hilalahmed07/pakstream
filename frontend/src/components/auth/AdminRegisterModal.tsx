import React, { useState } from 'react';
import { useAuth } from '../../hooks';
import { EMAIL_MAX_LENGTH } from '../../utils/userValidation';

interface AdminRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
  onSwitchToRegister: () => void;
}

const AdminRegisterModal: React.FC<AdminRegisterModalProps> = ({ 
  isOpen, 
  onClose, 
  onSwitchToLogin, 
  onSwitchToRegister 
}) => {
  const { registerAdmin } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    adminKey: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      await registerAdmin({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        adminKey: formData.adminKey
      });
      onClose();
    } catch (err) {
      setError('Admin registration failed. Please check your admin key.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-8 w-full max-w-md border border-border shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-text-primary">Admin Sign Up</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary text-2xl transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-text-primary text-sm font-medium mb-2">
              Username
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-3 py-2 bg-secondary text-text-primary rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-text-primary text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => {
                const sanitizedEmail = e.target.value.replace(/[^a-zA-Z0-9@._-]/g, '');
                setFormData({ ...formData, email: sanitizedEmail });
              }}
              className="w-full px-3 py-2 bg-secondary text-text-primary rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
              required
              maxLength={EMAIL_MAX_LENGTH}
            />
          </div>

          <div>
            <label className="block text-text-primary text-sm font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 bg-secondary text-text-primary rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-text-primary text-sm font-medium mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full px-3 py-2 bg-secondary text-text-primary rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-text-primary text-sm font-medium mb-2">
              Admin Key
            </label>
            <input
              type="password"
              value={formData.adminKey}
              onChange={(e) => setFormData({ ...formData, adminKey: e.target.value })}
              className="w-full px-3 py-2 bg-secondary text-text-primary rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
              placeholder="Contact administrator for admin key"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 rounded-lg font-bold transition-all duration-300 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--color-button-bg)',
              color: 'var(--color-button-text)'
            }}
          >
            {loading ? 'Creating Admin Account...' : 'Create Admin Account'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="text-text-secondary">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="font-semibold hover:underline transition-colors"
              style={{ color: 'var(--color-accent)' }}
            >
              Sign in
            </button>
          </p>
          <p className="text-text-secondary">
            Regular user?{' '}
            <button
              onClick={onSwitchToRegister}
              className="font-semibold hover:underline transition-colors"
              style={{ color: 'var(--color-accent)' }}
            >
              Regular Sign Up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminRegisterModal;
