# Planning Poker App

A simple, self-hosted Planning Poker application for Scrum teams.

## Features

- **Anonymous Voting**: Users join without login, get random funny nicknames
- **Fibonacci Cards**: Standard Planning Poker sequence (0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ?)
- **Host Control**: Password-protected host panel to start/end/reset voting
- **Real-time Updates**: Polling-based updates every 2 seconds
- **Simple & Lightweight**: Node.js + Express + SQLite

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your `HOST_PASSWORD`

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Access the app:**
   - Main page: `http://localhost:3000`
   - Both users and host can access from the main page

## Usage

### For Users:
1. Visit the main page
2. Click "Join Session"
3. Get assigned a random nickname
4. Wait for host to start voting
5. Select your Fibonacci card
6. Change your vote anytime before host ends voting
7. See results when voting ends

### For Host:
1. Visit the main page (`http://localhost:3000`)
2. Scroll to "Host Login" section and enter password
3. You'll be redirected to the host control panel
4. Use control panel to:
   - **Start Voting**: Begin a new voting round
   - **End Voting**: Stop voting and show results
   - **Reset**: Clear votes and prepare for next story

## Environment Variables

- `PORT`: Server port (default: 3000)
- `HOST_PASSWORD`: Password for host login (default: admin123)

## Self-Hosting

Perfect for self-hosting. The app uses SQLite (file-based database) and requires no external services.

### Production Deployment with PM2

1. **Install PM2 globally:**
   ```bash
   npm install -g pm2
   ```

2. **Start the app with PM2:**
   ```bash
   pm2 start ecosystem.config.js
   ```

3. **Save PM2 configuration and enable startup:**
   ```bash
   pm2 save
   pm2 startup  # Follow the instructions to enable auto-start on boot
   ```

4. **Useful PM2 commands:**
   ```bash
   pm2 status              # Check app status
   pm2 logs planning-poker # View logs
   pm2 restart planning-poker # Restart the app
   pm2 stop planning-poker    # Stop the app
   ```

### Reverse Proxy Setup (Caddy/nginx)

When running behind a reverse proxy (Caddy, nginx, etc.), the app automatically trusts the proxy headers. The `trust proxy` setting is already configured in `server.js`.

**Example Caddy configuration:**
```caddy
poker.gmojsoski.com {
    encode gzip
    reverse_proxy http://localhost:3000 {
        header_up X-Forwarded-Proto https
        header_up X-Real-IP {remote_host}
    }
}
```

**Example nginx configuration:**
```nginx
server {
    server_name poker.gmojsoski.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Cloudflare Tunnel Setup

If using Cloudflare Tunnel, add this to your tunnel configuration:

```yaml
- hostname: poker.gmojsoski.com
  service: http://localhost:3000
```

