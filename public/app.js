let userId = null;
let nickname = null;
let currentVote = null;
let pollInterval = null;

// Host login form
document.getElementById('host-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('host-password-input').value;
    const errorDiv = document.getElementById('host-login-error');

    try {
        const response = await fetch('/api/host/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await response.json();
        if (response.ok) {
            sessionStorage.setItem('hostAuthenticated', 'true');
            window.location.href = 'host.html';
        } else {
            errorDiv.textContent = data.error || 'Invalid password';
            errorDiv.classList.remove('hidden');
        }
    } catch (error) {
        errorDiv.textContent = 'Connection error. Please try again.';
        errorDiv.classList.remove('hidden');
    }
});

// Join session
document.getElementById('join-btn').addEventListener('click', async () => {
    try {
        const response = await fetch('/api/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        
        userId = data.userId;
        nickname = data.nickname;
        
        document.getElementById('join-screen').classList.add('hidden');
        document.getElementById('voting-screen').classList.remove('hidden');
        document.getElementById('nickname-display').textContent = nickname;
        
        // Start polling
        startPolling();
    } catch (error) {
        console.error('Failed to join:', error);
        alert('Failed to join session. Please refresh and try again.');
    }
});

// Card selection
document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', async () => {
        if (!userId) return;
        
        const vote = card.dataset.vote;
        
        // Update UI
        document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        currentVote = vote;
        
        // Update vote display
        document.getElementById('vote-display').textContent = `You voted: ${vote}`;
        
        // Submit vote
        try {
            await fetch('/api/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, vote })
            });
        } catch (error) {
            console.error('Failed to submit vote:', error);
        }
    });
});

// Polling function
function startPolling() {
    // Update users and vote count immediately
    updateUsersList();
    updateVoteCount();
    
    pollInterval = setInterval(async () => {
        try {
            // Get session status
            const sessionResponse = await fetch('/api/session');
            const sessionData = await sessionResponse.json();
            
            const status = sessionData.status;
            const statusMessage = document.getElementById('status-message');
            const votingArea = document.getElementById('voting-area');
            const resultsScreen = document.getElementById('results-screen');
            
            if (status === 'waiting') {
                statusMessage.textContent = 'Waiting for voting to start...';
                votingArea.classList.add('hidden');
                resultsScreen.classList.add('hidden');
            } else if (status === 'voting') {
                statusMessage.textContent = 'Voting in progress...';
                votingArea.classList.remove('hidden');
                resultsScreen.classList.add('hidden');
            } else if (status === 'ended') {
                statusMessage.textContent = 'Voting ended - Waiting for next story...';
                votingArea.classList.add('hidden');
                resultsScreen.classList.add('hidden');
                // Users don't see results - only host sees the bar chart
            }
            
            // Update users list and vote count
            updateUsersList();
            updateVoteCount();
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 2000); // Poll every 2 seconds
}

// Update users list
async function updateUsersList() {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        displayUsers(data.users || []);
    } catch (error) {
        console.error('Failed to get users:', error);
    }
}

// Update vote count
async function updateVoteCount() {
    try {
        const response = await fetch('/api/vote-count');
        const data = await response.json();
        
        if (data.total && data.total > 0) {
            const voteCountDisplay = document.getElementById('vote-count-display');
            if (voteCountDisplay) {
                voteCountDisplay.textContent = `${data.voted}/${data.total} voted`;
                voteCountDisplay.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Failed to get vote count:', error);
    }
}

// Display users
function displayUsers(users) {
    const usersList = document.getElementById('users-list');
    if (!usersList) return;
    
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
