#!/bin/sh
trap exit TERM
sleep 10
certbot certonly --webroot --webroot-path=/var/www/certbot \
  -d kairodao.com -d www.kairodao.com \
  --email admin@kairodao.com --agree-tos --no-eff-email --non-interactive
while :; do
  certbot renew
  sleep 12h &
  wait $!
done
