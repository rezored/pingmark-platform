# Pingmark Platform - Simple Deployment Guide

This guide shows how to deploy the three independent Pingmark applications to their respective subdomains.

## Project Structure

```
pingmark-platform/
├── landing/          # pingmark.me (static files)
│   ├── index.html
│   └── images/
├── map/              # map.pingmark.me (static files)
│   ├── index.html
│   └── images/
└── api/              # api.pingmark.me (Node.js server)
    ├── server.js
    ├── package.json
    └── ecosystem.config.js
```

## Deployment Instructions

### 1. Landing Page (pingmark.me)

**What to upload:** Everything in the `landing/` folder

**Where to upload:** Your web server's document root for `pingmark.me`

**Steps:**
```bash
# Upload all files from landing/ folder to your web server
# Example: /var/www/pingmark.me/ or your hosting provider's file manager

# Files to upload:
# - index.html
# - images/ (entire folder with all image files)
```

**Apache VirtualHost:**
```apache
<VirtualHost *:80>
    ServerName pingmark.me
    ServerAlias www.pingmark.me
    DocumentRoot /var/www/pingmark.me
    
    <Directory /var/www/pingmark.me>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    ErrorLog ${APACHE_LOG_DIR}/pingmark-error.log
    CustomLog ${APACHE_LOG_DIR}/pingmark-access.log combined
</VirtualHost>
```

### 2. Map Viewer (map.pingmark.me)

**What to upload:** Everything in the `map/` folder

**Where to upload:** Your web server's document root for `map.pingmark.me`

**Steps:**
```bash
# Upload all files from map/ folder to your web server
# Example: /var/www/map.pingmark.me/

# Files to upload:
# - index.html
# - images/ (entire folder with all image files)
```

**Apache VirtualHost:**
```apache
<VirtualHost *:80>
    ServerName map.pingmark.me
    DocumentRoot /var/www/map.pingmark.me
    
    <Directory /var/www/map.pingmark.me>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # SPA fallback for /{lat}/{lon}/{ts} routing
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
    
    ErrorLog ${APACHE_LOG_DIR}/map-pingmark-error.log
    CustomLog ${APACHE_LOG_DIR}/map-pingmark-access.log combined
</VirtualHost>
```

### 3. API Server (api.pingmark.me)

**What to upload:** Everything in the `api/` folder

**Where to upload:** Your server (can be same server as above)

**Steps:**
```bash
# 1. Upload api/ folder to your server
# Example: /home/user/pingmark-api/

# 2. Install Node.js dependencies
cd /home/user/pingmark-api/
npm install

# 3. Start with PM2
npm install -g pm2
pm2 start ecosystem.config.js

# 4. Save PM2 configuration
pm2 save
pm2 startup
```

**Apache VirtualHost (Proxy to Node.js):**
```apache
<VirtualHost *:80>
    ServerName api.pingmark.me
    
    # Proxy to Node.js API server
    ProxyPreserveHost On
    ProxyPass / http://localhost:5175/
    ProxyPassReverse / http://localhost:5175/
    
    # CORS headers
    Header always set Access-Control-Allow-Origin "*"
    Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
    Header always set Access-Control-Allow-Headers "Content-Type, Authorization"
    
    ErrorLog ${APACHE_LOG_DIR}/api-pingmark-error.log
    CustomLog ${APACHE_LOG_DIR}/api-pingmark-access.log combined
</VirtualHost>
```

## Complete Apache Configuration

Create `/etc/apache2/sites-available/pingmark.conf`:

```apache
# Enable required modules first:
# sudo a2enmod rewrite
# sudo a2enmod headers
# sudo a2enmod proxy
# sudo a2enmod proxy_http

# Landing page - pingmark.me
<VirtualHost *:80>
    ServerName pingmark.me
    ServerAlias www.pingmark.me
    DocumentRoot /var/www/pingmark.me
    
    <Directory /var/www/pingmark.me>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    ErrorLog ${APACHE_LOG_DIR}/pingmark-error.log
    CustomLog ${APACHE_LOG_DIR}/pingmark-access.log combined
</VirtualHost>

# Map viewer - map.pingmark.me
<VirtualHost *:80>
    ServerName map.pingmark.me
    DocumentRoot /var/www/map.pingmark.me
    
    <Directory /var/www/map.pingmark.me>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # SPA fallback for /{lat}/{lon}/{ts} routing
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
    
    ErrorLog ${APACHE_LOG_DIR}/map-pingmark-error.log
    CustomLog ${APACHE_LOG_DIR}/map-pingmark-access.log combined
</VirtualHost>

# API - api.pingmark.me
<VirtualHost *:80>
    ServerName api.pingmark.me
    
    # Proxy to Node.js API server
    ProxyPreserveHost On
    ProxyPass / http://localhost:5175/
    ProxyPassReverse / http://localhost:5175/
    
    # CORS headers
    Header always set Access-Control-Allow-Origin "*"
    Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
    Header always set Access-Control-Allow-Headers "Content-Type, Authorization"
    
    ErrorLog ${APACHE_LOG_DIR}/api-pingmark-error.log
    CustomLog ${APACHE_LOG_DIR}/api-pingmark-access.log combined
</VirtualHost>
```

## Deployment Commands

```bash
# 1. Enable Apache modules
sudo a2enmod rewrite
sudo a2enmod headers
sudo a2enmod proxy
sudo a2enmod proxy_http

# 2. Create directories
sudo mkdir -p /var/www/pingmark.me
sudo mkdir -p /var/www/map.pingmark.me

# 3. Upload files (use your preferred method)
# - Upload landing/ contents to /var/www/pingmark.me/
# - Upload map/ contents to /var/www/map.pingmark.me/
# - Upload api/ folder to /home/user/pingmark-api/

# 4. Set permissions
sudo chown -R www-data:www-data /var/www/pingmark.me
sudo chown -R www-data:www-data /var/www/map.pingmark.me
sudo chmod -R 755 /var/www/pingmark.me
sudo chmod -R 755 /var/www/map.pingmark.me

# 5. Configure Apache
sudo cp deployment/apache.conf /etc/apache2/sites-available/pingmark.conf
sudo a2ensite pingmark.conf
sudo a2dissite 000-default  # Optional: disable default site

# 6. Test Apache configuration
sudo apache2ctl configtest

# 7. Restart Apache
sudo systemctl restart apache2

# 8. Install and start API
cd /home/user/pingmark-api/
npm install
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Testing

After deployment, test each component:

```bash
# Test landing page
curl http://pingmark.me

# Test map viewer
curl http://map.pingmark.me/42.6977/23.3219

# Test API
curl http://api.pingmark.me/healthz
curl "http://api.pingmark.me/api/resolve?text=I%20am%20at%20!@%2042.6977,23.3219"
```

## DNS Configuration

Make sure these A records point to your server IP:

```
pingmark.me          → YOUR_SERVER_IP
www.pingmark.me      → YOUR_SERVER_IP
map.pingmark.me      → YOUR_SERVER_IP
api.pingmark.me      → YOUR_SERVER_IP
```

## SSL/HTTPS Setup

After basic deployment works, add SSL:

```bash
# Install Certbot
sudo apt install certbot python3-certbot-apache

# Get SSL certificates
sudo certbot --apache -d pingmark.me -d www.pingmark.me -d map.pingmark.me -d api.pingmark.me
```

## Updates

To update any component:

**Landing Page:**
```bash
# Just upload new files to /var/www/pingmark.me/
```

**Map Viewer:**
```bash
# Just upload new files to /var/www/map.pingmark.me/
```

**API:**
```bash
cd /home/user/pingmark-api/
# Upload new server.js
pm2 restart pingmark-api
```

## Troubleshooting

**API not responding:**
```bash
pm2 status
pm2 logs pingmark-api
pm2 restart pingmark-api
```

**Apache issues:**
```bash
sudo apache2ctl configtest
sudo systemctl status apache2
sudo tail -f /var/log/apache2/error.log
```

**File permissions:**
```bash
sudo chown -R www-data:www-data /var/www/pingmark.me
sudo chown -R www-data:www-data /var/www/map.pingmark.me
sudo chmod -R 755 /var/www/pingmark.me
sudo chmod -R 755 /var/www/map.pingmark.me
```

This deployment approach is much simpler than the monorepo version - each subdomain is completely independent!
