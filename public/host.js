// Check authentication
const hostSessionId = sessionStorage.getItem('hostSessionId');
if (!hostSessionId || !sessionStorage.getItem('hostAuthenticated')) {
    window.location.href = 'login.html';
}

// Initialize connection status
ConnectionStatus.init();

// Get host session ID for API calls
function getHostHeaders() {
    return {
        'x-host-session-id': hostSessionId
    };
}

// Logout function
async function hostLogout() {
    try {
        await apiRequest('/api/host/logout', {
            method: 'POST',
            headers: getHostHeaders()
        });
        sessionStorage.removeItem('hostSessionId');
        sessionStorage.removeItem('hostAuthenticated');
        Toast.success('Logged out successfully');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 500);
    } catch (error) {
        Toast.error('Failed to logout');
    }
}

// Add logout button if it doesn't exist
document.addEventListener('DOMContentLoaded', () => {
    const controlsSection = document.querySelector('.controls-section');
    if (controlsSection && !document.getElementById('logout-btn')) {
        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'logout-btn';
        logoutBtn.className = 'btn btn-secondary';
        logoutBtn.textContent = 'Logout';
        logoutBtn.addEventListener('click', hostLogout);
        controlsSection.appendChild(logoutBtn);
    }
});

let lastStatus = null;

// Control buttons
document.getElementById('start-btn').addEventListener('click', async () => {
    LoadingState.show('start-btn', 'Starting...');
    try {
        const response = await apiRequest('/api/host/start', {
            method: 'POST',
            headers: getHostHeaders()
        });
        const data = await response.json();
        if (data.success) {
            Toast.success('Voting started');
            updateUI();
        } else {
            Toast.error(data.error || 'Failed to start voting');
        }
    } catch (error) {
        Toast.error('Failed to start voting. Please try again.');
    } finally {
        LoadingState.hide('start-btn');
    }
});

document.getElementById('end-btn').addEventListener('click', async () => {
    LoadingState.show('end-btn', 'Ending...');
    try {
        const response = await apiRequest('/api/host/end', {
            method: 'POST',
            headers: getHostHeaders()
        });
        const data = await response.json();
        if (data.success) {
            Toast.success('Voting ended');
            updateUI();
        } else {
            Toast.error(data.error || 'Failed to end voting');
        }
    } catch (error) {
        Toast.error('Failed to end voting. Please try again.');
    } finally {
        LoadingState.hide('end-btn');
    }
});

document.getElementById('reset-btn').addEventListener('click', async () => {
    LoadingState.show('reset-btn', 'Resetting...');
    try {
        const response = await apiRequest('/api/host/reset', {
            method: 'POST',
            headers: getHostHeaders()
        });
        const data = await response.json();
        if (data.success) {
            Toast.info('Session reset for next story');
            updateUI();
        } else {
            Toast.error(data.error || 'Failed to reset');
        }
    } catch (error) {
        Toast.error('Failed to reset. Please try again.');
    } finally {
        LoadingState.hide('reset-btn');
    }
});

// Update UI based on session status
function updateUI() {
    apiRequest('/api/host/status', {
        headers: getHostHeaders()
    })
        .then(res => res.json())
        .then(data => {
            const status = data.status;
            const statusBadge = document.getElementById('session-status');
            const startBtn = document.getElementById('start-btn');
            const endBtn = document.getElementById('end-btn');
            const resetBtn = document.getElementById('reset-btn');
            const resultsSection = document.getElementById('results-section');
            
            // Check for status changes
            if (lastStatus && lastStatus !== status) {
                if (status === 'voting') {
                    Toast.info('Voting status changed to active');
                } else if (status === 'ended') {
                    Toast.info('Voting status changed to ended');
                }
            }
            lastStatus = status;
            
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
        })
        .catch(error => {
            console.error('Failed to update UI:', error);
            // Check if it's an auth error
            if (error.message && error.message.includes('401')) {
                Toast.error('Session expired. Please login again.');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            }
        });
}

function displayResults(votes) {
    const resultsList = document.getElementById('host-results-list');
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

// Start adaptive polling for status updates
PollingManager.start(updateUI);

// Initial update
updateUI();
