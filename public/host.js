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
        })
        .catch(error => {
            console.error('Failed to update UI:', error);
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
