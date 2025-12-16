import React, { useState } from 'react';
import { CreateUserData } from '../../types/user';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userData: CreateUserData) => Promise<void>;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<CreateUserData>({
    username: '',
    email: '',
    password: '',
    role: 'user',
    profile: {
      firstName: '',
      lastName: '',
      bio: ''
    },
    organization: '',
    dateOfEnrollment: new Date().toISOString().split('T')[0],
    contactNumber: '',
    address: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      await onSubmit(formData);
      setFormData({
        username: '',
        email: '',
        password: '',
        role: 'user',
        profile: {
          firstName: '',
          lastName: '',
          bio: ''
        },
        organization: '',
        dateOfEnrollment: new Date().toISOString().split('T')[0],
        contactNumber: '',
        address: ''
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="rounded-lg p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-secondary)' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Create New User</h2>
          <button
            onClick={onClose}
            className="text-2xl transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            ×
          </button>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                Username *
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                Password *
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                Role *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'user' | 'admin' })}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
                required
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                First Name
              </label>
              <input
                type="text"
                value={formData.profile?.firstName || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  profile: { ...formData.profile, firstName: e.target.value }
                })}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                Last Name
              </label>
              <input
                type="text"
                value={formData.profile?.lastName || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  profile: { ...formData.profile, lastName: e.target.value }
                })}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              Bio
            </label>
            <textarea
              value={formData.profile?.bio || ''}
              onChange={(e) => setFormData({
                ...formData,
                profile: { ...formData.profile, bio: e.target.value }
              })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: 'var(--color-hover)', 
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)'
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                Organization
              </label>
              <input
                type="text"
                value={formData.organization || ''}
                onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
                placeholder="Organization name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                Date of Enrollment
              </label>
              <input
                type="date"
                value={formData.dateOfEnrollment || new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, dateOfEnrollment: e.target.value })}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                Contact Number
              </label>
              <input
                type="tel"
                value={formData.contactNumber || ''}
                onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
                placeholder="Phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                Address/Location
              </label>
              <textarea
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: 'var(--color-hover)', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)'
                }}
                placeholder="Full address or location"
              />
            </div>
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
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUserModal;
