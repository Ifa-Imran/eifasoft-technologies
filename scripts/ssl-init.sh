#!/bin/bash
# Initialize SSL certificates with Let's Encrypt
set -e

DOMAIN="kairodao.com"

# Start nginx temporarily for ACME challenge
docker compose up -d nginx

# Get certificate
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  -d $DOMAIN \
  -d www.$DOMAIN \
  --email admin@$DOMAIN \
  --agree-tos \
  --no-eff-email

# Restart nginx with SSL
docker compose restart nginx

echo "SSL certificates installed for $DOMAIN"
