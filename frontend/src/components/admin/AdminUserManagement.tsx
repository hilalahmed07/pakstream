import React, { useState, useEffect, useRef } from 'react';
import userService from '../../services/userService';
import { User, CreateUserData, UpdateUserData } from '../../types/user';
import CreateUserModal from './CreateUserModal';
import EditUserModal from './EditUserModal';
import ResetPasswordModal from './ResetPasswordModal';
import UserFilterControls from './UserFilterControls';
import UserTable from './UserTable';

const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500); // Wait 500ms after user stops typing

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, roleFilter, statusFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getUsers({
        page: currentPage,
        limit: 10,
        search: debouncedSearch,
        role: roleFilter || undefined,
        isActive: statusFilter || undefined
      });
      setUsers(response.data.users);
      setTotalPages(response.data.pagination.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearch, roleFilter, statusFilter]);

  const handleCreateUser = async (userData: CreateUserData) => {
    try {
      await userService.createUser(userData);
      setShowCreateModal(false);
      fetchUsers();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (userId: string, userData: UpdateUserData) => {
    try {
      await userService.updateUser(userId, userData);
      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update user');
    }
  };

  const handleResetPassword = async (userId: string, newPassword: string) => {
    try {
      await userService.resetUserPassword(userId, newPassword);
      setShowResetPasswordModal(false);
      setSelectedUser(null);
    } catch (err: any) {
      throw new Error(err.message || 'Failed to reset password');
    }
  };

  const handleToggleStatus = async (userId: string) => {
    try {
      await userService.toggleUserStatus(userId);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle user status');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const user = users.find((item) => item._id === userId);
    if (!user) return;

    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    try {
      setDeletingUser(true);
      await userService.deleteUser(userToDelete._id);
      setShowDeleteModal(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setDeletingUser(false);
    }
  };

  const handleDeleteCancel = () => {
    if (deletingUser) return;
    setShowDeleteModal(false);
    setUserToDelete(null);
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const openResetPasswordModal = (user: User) => {
    setSelectedUser(user);
    setShowResetPasswordModal(true);
  };

  return (
    <div>
      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Filters and Actions - Memoized Component */}
      <UserFilterControls
        search={search}
        onSearchChange={setSearch}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onCreateClick={() => setShowCreateModal(true)}
      />

      {/* Users Table - Memoized Component */}
      <UserTable
        users={users}
        loading={loading}
        onEdit={openEditModal}
        onResetPassword={openResetPasswordModal}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDeleteUser}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center items-center space-x-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
          >
            Previous
          </button>
          <span style={{ color: 'var(--color-text-secondary)' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
          >
            Next
          </button>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateUserModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateUser}
        />
      )}

      {showEditModal && selectedUser && (
        <EditUserModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
          onSubmit={handleUpdateUser}
        />
      )}

      {showResetPasswordModal && selectedUser && (
        <ResetPasswordModal
          isOpen={showResetPasswordModal}
          onClose={() => {
            setShowResetPasswordModal(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
          onSubmit={handleResetPassword}
        />
      )}

      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div
            className="w-full max-w-md rounded-lg border p-6 shadow-2xl"
            style={{
              backgroundColor: 'var(--color-secondary)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="flex items-start gap-4 mb-5">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#f87171',
                }}
              >
                !
              </div>
              <div>
                <h3 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                  Delete user
                </h3>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <div
              className="mb-6 rounded-lg p-4"
              style={{ backgroundColor: 'var(--color-hover)' }}
            >
              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                {userToDelete.username}
              </p>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {userToDelete.email}
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                Role: {userToDelete.role} | Status: {userToDelete.isActive ? 'Active' : 'Blocked'}
              </p>
            </div>

            <p className="mb-6" style={{ color: 'var(--color-text)' }}>
              Are you sure you want to delete this user account?
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDeleteCancel}
                disabled={deletingUser}
                className="flex-1 rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deletingUser}
                className="flex-1 rounded-lg px-4 py-2 text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#dc2626' }}
              >
                {deletingUser ? 'Deleting...' : 'Delete user'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserManagement;
