// Utilities are loaded via script tag before this file

let userId = null;
let nickname = null;
let currentVote = null;
let lastSessionStatus = null;
let lastVoteCount = { total: 0, voted: 0 };

// Initialize connection status
ConnectionStatus.init();

// Host login form
document.getElementById('host-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('host-password-input').value;
    const errorDiv = document.getElementById('host-login-error');
    LoadingState.show('host-login-form', 'Logging in...');

    try {
        const response = await apiRequest('/api/host/login', {
            method: 'POST',
            body: JSON.stringify({ password })
        });

        const data = await response.json();
        if (response.ok) {
            sessionStorage.setItem('hostSessionId', data.sessionId);
            sessionStorage.setItem('hostAuthenticated', 'true');
            Toast.success('Login successful');
            setTimeout(() => {
                window.location.href = 'host.html';
            }, 500);
        } else {
            errorDiv.textContent = data.error || 'Invalid password';
            errorDiv.classList.remove('hidden');
            Toast.error(data.error || 'Invalid password');
        }
    } catch (error) {
        const errorMsg = 'Connection error. Please try again.';
        errorDiv.textContent = errorMsg;
        errorDiv.classList.remove('hidden');
        Toast.error(errorMsg);
    } finally {
        LoadingState.hide('host-login-form');
    }
});

// Join session
document.getElementById('join-btn').addEventListener('click', async () => {
    LoadingState.show('join-btn', 'Joining...');
    
    try {
        // Check if user already exists
        const existingUserId = sessionStorage.getItem('userId');
        const response = await apiRequest('/api/join', {
            method: 'POST',
            body: JSON.stringify(existingUserId ? { userId: existingUserId } : {})
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to join session');
        }

        const data = await response.json();
        
        userId = data.userId;
        nickname = data.nickname;
        sessionStorage.setItem('userId', userId);
        
        document.getElementById('join-screen').classList.add('hidden');
        document.getElementById('voting-screen').classList.remove('hidden');
        document.getElementById('nickname-display').textContent = nickname;
        
        Toast.success(`Joined as ${nickname}`);
        
        // Start polling
        startPolling();
    } catch (error) {
        console.error('Failed to join:', error);
        Toast.error(error.message || 'Failed to join session. Please try again.');
    } finally {
        LoadingState.hide('join-btn');
    }
});

// Restore user session if exists
window.addEventListener('DOMContentLoaded', () => {
    const savedUserId = sessionStorage.getItem('userId');
    if (savedUserId) {
        userId = savedUserId;
        // Optionally try to rejoin or show a message
    }
});

// Handle page unload - leave session
window.addEventListener('beforeunload', () => {
    if (userId) {
        // Use sendBeacon for reliable delivery
        navigator.sendBeacon('/api/leave', JSON.stringify({ userId }));
    }
});

// Card selection
document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', async () => {
        if (!userId) return;
        
        const vote = card.dataset.vote;
        
        // Update UI immediately
        document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        currentVote = vote;
        
        // Update vote display
        document.getElementById('vote-display').textContent = `You voted: ${vote}`;
        
        // Submit vote
        LoadingState.show('vote-display', 'Submitting...');
        try {
            const response = await apiRequest('/api/vote', {
                method: 'POST',
                body: JSON.stringify({ userId, vote })
            });
            
            if (response.ok) {
                Toast.success('Vote submitted');
            } else {
                const errorData = await response.json();
                Toast.error(errorData.error || 'Failed to submit vote');
            }
        } catch (error) {
            Toast.error('Failed to submit vote. Please try again.');
        } finally {
            LoadingState.hide('vote-display');
        }
    });
});

// Polling function with adaptive frequency
function startPolling() {
    // Update users and vote count immediately
    updateUsersList();
    updateVoteCount();
    
    PollingManager.start(async () => {
        try {
            // Get session status
            const sessionResponse = await apiRequest('/api/session');
            const sessionData = await sessionResponse.json();
            
            const status = sessionData.status;
            const statusMessage = document.getElementById('status-message');
            const votingArea = document.getElementById('voting-area');
            const resultsScreen = document.getElementById('results-screen');
            
            // Check for status changes and show notifications
            if (lastSessionStatus && lastSessionStatus !== status) {
                if (status === 'voting') {
                    Toast.info('Voting has started!');
                } else if (status === 'ended') {
                    Toast.success('Voting has ended');
                } else if (status === 'waiting') {
                    Toast.info('Session reset');
                }
            }
            lastSessionStatus = status;
            
            if (status === 'waiting') {
                statusMessage.textContent = 'Waiting for voting to start...';
                votingArea.classList.add('hidden');
                resultsScreen.classList.add('hidden');
            } else if (status === 'voting') {
                statusMessage.textContent = 'Voting in progress...';
                votingArea.classList.remove('hidden');
                resultsScreen.classList.add('hidden');
            } else if (status === 'ended') {
                statusMessage.textContent = 'Voting ended';
                votingArea.classList.add('hidden');
                resultsScreen.classList.remove('hidden');
                
                // Get results
                const votesResponse = await apiRequest('/api/votes');
                const votesData = await votesResponse.json();
                displayResults(votesData.votes);
            }
            
            // Update users list and vote count
            updateUsersList();
            updateVoteCount();
        } catch (error) {
            console.error('Polling error:', error);
        }
    });
}

// Update users list
async function updateUsersList() {
    try {
        const response = await apiRequest('/api/users');
        const data = await response.json();
        displayUsers(data.users || []);
    } catch (error) {
        console.error('Failed to get users:', error);
    }
}

// Update vote count
async function updateVoteCount() {
    try {
        const response = await apiRequest('/api/vote-count');
        const data = await response.json();
        
        if (data.total && data.total > 0) {
            lastVoteCount = { total: data.total, voted: data.voted || 0 };
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
        usersList.innerHTML = '<p style="text-align: center; color: var(--text-tertiary); font-style: italic;">No users joined yet</p>';
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

function displayResults(votes) {
    const resultsList = document.getElementById('results-list');
    if (!resultsList) return;
    
    resultsList.innerHTML = '';
    
    if (votes.length === 0) {
        resultsList.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No votes recorded</p>';
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
