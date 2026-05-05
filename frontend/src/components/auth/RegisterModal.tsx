import React, { useState } from 'react';
import { useAuth } from '../../hooks';
import { EMAIL_MAX_LENGTH } from '../../utils/userValidation';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

const RegisterModal: React.FC<RegisterModalProps> = ({ 
  isOpen, 
  onClose, 
  onSwitchToLogin
}) => {
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    organization: '',
    dateOfEnrollment: new Date().toISOString().split('T')[0],
    contactNumber: '',
    address: ''
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
      await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        organization: formData.organization || undefined,
        dateOfEnrollment: formData.dateOfEnrollment || undefined,
        contactNumber: formData.contactNumber || undefined,
        address: formData.address || undefined
      });
      onClose();
    } catch (err) {
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-8 w-full max-w-md border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-text-primary">Sign Up</h2>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-text-primary text-sm font-medium mb-2">
                Organization
              </label>
              <input
                type="text"
                value={formData.organization}
                onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                className="w-full px-3 py-2 bg-secondary text-text-primary rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
                placeholder="Organization name"
              />
            </div>

            <div>
              <label className="block text-text-primary text-sm font-medium mb-2">
                Date of Enrollment
              </label>
              <input
                type="date"
                value={formData.dateOfEnrollment}
                onChange={(e) => setFormData({ ...formData, dateOfEnrollment: e.target.value })}
                className="w-full px-3 py-2 bg-secondary text-text-primary rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-text-primary text-sm font-medium mb-2">
                Contact Number
              </label>
              <input
                type="tel"
                value={formData.contactNumber}
                onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                className="w-full px-3 py-2 bg-secondary text-text-primary rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
                placeholder="Phone number"
              />
            </div>

            <div>
              <label className="block text-text-primary text-sm font-medium mb-2">
                Address/Location
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 bg-secondary text-text-primary rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
                placeholder="Full address or location"
              />
            </div>
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
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center">
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
        </div>
      </div>
    </div>
  );
};

export default RegisterModal;
