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
      // Arranca vía "npm start" (= `next start`, definido en apps/web/package.json)
      // en vez de apuntar a node_modules/next/dist/bin/next directamente: en un
      // monorepo con workspaces, `next` se hoistea al node_modules de la raíz
      // (no vive dentro de apps/web/node_modules), así que una ruta fija ahí
      // se rompe. Con "npm start" es npm quien resuelve el binario, haya o no
      // hoisting.
      script: 'npm',
      args: 'start -- -p 3000',
      interpreter: 'none',
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
