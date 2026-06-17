#!/usr/bin/env bash
# =====================================================================
# Provisión del VPS Hetzner (Ubuntu 24.04 LTS).  (Briefing 7.1)
# Instala todo el stack: Node 20, PostgreSQL 16, Redis 7, Nginx, pm2,
# Certbot y configura el firewall UFW.
#
# Ejecutar como root en un servidor recién creado:
#   bash setup-vps.sh
#
# Es idempotente: se puede volver a ejecutar sin romper nada.
# =====================================================================
set -euo pipefail

DOMAIN="carppartners.tv"
DB_NAME="carp_partners"
DB_USER="carp"
APP_DIR="/var/www/carp-partners-tv"

echo "==> Actualizando sistema"
apt-get update && apt-get upgrade -y

echo "==> Paquetes base"
apt-get install -y curl git ufw ca-certificates gnupg

echo "==> Node.js 20 LTS"
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

echo "==> PostgreSQL 16"
apt-get install -y postgresql postgresql-contrib
systemctl enable --now postgresql
# Crea rol y BD si no existen (genera una contraseña aleatoria la 1ª vez)
DB_PASS="$(openssl rand -hex 16)"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

echo "==> Redis 7"
apt-get install -y redis-server
systemctl enable --now redis-server

echo "==> Nginx"
apt-get install -y nginx
systemctl enable --now nginx

echo "==> Certbot (Let's Encrypt)"
apt-get install -y certbot python3-certbot-nginx

echo "==> Firewall UFW (solo SSH, HTTP, HTTPS)"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> Directorio de logs y app"
mkdir -p /var/log/carp
mkdir -p "${APP_DIR}"

echo "==> Nginx site"
if [ -f "${APP_DIR}/deploy/nginx/${DOMAIN}.conf" ]; then
  cp "${APP_DIR}/deploy/nginx/${DOMAIN}.conf" "/etc/nginx/sites-available/${DOMAIN}.conf"
  ln -sf "/etc/nginx/sites-available/${DOMAIN}.conf" "/etc/nginx/sites-enabled/${DOMAIN}.conf"
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
fi

cat <<EOF

=====================================================================
 Provisión completada.
 Contraseña de PostgreSQL generada para el rol ${DB_USER}:
   ${DB_PASS}
 -> Cópiala a backend/.env en DATABASE_URL:
   postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}

 Próximos pasos:
   1) git clone <repo> ${APP_DIR}
   2) Rellenar ${APP_DIR}/backend/.env (ver .env.example)
   3) cd backend && npm ci && npm run migrate
   4) pm2 start ${APP_DIR}/ecosystem.config.cjs && pm2 save && pm2 startup
   5) certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}
=====================================================================
EOF
