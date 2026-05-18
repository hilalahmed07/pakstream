import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks';
import LoginModal from './auth/LoginModal';
import UserProfile from './auth/UserProfile';
import ThemeSwitcher from './ThemeSwitcher';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);

  const handleLogout = () => {
    logout();
    setShowUserProfile(false);
    navigate('/');
  };

  // When already on the home route, clicking the logo should bring the user
  // back to the top of the page (Router won't re-navigate to the same path,
  // so it would otherwise feel like nothing happened).
  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 bg-primary bg-opacity-95 backdrop-blur-sm z-40 border-b border-border shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-8">
              <Link to="/" onClick={handleLogoClick} className="text-2xl font-bold text-text-primary">
                🎬 PakStream
              </Link>

              {/* Navigation Links */}
              <div className="hidden md:flex items-center space-x-6">
                <button
                  onClick={() => scrollToSection('videos')}
                  className="text-text-primary hover:text-text-secondary transition-colors"
                >
                  Videos
                </button>
                <button
                  onClick={() => scrollToSection('presentations')}
                  className="text-text-primary hover:text-text-secondary transition-colors"
                >
                  Presentations
                </button>
                <button
                  onClick={() => scrollToSection('documents')}
                  className="text-text-primary hover:text-text-secondary transition-colors"
                >
                  Documents
                </button>
                <button
                  onClick={() => scrollToSection('patches')}
                  className="text-text-primary hover:text-text-secondary transition-colors"
                >
                  Patches
                </button>
                <button
                  onClick={() => scrollToSection('premieres')}
                  className="text-text-primary hover:text-text-secondary transition-colors"
                >
                  Premieres
                </button>
              </div>
            </div>

            {/* User Actions */}
            <div className="flex items-center space-x-4">
              {/* Theme Switcher */}
              <ThemeSwitcher />

              {user ? (
                <div className="flex items-center space-x-4">
                  {/* Admin Dashboard Link */}
                  {user.role === 'admin' && (
                    <Link
                      to="/admin"
                      className="px-4 py-2 rounded-lg font-bold text-sm transition-all duration-300 hover:opacity-90"
                      style={{
                        backgroundColor: 'var(--color-accent)',
                        color: 'var(--color-accent-text)'
                      }}
                    >
                      Admin Dashboard
                    </Link>
                  )}

                  {/* User Profile */}
                  <div className="relative">
                    <button
                      onClick={() => setShowUserProfile(!showUserProfile)}
                      className="flex items-center space-x-2 text-text-primary hover:text-text-secondary transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold" style={{
                        backgroundColor: 'var(--color-button-bg)',
                        color: 'var(--color-button-text)'
                      }}>
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="hidden md:block">{user.username}</span>
                      {user.role === 'admin' && (
                        <span className="hidden md:block text-xs px-2 py-1 rounded font-semibold" style={{
                          backgroundColor: 'var(--color-button-bg)',
                          color: 'var(--color-button-text)'
                        }}>
                          Admin
                        </span>
                      )}
                    </button>

                    {showUserProfile && (
                      <UserProfile
                        user={user}
                        onClose={() => setShowUserProfile(false)}
                        onLogout={handleLogout}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="px-6 py-2 rounded-lg font-bold transition-all duration-300 hover:opacity-90"
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: 'var(--color-accent-text)'
                    }}
                  >
                    Sign In
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Modals */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </>
  );
};

export default Navbar;
