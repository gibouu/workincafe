import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          'Inter',
          'sans-serif',
        ],
      },
      colors: {
        // Surfaces
        'map-bg': '#F2EDE3',
        'map-deeper': '#EAE2D1',
        // iOS system
        accent: { DEFAULT: '#007AFF', tint: '#E5F0FF' },
        'accent-green': { DEFAULT: '#34C759', tint: '#E4F7E6' },
        'accent-red': { DEFAULT: '#FF3B30', tint: '#FFECEA' },
        'accent-amber': { DEFAULT: '#FF9500', tint: '#FFF2DC' },
        'sys-gray':   '#8E8E93',
        'sys-gray-2': '#AEAEB2',
        'sys-gray-3': '#C7C7CC',
        'sys-gray-4': '#D1D1D6',
        'sys-gray-5': '#E5E5EA',
        'sys-gray-6': '#F2F2F7',
        // Place category (spec §6.5)
        cat: {
          cafe: '#6B4F3B',
          bakery: '#D4A574',
          library: '#2C3E50',
          coworking: '#16A085',
          hotel: '#8E44AD',
          restaurant: '#C0392B',
          'fast-food': '#E67E22',
          other: '#5A5A60',
        },
      },
      boxShadow: {
        bubble: '0 1px 2px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.10)',
        card: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)',
        float: '0 2px 8px rgba(0,0,0,0.08), 0 12px 32px rgba(0,0,0,0.10)',
      },
      backdropBlur: {
        ios: '24px',
      },
    },
  },
  plugins: [],
};

export default config;
