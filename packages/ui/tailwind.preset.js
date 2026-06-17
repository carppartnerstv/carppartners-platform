/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#68140b',
          bright:  '#cf4a35',
          dark:    '#4a0e07',
          dim:     'rgba(104,20,11,0.2)',
        },
        surface: {
          DEFAULT: '#06090c',
          raised:  '#0e151a',
          '2':     'rgba(255,255,255,0.05)',
          overlay: 'rgba(255,255,255,0.08)',
        },
        gold: {
          DEFAULT: '#e3bd72',
          fill:    'rgba(216,166,74,0.95)',
          dim:     'rgba(216,166,74,0.16)',
        },
        'cp-gray': '#85958e',
        'cp-border': 'rgba(255,255,255,0.07)',
      },
      fontFamily: {
        sans:    ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-sora)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card':    '0 6px 22px rgba(0,0,0,0.4)',
        'btn-primary': '0 6px 22px rgba(104,20,11,0.55)',
      },
      borderRadius: {
        card:   '11px',
        btn:    '9px',
        chip:   '7px',
        badge:  '5px',
        menu:   '12px',
      },
    },
  },
};
