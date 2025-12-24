// Check authentication
if (!sessionStorage.getItem('hostAuthenticated')) {
    window.location.href = 'login.html';
}

let pollInterval = null;

// Wait for DOM to be ready before attaching event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Control buttons
    document.getElementById('start-btn').addEventListener('click', async () => {
        try {
            const response = await fetch('/api/host/start', { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                updateUI();
            }
        } catch (error) {
            console.error('Failed to start voting:', error);
            alert('Failed to start voting. Please try again.');
        }
    });

    document.getElementById('end-btn').addEventListener('click', async () => {
        try {
            const response = await fetch('/api/host/end', { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                updateUI();
            }
        } catch (error) {
            console.error('Failed to end voting:', error);
            alert('Failed to end voting. Please try again.');
        }
    });

    document.getElementById('reset-btn').addEventListener('click', async () => {
        try {
            const response = await fetch('/api/host/reset', { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                updateUI();
            }
        } catch (error) {
            console.error('Failed to reset:', error);
            alert('Failed to reset. Please try again.');
        }
    });

    document.getElementById('clear-users-btn').addEventListener('click', async () => {
        if (!confirm('Are you sure you want to clear all users? This will remove everyone from the session.')) {
            return;
        }
        
        try {
            const response = await fetch('/api/host/clear-users', { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                const count = data.clearedCount || 0;
                alert(`Successfully cleared ${count} user(s)`);
                updateUI();
            }
        } catch (error) {
            console.error('Failed to clear users:', error);
            alert('Failed to clear users. Please try again.');
        }
    });

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to logout? This will also clear all users.')) {
                return;
            }
            
            // Try to clear users, but logout even if it fails
            try {
                const clearResponse = await fetch('/api/host/clear-users', { method: 'POST' });
                if (clearResponse.ok) {
                    const clearData = await clearResponse.json();
                    console.log(`Cleared ${clearData.clearedCount || 0} user(s) before logout`);
                }
            } catch (error) {
                console.error('Failed to clear users on logout (continuing anyway):', error);
            }
            
            // Always logout and redirect, even if clearing users failed
            sessionStorage.removeItem('hostAuthenticated');
            window.location.href = 'login.html';
        });
    }

    // Start polling for status updates
    pollInterval = setInterval(updateUI, 2000);
    updateUI(); // Initial update
});

// Update UI based on session status
function updateUI() {
    fetch('/api/host/status')
        .then(res => res.json())
        .then(data => {
            const status = data.status;
            const statusBadge = document.getElementById('session-status');
            const startBtn = document.getElementById('start-btn');
            const endBtn = document.getElementById('end-btn');
            const resetBtn = document.getElementById('reset-btn');
            const resultsSection = document.getElementById('results-section');
            
            // Update status badge
            statusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            statusBadge.className = 'status-badge ' + status;
            
            // Update buttons
            if (status === 'waiting') {
                startBtn.classList.remove('hidden');
                endBtn.classList.add('hidden');
                resetBtn.classList.add('hidden');
                resultsSection.classList.add('hidden');
            } else if (status === 'voting') {
                startBtn.classList.add('hidden');
                endBtn.classList.remove('hidden');
                resetBtn.classList.add('hidden');
                resultsSection.classList.add('hidden');
            } else if (status === 'ended') {
                startBtn.classList.add('hidden');
                endBtn.classList.add('hidden');
                resetBtn.classList.remove('hidden');
                resultsSection.classList.remove('hidden');
                
                // Display vote distribution chart instead of individual votes
                if (data.voteDistribution) {
                    displayVoteDistribution(data.voteDistribution);
                }
            }
            
            // Always show all users
            if (data.allUsers) {
                displayAllUsers(data.allUsers, status);
            }
        })
        .catch(error => {
            console.error('Failed to update UI:', error);
        });
}

function displayVoteDistribution(voteDistribution) {
    const resultsList = document.getElementById('host-results-list');
    if (!resultsList) return;
    
    resultsList.innerHTML = '';
    
    const votes = Object.keys(voteDistribution).sort((a, b) => {
        if (a === '?') return 1;
        if (b === '?') return -1;
        return parseInt(a) - parseInt(b);
    });
    
    if (votes.length === 0) {
        resultsList.innerHTML = '<p style="text-align: center; color: #666;">No votes recorded</p>';
        return;
    }
    
    const maxCount = Math.max(...Object.values(voteDistribution));
    
    votes.forEach(vote => {
        const count = voteDistribution[vote];
        const percentage = (count / maxCount) * 100;
        
        const item = document.createElement('div');
        item.className = 'vote-distribution-item';
        item.innerHTML = `
            <div class="vote-label">${vote}</div>
            <div class="vote-bar-container">
                <div class="vote-bar" style="width: ${percentage}%"></div>
            </div>
            <div class="vote-count">${count}</div>
        `;
        resultsList.appendChild(item);
    });
}

// Display all users for host
function displayAllUsers(users, sessionStatus) {
    // Create or update users display section
    let usersSection = document.getElementById('host-users-section');
    if (!usersSection) {
        usersSection = document.createElement('div');
        usersSection.id = 'host-users-section';
        usersSection.className = 'host-users-section';
        usersSection.innerHTML = '<h3>All Users (<span id="host-users-count">0</span>)</h3><div id="host-users-list" class="users-list"></div>';
        const controlsSection = document.querySelector('.controls-section');
        controlsSection.parentNode.insertBefore(usersSection, controlsSection.nextSibling);
    }
    
    const usersList = document.getElementById('host-users-list');
    const usersCount = document.getElementById('host-users-count');
    
    if (usersCount) {
        usersCount.textContent = users.length;
    }
    
    usersList.innerHTML = '';
    
    if (users.length === 0) {
        usersList.innerHTML = '<p style="text-align: center; color: #999; font-style: italic;">No users joined yet</p>';
        return;
    }
    
    users.forEach(user => {
        const badge = document.createElement('div');
        badge.className = user.hasVoted ? 'user-badge user-badge-voted' : 'user-badge';
        badge.textContent = user.nickname;
        if (user.hasVoted) {
            badge.title = 'Has voted';
        }
        usersList.appendChild(badge);
    });
}
