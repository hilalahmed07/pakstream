import React from 'react';
import { User } from '../../types/user';

interface UserTableProps {
  users: User[];
  loading: boolean;
  onEdit: (user: User) => void;
  onResetPassword: (user: User) => void;
  onToggleStatus: (userId: string) => void;
  onDelete: (userId: string) => void;
}

const UserTable: React.FC<UserTableProps> = React.memo(({
  users,
  loading,
  onEdit,
  onResetPassword,
  onToggleStatus,
  onDelete,
}) => {
  return (
    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--color-secondary)' }}>
      {loading ? (
        <div className="p-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--color-accent)' }}></div>
          Loading users...
        </div>
      ) : users.length === 0 ? (
        <div className="p-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
          No users found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--color-hover)' }}>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>User</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Organization</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Date of Enrollment</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {users.map((user) => (
                <tr key={user._id} className="transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3" style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}>
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium" style={{ color: 'var(--color-text)' }}>{user.username}</div>
                        {user.profile?.firstName && (
                          <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            {user.profile.firstName} {user.profile.lastName}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                    {user.organization || <span style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }}>-</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {user.dateOfEnrollment 
                      ? new Date(user.dateOfEnrollment).toLocaleDateString() 
                      : <span style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }}>-</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                    {user.contactNumber || <span style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }}>-</span>}
                  </td>
                  <td className="px-6 py-4 max-w-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {user.address ? (
                      <div className="truncate" title={user.address}>
                        {user.address}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }}>-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs ${
                      user.role === 'admin' 
                        ? 'bg-red-900 text-red-200' 
                        : 'bg-gray-700 text-gray-300'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs ${
                      user.isActive 
                        ? 'bg-green-900 text-green-200' 
                        : 'bg-red-900 text-red-200'
                    }`}>
                      {user.isActive ? 'Active' : 'Blocked'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => onEdit(user)}
                        className="text-blue-400 hover:text-blue-300"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onResetPassword(user)}
                        className="text-yellow-400 hover:text-yellow-300"
                        title="Reset Password"
                      >
                        🔑
                      </button>
                      <button
                        onClick={() => onToggleStatus(user._id)}
                        className={user.isActive ? 'text-orange-400 hover:text-orange-300' : 'text-green-400 hover:text-green-300'}
                        title={user.isActive ? 'Block' : 'Activate'}
                      >
                        {user.isActive ? '🚫' : '✅'}
                      </button>
                      <button
                        onClick={() => onDelete(user._id)}
                        className="text-red-400 hover:text-red-300"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

UserTable.displayName = 'UserTable';

export default UserTable;
