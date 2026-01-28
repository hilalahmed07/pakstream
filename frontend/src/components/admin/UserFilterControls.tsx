import React from 'react';

interface UserFilterControlsProps {
  search: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onCreateClick: () => void;
}

const UserFilterControls: React.FC<UserFilterControlsProps> = React.memo(({
  search,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
  onCreateClick,
}) => {
  return (
    <div className="rounded-lg p-6 mb-6" style={{ backgroundColor: 'var(--color-secondary)' }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="px-4 py-2 rounded-lg focus:outline-none focus:ring-2"
          style={{ 
            backgroundColor: 'var(--color-hover)', 
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)'
          }}
        />
        
        <select
          value={roleFilter}
          onChange={(e) => onRoleFilterChange(e.target.value)}
          className="px-4 py-2 rounded-lg focus:outline-none focus:ring-2"
          style={{ 
            backgroundColor: 'var(--color-hover)', 
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)'
          }}
        >
          <option value="">All Roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="px-4 py-2 rounded-lg focus:outline-none focus:ring-2"
          style={{ 
            backgroundColor: 'var(--color-hover)', 
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)'
          }}
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Blocked</option>
        </select>
        
        <button
          onClick={onCreateClick}
          className="px-4 py-2 rounded-lg transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
        >
          + Create User
        </button>
      </div>
    </div>
  );
});

UserFilterControls.displayName = 'UserFilterControls';

export default UserFilterControls;
