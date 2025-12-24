const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST_PASSWORD = process.env.HOST_PASSWORD || 'admin123';
const MAX_USERS_PER_SESSION = parseInt(process.env.MAX_USERS_PER_SESSION || '50');
const USER_CLEANUP_HOURS = parseInt(process.env.USER_CLEANUP_HOURS || '24');
const HOST_SESSION_TIMEOUT = parseInt(process.env.HOST_SESSION_TIMEOUT || '3600000'); // 1 hour in ms

// In-memory store for host sessions
const hostSessions = new Map();

// Logging helper
function logError(message, error) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR: ${message}`, error ? error.stack : '');
}

function logInfo(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] INFO: ${message}`);
}

app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.static('public'));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Stricter limit for sensitive operations
  message: { error: 'Too many requests, please try again later.' },
});

app.use('/api/', apiLimiter);
app.use('/api/host/', strictLimiter);

// Input validation helper
function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid input', details: errors.array() });
  }
  next();
}

// Host session middleware
function requireHostSession(req, res, next) {
  const sessionId = req.headers['x-host-session-id'];
  const session = hostSessions.get(sessionId);
  
  if (!sessionId || !session) {
    return res.status(401).json({ error: 'Host session required or expired' });
  }
  
  // Check if session expired
  if (Date.now() - session.lastActivity > HOST_SESSION_TIMEOUT) {
    hostSessions.delete(sessionId);
    return res.status(401).json({ error: 'Host session expired' });
  }
  
  // Update last activity
  session.lastActivity = Date.now();
  req.hostSession = session;
  next();
}

// Initialize database
const db = new sqlite3.Database('./poker.db', (err) => {
  if (err) {
    logError('Database initialization failed', err);
    process.exit(1);
  }
  logInfo('Database connected');
});

// Enable WAL mode for better concurrency
db.run('PRAGMA journal_mode = WAL');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    current_vote TEXT,
    session_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS session (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT DEFAULT 'waiting',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create index for better performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_session ON users(session_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_activity ON users(last_activity)`);

  // Initialize default session if it doesn't exist
  db.get("SELECT * FROM session ORDER BY id DESC LIMIT 1", (err, row) => {
    if (!row && !err) {
      db.run("INSERT INTO session (status) VALUES ('waiting')", (err) => {
        if (err) logError('Failed to create default session', err);
      });
    }
  });

  // Cleanup old users on startup
  cleanupOldUsers();
});

// Helper function to get current session
function getCurrentSession(callback) {
  db.get("SELECT * FROM session ORDER BY id DESC LIMIT 1", callback);
}

// Helper function to update session
function updateSession(status, callback) {
  db.run("UPDATE session SET status = ?, last_activity = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM session ORDER BY id DESC LIMIT 1)", [status], callback);
}

// User cleanup function
function cleanupOldUsers() {
  const cutoffTime = new Date(Date.now() - USER_CLEANUP_HOURS * 60 * 60 * 1000).toISOString();
  db.run("DELETE FROM users WHERE last_activity < ?", [cutoffTime], function(err) {
    if (err) {
      logError('User cleanup failed', err);
    } else if (this.changes > 0) {
      logInfo(`Cleaned up ${this.changes} old users`);
    }
  });
}

// Run cleanup every hour
setInterval(cleanupOldUsers, 60 * 60 * 1000);

// Helper to generate unique nickname
function generateUniqueNickname(existingNicknames, callback) {
  const nicknames = [
    'Clever Penguin', 'Swift Fox', 'Bold Badger', 'Wise Owl', 'Curious Cat',
    'Brave Bear', 'Smart Squirrel', 'Quick Rabbit', 'Calm Koala', 'Eager Eagle',
    'Gentle Giraffe', 'Happy Hippo', 'Jolly Jaguar', 'Kind Kangaroo', 'Lucky Llama',
    'Mighty Moose', 'Noble Narwhal', 'Optimistic Otter', 'Playful Panda', 'Quiet Quail',
    'Radiant Raccoon', 'Serene Swan', 'Tranquil Tiger', 'Unique Unicorn', 'Vibrant Vulture',
    'Witty Wolf', 'Xenial Xerus', 'Yielding Yak', 'Zealous Zebra', 'Amazing Antelope'
  ];
  
    db.all("SELECT nickname FROM users WHERE session_id = (SELECT id FROM session ORDER BY id DESC LIMIT 1)", (err, rows) => {
    if (err) {
      return callback(err, null);
    }
    
    const existing = new Set(rows.map(r => r.nickname));
    let baseNickname = nicknames[Math.floor(Math.random() * nicknames.length)];
    let finalNickname = baseNickname;
    let counter = 1;
    
    while (existing.has(finalNickname) && counter < 100) {
      finalNickname = `${baseNickname} ${counter}`;
      counter++;
    }
    
    callback(null, finalNickname);
  });
}

// API: Join session (create user)
app.post('/api/join', [
  body('userId').optional().isString().trim().escape(),
], validateRequest, (req, res) => {
  // Check user count
  db.get("SELECT COUNT(*) as count FROM users WHERE session_id = (SELECT id FROM session ORDER BY id DESC LIMIT 1)", (err, row) => {
    if (err) {
      logError('Failed to count users', err);
      return res.status(500).json({ error: 'Failed to check user limit' });
    }
    
    if (row.count >= MAX_USERS_PER_SESSION) {
      return res.status(403).json({ error: `Maximum ${MAX_USERS_PER_SESSION} users allowed per session` });
    }
    
    const userId = req.body.userId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    generateUniqueNickname([], (err, nickname) => {
      if (err) {
        logError('Failed to generate nickname', err);
        return res.status(500).json({ error: 'Failed to join session' });
      }
      
      db.run("INSERT INTO users (id, nickname, session_id) VALUES (?, ?, (SELECT id FROM session ORDER BY id DESC LIMIT 1))", [userId, nickname], function(err) {
        if (err) {
          logError('Failed to insert user', err);
          return res.status(500).json({ error: 'Failed to join session' });
        }
        res.json({ userId, nickname });
      });
    });
  });
});

// API: Leave session (remove user)
app.post('/api/leave', [
  body('userId').notEmpty().isString().trim().escape(),
], validateRequest, (req, res) => {
  const { userId } = req.body;
  
  db.run("DELETE FROM users WHERE id = ?", [userId], function(err) {
    if (err) {
      logError('Failed to remove user', err);
      return res.status(500).json({ error: 'Failed to leave session' });
    }
    res.json({ success: true });
  });
});

// API: Get session status
app.get('/api/session', (req, res) => {
  getCurrentSession((err, session) => {
    if (err) {
      logError('Failed to get session', err);
      return res.status(500).json({ error: 'Failed to get session status' });
    }
    if (!session) {
      return res.status(404).json({ error: 'No session found' });
    }
    res.json({ status: session.status });
  });
});

// API: Get all joined users
app.get('/api/users', (req, res) => {
  getCurrentSession((err, session) => {
    if (err || !session) {
      logError('Failed to get session for users', err);
      return res.status(500).json({ error: 'Failed to get session' });
    }

    db.all("SELECT nickname, current_vote FROM users WHERE session_id = ? ORDER BY created_at ASC", [session.id], (err, rows) => {
      if (err) {
        logError('Failed to get users', err);
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
      FROM users WHERE session_id = ?`, [session.id], (err, row) => {
      if (err) {
        logError('Failed to get vote count', err);
        return res.status(500).json({ error: 'Failed to get vote count' });
      }
      res.json({ total: row.total, voted: row.voted || 0 });
    });
  });
});

// API: Submit vote
app.post('/api/vote', [
  body('userId').notEmpty().isString().trim().escape(),
  body('vote').notEmpty().matches(/^(0|1|2|3|5|8|13|21|34|55|89|\?)$/),
], validateRequest, (req, res) => {
  const { userId, vote } = req.body;

  // Update user activity
  db.run("UPDATE users SET current_vote = ?, last_activity = CURRENT_TIMESTAMP WHERE id = ?", [vote, userId], function(err) {
    if (err) {
      logError('Failed to submit vote', err);
      return res.status(500).json({ error: 'Failed to submit vote' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
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

    db.all("SELECT nickname, current_vote FROM users WHERE session_id = ? AND current_vote IS NOT NULL", [session.id], (err, rows) => {
      if (err) {
        logError('Failed to get votes', err);
        return res.status(500).json({ error: 'Failed to get votes' });
      }
      res.json({ votes: rows });
    });
  });
});

// API: Host login
app.post('/api/host/login', [
  body('password').notEmpty().isString(),
], validateRequest, (req, res) => {
  const { password } = req.body;
  if (password === HOST_PASSWORD) {
    const sessionId = `host_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    hostSessions.set(sessionId, {
      id: sessionId,
      lastActivity: Date.now(),
    });
    res.json({ success: true, sessionId });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// API: Host logout
app.post('/api/host/logout', requireHostSession, (req, res) => {
  const sessionId = req.hostSession.id;
  hostSessions.delete(sessionId);
  res.json({ success: true });
});

// API: Start voting (host only)
app.post('/api/host/start', requireHostSession, (req, res) => {
  updateSession('voting', (err) => {
    if (err) {
      logError('Failed to start voting', err);
      return res.status(500).json({ error: 'Failed to start voting' });
    }
    // Clear all previous votes
    getCurrentSession((err, session) => {
      if (err || !session) {
        return res.status(500).json({ error: 'Failed to get session' });
      }
      db.run("UPDATE users SET current_vote = NULL WHERE session_id = ?", [session.id], (err) => {
        if (err) {
          logError('Failed to clear votes', err);
          return res.status(500).json({ error: 'Failed to clear votes' });
        }
        res.json({ success: true });
      });
    });
  });
});

// API: End voting (host only)
app.post('/api/host/end', requireHostSession, (req, res) => {
  updateSession('ended', (err) => {
    if (err) {
      logError('Failed to end voting', err);
      return res.status(500).json({ error: 'Failed to end voting' });
    }
    res.json({ success: true });
  });
});

// API: Reset session (host only)
app.post('/api/host/reset', requireHostSession, (req, res) => {
  updateSession('waiting', (err) => {
    if (err) {
      logError('Failed to reset session', err);
      return res.status(500).json({ error: 'Failed to reset session' });
    }
    // Clear all votes and optionally clean up old users
    getCurrentSession((err, session) => {
      if (err || !session) {
        return res.status(500).json({ error: 'Failed to get session' });
      }
      db.run("UPDATE users SET current_vote = NULL WHERE session_id = ?", [session.id], (err) => {
        if (err) {
          logError('Failed to clear votes on reset', err);
          return res.status(500).json({ error: 'Failed to reset votes' });
        }
        cleanupOldUsers();
        res.json({ success: true });
      });
    });
  });
});

// API: Get host status (session status + votes if ended)
app.get('/api/host/status', requireHostSession, (req, res) => {
  getCurrentSession((err, session) => {
    if (err || !session) {
      return res.status(500).json({ error: 'Failed to get session' });
    }

    if (session.status === 'ended') {
      db.all("SELECT nickname, current_vote FROM users WHERE session_id = ? AND current_vote IS NOT NULL", [session.id], (err, rows) => {
        if (err) {
          logError('Failed to get votes for host', err);
          return res.status(500).json({ error: 'Failed to get votes' });
        }
        res.json({ status: session.status, votes: rows });
      });
    } else {
      res.json({ status: session.status, votes: [] });
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  db.get("SELECT 1", (err) => {
    if (err) {
      logError('Health check failed', err);
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

// Cleanup expired host sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of hostSessions.entries()) {
    if (now - session.lastActivity > HOST_SESSION_TIMEOUT) {
      hostSessions.delete(sessionId);
      logInfo(`Removed expired host session: ${sessionId}`);
    }
  }
}, 5 * 60 * 1000);

// Graceful shutdown
process.on('SIGINT', () => {
  logInfo('Shutting down gracefully...');
  db.close((err) => {
    if (err) {
      logError('Error closing database', err);
    } else {
      logInfo('Database connection closed');
    }
    process.exit(0);
  });
});

app.listen(PORT, () => {
  logInfo(`Planning Poker server running on http://localhost:${PORT}`);
  logInfo(`Host password: ${HOST_PASSWORD}`);
  logInfo(`Max users per session: ${MAX_USERS_PER_SESSION}`);
});
