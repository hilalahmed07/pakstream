import React, { useEffect, useState } from 'react';

interface LikeUser {
  _id: string;
  username: string;
  email: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
}

interface LikesModalProps {
  isOpen: boolean;
  title: string;
  totalLikes: number;
  likedBy: LikeUser[];
  contentType: 'video' | 'presentation' | 'document';
  onClose: () => void;
}

const LikesModal: React.FC<LikesModalProps> = ({
  isOpen,
  title,
  totalLikes,
  likedBy,
  contentType,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredLikes = likedBy.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDisplayName = (user: LikeUser) => {
    if (user.profile?.firstName || user.profile?.lastName) {
      return `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim();
    }
    return user.username;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div
        className="w-full max-w-md rounded-lg shadow-xl border"
        style={{
          backgroundColor: 'var(--color-card)',
          color: 'var(--color-text)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                {title}
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                {totalLikes} {totalLikes === 1 ? 'like' : 'likes'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-2xl leading-none font-semibold"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <input
            type="text"
            placeholder="Search by username or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 rounded border focus:outline-none focus:ring-2 focus:ring-red-500"
            style={{
              backgroundColor: 'var(--color-card)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)'
            }}
          />
        </div>

        {/* Likes List */}
        <div className="max-h-96 overflow-y-auto" style={{ backgroundColor: 'var(--color-card)' }}>
          {filteredLikes.length > 0 ? (
            <ul className="divide-y divide-gray-700">
              {filteredLikes.map((user) => (
                <li key={user._id} className="p-4" style={{ cursor: 'default' }}>

                  <div className="flex items-center space-x-3">
                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-semibold"
                      style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                    >
                      {user.username.charAt(0).toUpperCase()}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" style={{ color: 'var(--color-text)' }}>
                        {getDisplayName(user)}
                      </p>
                      <p className="text-sm truncate" style={{ color: 'var(--color-text-secondary)' }}>
                        {user.email}
                      </p>
                    </div>

                    {/* Like Icon */}
                    <div className="text-red-500 text-xl">♥</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-8 text-center">
              <p style={{ color: 'var(--color-text-secondary)' }}>
                {searchQuery
                  ? 'No likes found matching your search'
                  : 'No likes yet'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t text-right" style={{ borderColor: 'var(--color-border)' }}>
        
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LikesModal;
