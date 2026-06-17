// =====================================================================
// pm2 — process manager.  (Briefing 7.1, 7.2)
// Mantiene backend y frontend vivos 24/7 con reinicio automático.
//
//   pm2 start ecosystem.config.cjs
//   pm2 reload ecosystem.config.cjs   # recarga zero-downtime (deploy)
//   pm2 save && pm2 startup           # arranque al reiniciar el VPS
// =====================================================================
module.exports = {
  apps: [
    {
      name: 'carp-api',
      cwd: './backend',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '400M',
      env: { NODE_ENV: 'production' },
      // Las variables sensibles se cargan desde backend/.env vía dotenv.
      out_file: '/var/log/carp/api-out.log',
      error_file: '/var/log/carp/api-err.log',
      time: true,
    },
    {
      name: 'carp-web',
      cwd: './apps/web',
      // Next.js en modo standalone tras `next build`
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      env: { NODE_ENV: 'production' },
      out_file: '/var/log/carp/web-out.log',
      error_file: '/var/log/carp/web-err.log',
      time: true,
    },
  ],
};
