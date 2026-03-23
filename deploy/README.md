# VPS Deployment Guide

## Prerequisites

- VPS (DigitalOcean $6/mo or Hetzner $4.50/mo)
- Node.js 20+
- Caddy (auto-HTTPS)
- PM2 (process manager)

## Setup

### 1. Install dependencies on VPS

```bash
# Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 20
nvm use 20

# PM2
npm install -g pm2

# Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### 2. Clone and configure

```bash
cd /opt
git clone <repo-url> jameslandreth
cd jameslandreth

# Create .env
cp .env.example .env
# Edit .env with Supabase credentials
nano .env
```

### 3. Build

```bash
npm install
npm run build
```

### 4. Start with PM2

```bash
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup  # follow the output to enable auto-start on boot
```

### 5. Configure Caddy

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### 6. DNS

Add A records pointing both domains to your VPS IP:

```
jameslandreth.com          → <VPS_IP>
artifacts.jameslandreth.com → <VPS_IP>
```

Caddy will auto-provision SSL certificates via Let's Encrypt.

## Deploy updates

```bash
cd /opt/jameslandreth
git pull
npm install
npm run build
pm2 restart jameslandreth
```

## Monitoring

```bash
pm2 status          # Check process status
pm2 logs            # View logs
pm2 monit           # Real-time monitoring
caddy validate      # Validate Caddy config
sudo systemctl status caddy
```
