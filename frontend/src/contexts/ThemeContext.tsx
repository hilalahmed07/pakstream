import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Theme, getThemeColors } from '../config/themes';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  colors: ReturnType<typeof getThemeColors>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'pakstream-theme';

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Load theme from localStorage or default to dark
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme;
    return savedTheme && ['dark', 'light', 'pakistan'].includes(savedTheme) 
      ? savedTheme 
      : 'dark';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    
    // Apply theme to document root for CSS variables
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  useEffect(() => {
    // Apply theme on mount and when theme changes
    document.documentElement.setAttribute('data-theme', theme);
    
    // Apply CSS variables dynamically
    const colors = getThemeColors(theme);
    const root = document.documentElement;
    
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-secondary', colors.secondary);
    root.style.setProperty('--color-accent', colors.accent);
    root.style.setProperty('--color-text', colors.text);
    root.style.setProperty('--color-text-secondary', colors.textSecondary);
    root.style.setProperty('--color-border', colors.border);
    root.style.setProperty('--color-hover', colors.hover);
    root.style.setProperty('--color-card', colors.card);
    root.style.setProperty('--color-card-hover', colors.cardHover);
    root.style.setProperty('--color-button-bg', colors.buttonBg);
    root.style.setProperty('--color-button-text', colors.buttonText);
    root.style.setProperty('--color-accent-text', colors.accentText);
  }, [theme]);

  const colors = getThemeColors(theme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Export Theme type for convenience
export type { Theme };
