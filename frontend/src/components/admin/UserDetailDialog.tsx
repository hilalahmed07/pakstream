import React, { useEffect, useState } from 'react';
import { User } from '../../types/user';
import userService from '../../services/userService';

interface UserDetailDialogProps {
  userId: string | null;
  open: boolean;
  onClose: () => void;
}

const UserDetailDialog: React.FC<UserDetailDialogProps> = ({ userId, open, onClose }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !userId) {
      setUser(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    userService
      .getUserById(userId)
      .then((res) => {
        if (!cancelled) {
          setUser(res.data.user);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load user');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  if (!open) return null;

  const fullName =
    user?.profile?.firstName || user?.profile?.lastName
      ? [user?.profile?.firstName, user?.profile?.lastName].filter(Boolean).join(' ')
      : null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="rounded-lg p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--color-secondary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
            User Details
          </h2>
          <button
            onClick={onClose}
            className="text-2xl transition-colors hover:opacity-80"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {loading && (
          <div className="py-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
            Loading...
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-red-900/20 text-red-400 mb-4" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && user && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Username
                </div>
                <div className="font-medium" style={{ color: 'var(--color-text)' }}>
                  {user.username}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Email
                </div>
                <div style={{ color: 'var(--color-text)' }}>{user.email}</div>
              </div>
              <div>
                <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Role
                </div>
                <div style={{ color: 'var(--color-text)' }} className="capitalize">
                  {user.role}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Status
                </div>
                <div style={{ color: 'var(--color-text)' }}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </div>
              </div>
            </div>

            {fullName && (
              <div>
                <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Full Name
                </div>
                <div style={{ color: 'var(--color-text)' }}>{fullName}</div>
              </div>
            )}

            {user.profile?.bio && (
              <div>
                <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Bio
                </div>
                <div style={{ color: 'var(--color-text)' }} className="whitespace-pre-wrap">
                  {user.profile.bio}
                </div>
              </div>
            )}

            {(user.organization || user.contactNumber || user.address) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {user.organization && (
                  <div>
                    <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      Organization
                    </div>
                    <div style={{ color: 'var(--color-text)' }}>{user.organization}</div>
                  </div>
                )}
                {user.contactNumber && (
                  <div>
                    <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      Contact Number
                    </div>
                    <div style={{ color: 'var(--color-text)' }}>{user.contactNumber}</div>
                  </div>
                )}
                {user.address && (
                  <div className="sm:col-span-2">
                    <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      Address
                    </div>
                    <div style={{ color: 'var(--color-text)' }}>{user.address}</div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
              {user.dateOfEnrollment && (
                <div>
                  <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                    Date of Enrollment
                  </div>
                  <div style={{ color: 'var(--color-text)' }}>
                    {new Date(user.dateOfEnrollment).toLocaleDateString()}
                  </div>
                </div>
              )}
              {(user as User & { lastLogin?: string }).lastLogin && (
                <div>
                  <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                    Last Login
                  </div>
                  <div style={{ color: 'var(--color-text)' }}>
                    {new Date((user as User & { lastLogin: string }).lastLogin).toLocaleString()}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Created
                </div>
                <div style={{ color: 'var(--color-text)' }}>
                  {new Date(user.createdAt).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Updated
                </div>
                <div style={{ color: 'var(--color-text)' }}>
                  {new Date(user.updatedAt).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDetailDialog;
