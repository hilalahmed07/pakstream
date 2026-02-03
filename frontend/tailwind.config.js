/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Theme-aware colors using CSS variables
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
        'text-primary': 'var(--color-text)',
        'text-secondary': 'var(--color-text-secondary)',
        border: 'var(--color-border)',
        hover: 'var(--color-hover)',
        card: 'var(--color-card)',
        'card-hover': 'var(--color-card-hover)',
        'button-bg': 'var(--color-button-bg)',
        'button-text': 'var(--color-button-text)',
        'accent-text': 'var(--color-accent-text)',
        // Keep netflix colors for backward compatibility during migration
        netflix: {
          red: '#E50914',
          black: '#141414',
          gray: '#333333',
          lightgray: '#564d4d',
        }
      }
    },
  },
  plugins: [],
}
