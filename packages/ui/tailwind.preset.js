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
        // Tema claro del panel admin — namespace propio: `surface`/`brand`/
        // `gold` de arriba los sigue usando también la web pública en
        // oscuro, así que no se tocan ni se reutilizan aquí.
        admin: {
          bg:               '#f4f5f6',
          surface:          '#ffffff',
          border:           '#e7e9ec',
          'border-soft':    '#eef0f2',
          hover:            '#fafbfb',
          thead:            '#fafbfb',
          text:             '#1c2024',
          'text-secondary': '#8a9198',
          'text-tertiary':  '#b5bac0',
          'text-muted':     '#9aa0a6',
          'sidebar-active': '#fbebe8',
          'sidebar-inactive': '#555b62',
          'input-border':   '#dfe2e6',
        },
      },
      fontFamily: {
        sans:    ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-sora)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card':    '0 6px 22px rgba(0,0,0,0.4)',
        'btn-primary': '0 6px 22px rgba(104,20,11,0.55)',
        'admin-card': '0 1px 2px rgba(20,20,22,0.03)',
      },
      borderRadius: {
        card:   '11px',
        btn:    '9px',
        chip:   '7px',
        badge:  '5px',
        menu:   '12px',
        'admin-card': '14px',
      },
    },
  },
};
