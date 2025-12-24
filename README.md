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

Perfect for self-hosting on your Lenovo ThinkCentre. The app uses SQLite (file-based database) and requires no external services.

For production, consider:
- Using PM2 or systemd to keep it running
- Setting up a reverse proxy (nginx/Caddy) for SSL
- Using a proper domain/subdomain (e.g., `poker.gmojsoski.com`)

