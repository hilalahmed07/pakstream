import React from 'react';
import { User } from '../../types/auth';

interface UserProfileProps {
  user: User;
  onClose: () => void;
  onLogout: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, onClose, onLogout }) => {
  return (
    <div className="absolute right-0 top-12 bg-card rounded-lg shadow-xl border border-border w-64 z-50">
      <div className="p-4">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{
            backgroundColor: 'var(--color-button-bg)',
            color: 'var(--color-button-text)'
          }}>
            <span className="font-bold">
              {user.username.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="text-text-primary font-semibold">{user.username}</div>
            <div className="text-text-secondary text-sm">{user.email}</div>
            {user.role === 'admin' && (
              <div className="text-xs px-2 py-1 rounded mt-1 font-semibold" style={{
                backgroundColor: 'var(--color-button-bg)',
                color: 'var(--color-button-text)'
              }}>
                Admin
              </div>
            )}
          </div>
        </div>
        
        <div className="border-t border-border pt-4">
          <button
            onClick={onLogout}
            className="w-full text-left text-text-primary hover:bg-hover px-3 py-2 rounded transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
