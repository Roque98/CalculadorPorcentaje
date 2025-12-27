// Constants
const ACCOUNTS = [1, 2, 3];
const STORAGE_KEY = 'claude_usage_data';

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
    updateAllAccounts();
});

// Setup event listeners
function setupEventListeners() {
    ACCOUNTS.forEach(accountNum => {
        const input = document.getElementById(`usage${accountNum}`);
        input.addEventListener('input', () => updateAccount(accountNum));
    });

    document.getElementById('saveBtn').addEventListener('click', saveData);
    document.getElementById('resetBtn').addEventListener('click', resetAll);
}

// Update individual account
function updateAccount(accountNum) {
    const input = document.getElementById(`usage${accountNum}`);
    let usage = parseFloat(input.value) || 0;

    // Validate input
    if (usage < 0) usage = 0;
    if (usage > 100) usage = 100;
    input.value = usage;

    const remaining = 100 - usage;

    // Update progress bar
    const progressFill = document.getElementById(`progress${accountNum}`);
    progressFill.style.width = `${usage}%`;

    // Update gradient based on usage
    if (usage < 50) {
        progressFill.style.background = 'linear-gradient(90deg, #10b981, #059669)';
    } else if (usage < 80) {
        progressFill.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
    } else {
        progressFill.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
    }

    // Update labels
    document.getElementById(`used${accountNum}`).textContent = `${usage}%`;
    document.getElementById(`remaining${accountNum}`).textContent = `${remaining}%`;

    // Update status badge
    const status = document.getElementById(`status${accountNum}`);
    if (remaining > 50) {
        status.textContent = 'Disponible';
        status.className = 'account-status';
    } else if (remaining > 20) {
        status.textContent = 'Moderado';
        status.className = 'account-status warning';
    } else {
        status.textContent = 'Crítico';
        status.className = 'account-status danger';
    }

    // Update remaining text
    const remainingText = document.getElementById(`remainingText${accountNum}`);
    remainingText.textContent = `${remaining}% disponible`;
    if (remaining > 50) {
        remainingText.className = 'remaining-text';
    } else if (remaining > 20) {
        remainingText.className = 'remaining-text warning';
    } else {
        remainingText.className = 'remaining-text danger';
    }

    // Update overview stats
    updateOverviewStats();
}

// Update all accounts
function updateAllAccounts() {
    ACCOUNTS.forEach(accountNum => updateAccount(accountNum));
}

// Update overview statistics
function updateOverviewStats() {
    const usages = ACCOUNTS.map(num => parseFloat(document.getElementById(`usage${num}`).value) || 0);
    const remainings = usages.map(usage => 100 - usage);

    // Total available
    const totalRemaining = remainings.reduce((sum, val) => sum + val, 0);
    document.getElementById('totalAvailable').textContent = `${totalRemaining.toFixed(0)}%`;

    // Best account (highest remaining)
    const maxRemaining = Math.max(...remainings);
    const bestAccountIndex = remainings.indexOf(maxRemaining);
    const bestAccountText = `Cuenta ${bestAccountIndex + 1} (${maxRemaining.toFixed(0)}%)`;
    document.getElementById('bestAccount').textContent = bestAccountText;

    // Average remaining
    const avgRemaining = totalRemaining / ACCOUNTS.length;
    document.getElementById('averageRemaining').textContent = `${avgRemaining.toFixed(1)}%`;
}

// Save data to localStorage
function saveData() {
    const data = {};
    ACCOUNTS.forEach(accountNum => {
        const usage = document.getElementById(`usage${accountNum}`).value;
        data[`account${accountNum}`] = usage;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Show feedback
    showNotification('Datos guardados correctamente', 'success');
}

// Load data from localStorage
function loadData() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            ACCOUNTS.forEach(accountNum => {
                const value = data[`account${accountNum}`];
                if (value !== undefined) {
                    document.getElementById(`usage${accountNum}`).value = value;
                }
            });
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }
}

// Reset all data
function resetAll() {
    if (confirm('¿Estás seguro de que quieres resetear todos los datos?')) {
        ACCOUNTS.forEach(accountNum => {
            document.getElementById(`usage${accountNum}`).value = 0;
            updateAccount(accountNum);
        });
        localStorage.removeItem(STORAGE_KEY);
        showNotification('Datos reseteados correctamente', 'success');
    }
}

// Show notification (simple version)
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 2rem;
        right: 2rem;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        padding: 1rem 2rem;
        border-radius: 12px;
        font-weight: 600;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Auto-save every 30 seconds
setInterval(() => {
    const hasData = ACCOUNTS.some(num => {
        const value = document.getElementById(`usage${num}`).value;
        return value && parseFloat(value) > 0;
    });

    if (hasData) {
        saveData();
    }
}, 30000);
