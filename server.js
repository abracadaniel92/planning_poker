const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST_PASSWORD = process.env.HOST_PASSWORD || 'admin123';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize database
const db = new sqlite3.Database('./poker.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    current_vote TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS session (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT DEFAULT 'waiting',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Initialize session if it doesn't exist
  db.get("SELECT * FROM session ORDER BY id DESC LIMIT 1", (err, row) => {
    if (!row) {
      db.run("INSERT INTO session (status) VALUES ('waiting')");
    }
  });
});

// Helper function to get current session
function getCurrentSession(callback) {
  db.get("SELECT * FROM session ORDER BY id DESC LIMIT 1", callback);
}

// Helper function to update session
function updateSession(status, callback) {
  db.run("UPDATE session SET status = ? WHERE id = (SELECT id FROM session ORDER BY id DESC LIMIT 1)", [status], callback);
}

// API: Join session (create user)
app.post('/api/join', (req, res) => {
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const nicknames = [
    'Clever Penguin', 'Swift Fox', 'Bold Badger', 'Wise Owl', 'Curious Cat',
    'Brave Bear', 'Smart Squirrel', 'Quick Rabbit', 'Calm Koala', 'Eager Eagle',
    'Gentle Giraffe', 'Happy Hippo', 'Jolly Jaguar', 'Kind Kangaroo', 'Lucky Llama',
    'Mighty Moose', 'Noble Narwhal', 'Optimistic Otter', 'Playful Panda', 'Quiet Quail',
    'Radiant Raccoon', 'Serene Swan', 'Tranquil Tiger', 'Unique Unicorn', 'Vibrant Vulture',
    'Witty Wolf', 'Xenial Xerus', 'Yielding Yak', 'Zealous Zebra', 'Amazing Antelope'
  ];
  const nickname = nicknames[Math.floor(Math.random() * nicknames.length)];

  db.run("INSERT INTO users (id, nickname) VALUES (?, ?)", [userId, nickname], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to join session' });
    }
    res.json({ userId, nickname });
  });
});

// API: Get session status
app.get('/api/session', (req, res) => {
  getCurrentSession((err, session) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to get session' });
    }
    res.json({ status: session.status });
  });
});

// API: Get all joined users
app.get('/api/users', (req, res) => {
  getCurrentSession((err, session) => {
    if (err || !session) {
      return res.status(500).json({ error: 'Failed to get session' });
    }

    db.all("SELECT nickname, current_vote FROM users ORDER BY created_at ASC", (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to get users' });
      }
      
      // Only show vote status when voting is active
      const showVoteStatus = session.status === 'voting';
      
      res.json({ 
        users: rows.map(row => ({
          nickname: row.nickname,
          hasVoted: showVoteStatus && (row.current_vote !== null && row.current_vote !== undefined)
        })),
        totalUsers: rows.length
      });
    });
  });
});

// API: Get vote count
app.get('/api/vote-count', (req, res) => {
  getCurrentSession((err, session) => {
    if (err || !session) {
      return res.status(500).json({ error: 'Failed to get session' });
    }
    
    db.get(`SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN current_vote IS NOT NULL THEN 1 ELSE 0 END) as voted
      FROM users`, (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to get vote count' });
      }
      res.json({ total: row.total, voted: row.voted || 0 });
    });
  });
});

// API: Submit vote
app.post('/api/vote', (req, res) => {
  const { userId, vote } = req.body;

  if (!userId || vote === undefined) {
    return res.status(400).json({ error: 'Missing userId or vote' });
  }

  db.run("UPDATE users SET current_vote = ? WHERE id = ?", [vote, userId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to submit vote' });
    }
    res.json({ success: true });
  });
});

// API: Get all votes (only when voting ended)
app.get('/api/votes', (req, res) => {
  getCurrentSession((err, session) => {
    if (err || !session) {
      return res.status(500).json({ error: 'Failed to get session' });
    }

    if (session.status !== 'ended') {
      return res.json({ votes: [] });
    }

    db.all("SELECT nickname, current_vote FROM users WHERE current_vote IS NOT NULL", (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to get votes' });
      }
      res.json({ votes: rows });
    });
  });
});

// API: Host login
app.post('/api/host/login', (req, res) => {
  const { password } = req.body;
  if (password === HOST_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// API: Start voting (host only)
app.post('/api/host/start', (req, res) => {
  updateSession('voting', (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to start voting' });
    }
    // Clear all previous votes
    db.run("UPDATE users SET current_vote = NULL", () => {
      res.json({ success: true });
    });
  });
});

// API: End voting (host only)
app.post('/api/host/end', (req, res) => {
  updateSession('ended', (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to end voting' });
    }
    res.json({ success: true });
  });
});

// API: Reset session (host only)
app.post('/api/host/reset', (req, res) => {
  updateSession('waiting', (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to reset session' });
    }
    // Clear all votes
    db.run("UPDATE users SET current_vote = NULL", () => {
      res.json({ success: true });
    });
  });
});

// API: Clear all users (host only)
app.post('/api/host/clear-users', (req, res) => {
  db.get("SELECT COUNT(*) as count FROM users", (err, countRow) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to count users' });
    }
    
    const userCount = countRow.count;
    
    db.run("DELETE FROM users", function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to clear users' });
      }
      res.json({ success: true, clearedCount: userCount });
    });
  });
});

// API: Get host status (session status + votes if ended, always shows all users)
app.get('/api/host/status', (req, res) => {
  getCurrentSession((err, session) => {
    if (err || !session) {
      return res.status(500).json({ error: 'Failed to get session' });
    }

    // Always get all users for host view
    db.all("SELECT nickname, current_vote FROM users ORDER BY created_at ASC", (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to get users' });
      }

      if (session.status === 'ended') {
        // Show all users, but only include votes for those who voted
        const votes = users.filter(u => u.current_vote !== null && u.current_vote !== undefined);
        res.json({ status: session.status, votes: votes, allUsers: users });
      } else {
        res.json({ status: session.status, votes: [], allUsers: users });
      }
    });
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  db.get("SELECT 1", (err) => {
    if (err) {
      return res.status(503).json({ 
        status: 'unhealthy', 
        database: 'error',
        message: 'Database connection failed',
        timestamp: new Date().toISOString()
      });
    }
    res.json({ 
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  });
});

app.listen(PORT, () => {
  console.log(`Planning Poker server running on http://localhost:${PORT}`);
  console.log(`Host password: ${HOST_PASSWORD}`);
});
