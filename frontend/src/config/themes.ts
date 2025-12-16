export type Theme = 'dark' | 'light' | 'pakistan';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textSecondary: string;
  border: string;
  hover: string;
  card: string;
  cardHover: string;
  buttonBg: string;
  buttonText: string;
  accentText: string; // Text color for elements with accent background
}

export const themes: Record<Theme, ThemeColors> = {
  dark: {
    primary: '#141414',      // netflix-black
    secondary: '#333333',     // netflix-gray
    accent: '#E50914',       // netflix-red
    text: '#FFFFFF',
    textSecondary: '#B3B3B3',
    border: '#404040',
    hover: '#1F1F1F',
    card: '#1A1A1A',
    cardHover: '#262626',
    buttonBg: '#333333',     // Secondary for buttons
    buttonText: '#FFFFFF',   // White text on dark buttons
    accentText: '#FFFFFF',  // White text on red accent background
  },
  light: {
    primary: '#FFFFFF',
    secondary: '#F1F5F9',      // slate-100 - better contrast
    accent: '#4F46E5',         // indigo-600
    text: '#0F172A',           // slate-900 - almost black for better contrast
    textSecondary: '#475569',   // slate-600 - darker for better readability
    border: '#E2E8F0',         // slate-200
    hover: '#F8FAFC',          // slate-50
    card: '#FAFAFA',           // Slightly off-white for distinction
    cardHover: '#F4F4F5',      // gray-100
    buttonBg: '#F1F5F9',       // slate-100 for ThemeSwitcher and buttons
    buttonText: '#0F172A',     // Almost black for high contrast
    accentText: '#FFFFFF',    // White text on indigo accent background
  },
  pakistan: {
    primary: '#01411C',       // Pakistan dark green
    secondary: '#026830',     // Medium green
    accent: '#FFFFFF',        // White
    text: '#FFFFFF',
    textSecondary: '#E0E0E0',
    border: '#028A3F',        // Lighter green border
    hover: '#026830',         // Medium green hover
    card: '#026830',          // Medium green cards
    cardHover: '#028A3F',     // Lighter green on hover
    buttonBg: '#FFFFFF',      // White background for buttons
    buttonText: '#01411C',    // Dark green text on white buttons
    accentText: '#01411C',   // Dark green text on white accent background
  },
};

export const getThemeColors = (theme: Theme): ThemeColors => {
  return themes[theme];
};

