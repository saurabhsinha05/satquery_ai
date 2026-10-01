/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep navy / near-black canvas
        void: {
          DEFAULT: '#04090D',
          50: '#0F1D26',
          100: '#0C1821',
          200: '#0A141C',
          300: '#081119',
          400: '#060D14',
          500: '#04090D',
          600: '#03070A',
        },
        // Dark translucent surfaces
        panel: {
          DEFAULT: '#0A141C',
          raised: '#0D1B24',
          high: '#102530',
        },
        // Subtle blue-gray borders
        edge: {
          DEFAULT: '#16303B',
          soft: '#122730',
          strong: '#1F4A56',
        },
        // Primary teal / emerald
        brand: {
          50: '#E6FBF4',
          100: '#C2F5E4',
          200: '#8DEBCB',
          300: '#54DDAE',
          400: '#2ACB93',
          500: '#12B981',
          600: '#0C9668',
          700: '#0B7753',
          800: '#0C5E44',
          900: '#0B4D39',
        },
        // Secondary cyan
        aqua: {
          300: '#67E8F9',
          400: '#38D9EE',
          500: '#22C3DE',
          600: '#0E9CB8',
        },
        // Cool gray text ramp
        ink: {
          DEFAULT: '#E8F2F4',
          soft: '#B9CBD3',
          mute: '#8098A5',
          dim: '#5C7280',
          faint: '#3D4F5B',
        },
        // Change-detection ramp
        heat: {
          high: '#FF4D3D',
          mid: '#FF9F1C',
          low: '#F2E14C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        '4xl': '1.75rem',
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 24px 60px -30px rgba(0,0,0,0.9)',
        lift: '0 20px 50px -24px rgba(0,0,0,0.85)',
        glow: '0 0 0 1px rgba(18,185,129,0.28), 0 12px 40px -16px rgba(18,185,129,0.42)',
        'glow-sm': '0 0 0 1px rgba(18,185,129,0.22), 0 6px 22px -10px rgba(18,185,129,0.4)',
      },
      backgroundImage: {
        'grid-fine':
          'linear-gradient(to right, rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.028) 1px, transparent 1px)',
        'brand-sheen': 'linear-gradient(135deg, #15C88A 0%, #12B981 45%, #0FA6A2 100%)',
      },
      backgroundSize: {
        'grid-fine': '44px 44px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(18px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-460px 0' },
          '100%': { backgroundPosition: '460px 0' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.7' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        'sweep-y': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(400%)' },
        },
        drift: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-9px)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'dot-bounce': {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.35' },
          '40%': { transform: 'translateY(-3px)', opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.4s ease both',
        'slide-in-right': 'slide-in-right 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.5s linear infinite',
        'pulse-ring': 'pulse-ring 1.9s cubic-bezier(0.2, 0.6, 0.3, 1) infinite',
        'sweep-y': 'sweep-y 4.5s linear infinite',
        drift: 'drift 7s ease-in-out infinite',
        'spin-slow': 'spin-slow 2.4s linear infinite',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
