/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',
        secondary: '#10B981',
        accent: '#8B5CF6',
        dark: '#0F172A',
        darker: '#020617',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-dark': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'gradient-sunset': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'gradient-ocean': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      },
      boxShadow: {
        'neon-blue': '0 0 10px rgba(66, 133, 244, 0.5), 0 0 20px rgba(66, 133, 244, 0.3)',
        'neon-purple': '0 0 10px rgba(139, 92, 246, 0.5), 0 0 20px rgba(139, 92, 246, 0.3)',
        'neon-pink': '0 0 10px rgba(245, 87, 108, 0.5), 0 0 20px rgba(245, 87, 108, 0.3)',
        'glow-lg': '0 0 30px rgba(66, 133, 244, 0.4)',
      },
      backdropBlur: {
        'xl': '20px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(66, 133, 244, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(66, 133, 244, 0.8)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}