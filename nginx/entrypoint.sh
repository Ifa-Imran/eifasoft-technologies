#!/bin/sh
set -e

# Generate temporary self-signed cert if no Let's Encrypt cert exists
if [ ! -f /etc/letsencrypt/live/kairodao.com/fullchain.pem ]; then
  echo "No SSL cert found, creating temporary self-signed cert..."
  mkdir -p /etc/letsencrypt/live/kairodao.com
  openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
    -keyout /etc/letsencrypt/live/kairodao.com/privkey.pem \
    -out /etc/letsencrypt/live/kairodao.com/fullchain.pem \
    -subj '/CN=kairodao.com'
  echo "Temporary self-signed cert created"
fi

# Reload nginx every 6 hours to pick up renewed certs
while :; do sleep 6h; nginx -s reload 2>/dev/null; done &

# Start nginx in foreground
exec nginx -g 'daemon off;'
