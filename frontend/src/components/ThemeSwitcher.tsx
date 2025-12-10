import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../config/themes';

const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const themes: { value: Theme; label: string; preview: string }[] = [
    { value: 'dark', label: 'Dark', preview: '⚫' },
    { value: 'light', label: 'Light', preview: '⚪' },
    { value: 'pakistan', label: 'Pakistan', preview: '🇵🇰' },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    setIsOpen(false);
  };

  const currentTheme = themes.find(t => t.value === theme);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg border transition-all duration-300 hover:opacity-90 shadow-sm"
        style={{
          backgroundColor: 'var(--color-secondary)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text)'
        }}
        aria-label="Change theme"
        aria-expanded={isOpen}
      >
        <span className="text-xl">{currentTheme?.preview}</span>
        <span className="hidden md:block text-sm font-medium">{currentTheme?.label}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {themes.map((themeOption) => (
            <button
              key={themeOption.value}
              onClick={() => handleThemeChange(themeOption.value)}
              className={`w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-hover transition-colors ${
                theme === themeOption.value
                  ? 'bg-hover font-semibold'
                  : ''
              }`}
              style={theme === themeOption.value ? {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderLeft: '3px solid var(--color-accent)'
              } : {}}
            >
              <span className="text-xl">{themeOption.preview}</span>
              <span className="flex-1 text-text-primary">{themeOption.label}</span>
              {theme === themeOption.value && (
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  style={{ color: 'var(--color-accent)' }}
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeSwitcher;

