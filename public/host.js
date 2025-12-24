// Check authentication
if (!sessionStorage.getItem('hostAuthenticated')) {
    window.location.href = 'login.html';
}

let pollInterval = null;

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
            alert('All users cleared successfully');
            updateUI();
        }
    } catch (error) {
        console.error('Failed to clear users:', error);
        alert('Failed to clear users. Please try again.');
    }
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
                
                // Display results
                displayResults(data.votes);
            }
            
            // Always show all users if available
            if (data.allUsers && data.allUsers.length > 0) {
                displayAllUsers(data.allUsers, status);
            }
        })
        .catch(error => {
            console.error('Failed to update UI:', error);
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
        usersSection.innerHTML = '<h3>All Users (' + users.length + ')</h3><div id="host-users-list" class="users-list"></div>';
        const controlsSection = document.querySelector('.controls-section');
        controlsSection.parentNode.insertBefore(usersSection, controlsSection.nextSibling);
    } else {
        usersSection.querySelector('h3').textContent = 'All Users (' + users.length + ')';
    }
    
    const usersList = document.getElementById('host-users-list');
    usersList.innerHTML = '';
    
    users.forEach(user => {
        const badge = document.createElement('div');
        badge.className = 'user-badge';
        if (sessionStatus === 'voting' && user.current_vote !== null && user.current_vote !== undefined) {
            badge.classList.add('user-badge-voted');
            badge.textContent = user.nickname + ' (voted: ' + user.current_vote + ')';
        } else {
            badge.textContent = user.nickname;
        }
        usersList.appendChild(badge);
    });
}

function displayResults(votes) {
    const resultsList = document.getElementById('host-results-list');
    resultsList.innerHTML = '';
    
    if (votes.length === 0) {
        resultsList.innerHTML = '<p style="text-align: center; color: #666;">No votes recorded</p>';
        return;
    }
    
    votes.forEach(vote => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
            <span class="result-nickname">${vote.nickname}</span>
            <span class="result-vote">${vote.current_vote}</span>
        `;
        resultsList.appendChild(item);
    });
}

// Start polling for status updates
pollInterval = setInterval(updateUI, 2000);
updateUI(); // Initial update
