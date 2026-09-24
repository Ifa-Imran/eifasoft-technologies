#!/bin/bash
# Initialize SSL certificates with Let's Encrypt
set -e

DOMAIN="kairoprotocol.com"

# Start nginx temporarily for ACME challenge
docker compose up -d nginx

# Get certificate (SAN covers the new domain, www, and the legacy domain
# so the kairodao.com -> kairoprotocol.com redirect also works over HTTPS)
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  -d $DOMAIN \
  -d www.$DOMAIN \
  -d kairodao.com \
  -d www.kairodao.com \
  --email admin@$DOMAIN \
  --agree-tos \
  --no-eff-email

# Restart nginx with SSL
docker compose restart nginx

echo "SSL certificates installed for $DOMAIN"
