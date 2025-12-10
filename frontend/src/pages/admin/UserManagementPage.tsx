import React from 'react';
import AdminUserManagement from '../../components/admin/AdminUserManagement';

const UserManagementPage: React.FC = () => {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-primary)' }}>
      <div className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>User Management</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Manage user accounts, roles, and permissions</p>
        </div>
        <AdminUserManagement />
      </div>
    </div>
  );
};

export default UserManagementPage;
