#!/bin/bash
# KAIRO VPS Setup Script for Ubuntu 22.04
set -e

echo "=== KAIRO VPS Setup ==="

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Install basic tools
apt install -y git curl wget ufw fail2ban htop

# Firewall setup
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Create app directory
mkdir -p /opt/kairo
cd /opt/kairo

# Set up swap (useful for 8GB RAM VPS)
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

echo "=== VPS Setup Complete ==="
echo "Next steps:"
echo "1. Clone repo to /opt/kairo"
echo "2. Copy .env.production.example to .env and fill in values"
echo "3. Run: docker compose up -d"
echo "4. Run SSL: docker compose run certbot certonly --webroot -w /var/www/certbot -d kairodao.com -d www.kairodao.com"
