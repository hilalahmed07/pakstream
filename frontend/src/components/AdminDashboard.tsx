import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks';
import ProtectedRoute from './ProtectedRoute';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-netflix-black pt-16">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-white mb-8">Admin Dashboard</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-netflix-gray p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-white mb-4">User Management</h3>
              <p className="text-gray-400 mb-4">Manage users, roles, and permissions</p>
              <button className="btn-primary">Manage Users</button>
            </div>

            <div className="bg-netflix-gray p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-white mb-4">Content Management</h3>
              <p className="text-gray-400 mb-4">Upload and manage videos</p>
              <button className="btn-primary">Manage Content</button>
            </div>

            <div className="bg-netflix-gray p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-white mb-4">Analytics</h3>
              <p className="text-gray-400 mb-4">View platform statistics</p>
              <Link to="/admin/analytics" className="btn-primary inline-block">
                View Analytics
              </Link>
            </div>

            <div className="bg-netflix-gray p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-white mb-4">System Settings</h3>
              <p className="text-gray-400 mb-4">Configure platform settings</p>
              <button className="btn-primary">Settings</button>
            </div>
          </div>

          <div className="mt-8 bg-netflix-gray p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-white mb-4">Current Admin</h3>
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-netflix-red rounded-full flex items-center justify-center">
                <span className="text-white text-lg font-bold">
                  {user?.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-white font-semibold">{user?.username}</p>
                <p className="text-gray-400">{user?.email}</p>
                <span className="px-2 py-1 bg-red-600 text-white text-xs rounded">
                  ADMIN
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default AdminDashboard;
