import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks';
import ThemeSwitcher from '../ThemeSwitcher';
import { isPatchVisible } from '../../config/features';

const AdminSidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const menuItems = [
    { path: '/admin/users', label: 'User Management', icon: '👥' },
    { path: '/admin/analytics', label: 'Analytics', icon: '📈' },
    { path: '/admin/videos', label: 'Video Management', icon: '🎬' },
    { path: '/admin/presentations', label: 'Presentation Management', icon: '📊' },
    { path: '/admin/documents', label: 'Document Management', icon: '📄' },
    ...(isPatchVisible ? [{ path: '/admin/patches', label: 'Patch Management', icon: '🔧' }] : []),
    { path: '/admin/premieres', label: 'Premiere Management', icon: '🎭' },
    { path: '/admin/downloads', label: 'Download Management', icon: '⬇️' },
  ];

  return (
    <div
      className="fixed left-0 top-0 h-screen w-64 border-r flex flex-col z-30"
      style={{
        backgroundColor: 'var(--color-secondary)',
        borderColor: 'var(--color-border)'
      }}
    >
      {/* Logo/Header with Theme Switcher */}
      <div
        className="p-4 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <Link to="/" className="text-xl font-bold" style={{ color: 'var(--color-accent)' }}>
            🎬 PakStream
          </Link>
          <ThemeSwitcher />
        </div>
        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Admin Dashboard</div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors"
                style={{
                  backgroundColor: isActive(item.path) ? 'var(--color-accent)' : 'transparent',
                  color: isActive(item.path) ? 'var(--color-accent-text)' : 'var(--color-text-secondary)'
                }}
                onMouseEnter={(e) => {
                  if (!isActive(item.path)) {
                    e.currentTarget.style.backgroundColor = 'var(--color-hover)';
                    e.currentTarget.style.color = 'var(--color-text)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive(item.path)) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }
                }}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Info & Logout */}
      <div
        className="p-4 border-t"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center space-x-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-accent-text)'
            }}
          >
            {user?.username.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate" style={{ color: 'var(--color-text)' }}>
              {user?.username}
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Administrator
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="block w-full text-center px-4 py-2 rounded-lg transition-colors"
          style={{
            backgroundColor: 'var(--color-hover)',
            color: 'var(--color-text)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;
