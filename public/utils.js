// Utility functions for notifications, connection status, etc.
// Expose globally for use in other scripts

// Toast notification system
window.Toast = {
  container: null,
  
  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },
  
  show(message, type = 'info', duration = 3000) {
    this.init();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    this.container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after duration
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
    
    return toast;
  },
  
  success(message) {
    return this.show(message, 'success');
  },
  
  error(message) {
    return this.show(message, 'error', 5000);
  },
  
  info(message) {
    return this.show(message, 'info');
  }
};

// Connection status manager
window.ConnectionStatus = {
  status: 'connected',
  element: null,
  
  init() {
    this.element = document.createElement('div');
    this.element.className = 'connection-status';
    this.element.id = 'connection-status';
    document.body.appendChild(this.element);
    this.update('connected');
  },
  
  update(status, message = null) {
    this.status = status;
    if (!this.element) this.init();
    
    this.element.className = `connection-status connection-status-${status}`;
    this.element.textContent = message || this.getDefaultMessage(status);
  },
  
  getDefaultMessage(status) {
    const messages = {
      connected: '✓ Connected',
      disconnected: '⚠ Disconnected - Reconnecting...',
      error: '✗ Connection Error'
    };
    return messages[status] || messages.connected;
  }
};

// API request wrapper with retry logic
window.apiRequest = async function(url, options = {}, retries = 3) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, defaultOptions);
      
      if (!response.ok && response.status >= 500 && i < retries - 1) {
        // Retry on server errors
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      
      ConnectionStatus.update('connected');
      return response;
    } catch (error) {
      if (i === retries - 1) {
        ConnectionStatus.update('error');
        throw error;
      }
      ConnectionStatus.update('disconnected');
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// Adaptive polling manager
window.PollingManager = {
  interval: null,
  callback: null,
  baseInterval: 2000,
  currentInterval: 2000,
  maxInterval: 10000,
  minInterval: 1000,
  activityCount: 0,
  lastActivity: Date.now(),
  
  start(callback) {
    this.callback = callback;
    if (this.interval) this.stop();
    
    const poll = async () => {
      if (!this.callback) return;
      try {
        await this.callback();
        this.onSuccess();
      } catch (error) {
        this.onError();
      }
    };
    
    poll(); // Immediate first call
    this.interval = setInterval(poll, this.currentInterval);
  },
  
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  },
  
  onSuccess() {
    this.activityCount++;
    const timeSinceActivity = Date.now() - this.lastActivity;
    
    // If activity detected, use faster polling
    if (timeSinceActivity < 5000 && this.activityCount > 2) {
      const newInterval = Math.max(this.minInterval, this.currentInterval * 0.8);
      if (Math.abs(newInterval - this.currentInterval) > 100) {
        this.currentInterval = newInterval;
        this.restart();
      }
      this.lastActivity = Date.now();
    } else {
      // Gradually increase interval if no activity
      const newInterval = Math.min(this.maxInterval, this.currentInterval * 1.05);
      if (Math.abs(newInterval - this.currentInterval) > 200 && newInterval !== this.maxInterval) {
        this.currentInterval = newInterval;
        this.restart();
      }
    }
  },
  
  onError() {
    // On error, poll more frequently
    this.currentInterval = this.minInterval;
    this.restart();
  },
  
  restart() {
    const callback = this.callback;
    this.stop();
    if (callback) {
      this.start(callback);
    }
  },
  
  reset() {
    this.activityCount = 0;
    this.currentInterval = this.baseInterval;
  }
};

// Loading state manager
window.LoadingState = {
  show(elementId, message = 'Loading...') {
    const element = document.getElementById(elementId);
    if (element) {
      element.classList.add('loading');
      element.setAttribute('data-loading-message', message);
    }
  },
  
  hide(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.classList.remove('loading');
      element.removeAttribute('data-loading-message');
    }
  }
};

