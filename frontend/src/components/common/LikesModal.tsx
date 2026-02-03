import React, { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

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
  const { theme } = useTheme();
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
        className={`w-full max-w-md rounded-lg shadow-xl ${
          theme === 'dark'
            ? 'bg-gray-900 border border-gray-700'
            : 'bg-white border border-gray-200'
        }`}
      >
        {/* Header */}
        <div
          className={`p-6 border-b ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <h2
                className={`text-xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                {title}
              </h2>
              <p
                className={`text-sm mt-1 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {totalLikes} {totalLikes === 1 ? 'like' : 'likes'}
              </p>
            </div>
            <button
              onClick={onClose}
              className={`text-2xl leading-none font-semibold ${
                theme === 'dark'
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              ×
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-700">
          <input
            type="text"
            placeholder="Search by username or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full px-3 py-2 rounded border ${
              theme === 'dark'
                ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:outline-none focus:ring-2 focus:ring-red-500`}
          />
        </div>

        {/* Likes List */}
        <div
          className={`max-h-96 overflow-y-auto ${
            theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
          }`}
        >
          {filteredLikes.length > 0 ? (
            <ul className="divide-y divide-gray-700">
              {filteredLikes.map((user) => (
                <li
                  key={user._id}
                  className={`p-4 ${
                    theme === 'dark'
                      ? 'hover:bg-gray-700/50'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {/* Avatar */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                        theme === 'dark' ? 'bg-red-600' : 'bg-red-500'
                      }`}
                    >
                      {user.username.charAt(0).toUpperCase()}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-medium truncate ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {getDisplayName(user)}
                      </p>
                      <p
                        className={`text-sm truncate ${
                          theme === 'dark'
                            ? 'text-gray-400'
                            : 'text-gray-600'
                        }`}
                      >
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
              <p
                className={`${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {searchQuery
                  ? 'No likes found matching your search'
                  : 'No likes yet'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`p-4 border-t ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          } text-right`}
        >
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
