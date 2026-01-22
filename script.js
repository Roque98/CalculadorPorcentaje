// Constants
const ACCOUNTS = [1, 2, 3];
const STORAGE_KEY = 'claude_usage_data';
const X2_MODE_KEY = 'claude_x2_mode';
const HISTORY_KEY = 'claude_usage_history';
const NAMES_KEY = 'claude_account_names';
const RESET_DATES_KEY = 'claude_reset_dates';
let lastSavedValues = {};
let accountNames = {
    account1: 'Cuenta 1',
    account2: 'Cuenta 2',
    account3: 'Cuenta 3'
};
let autoSaveTimeout = null;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    loadAccountNames();
    loadData();
    loadX2Mode();
    setupEventListeners();
    updateAllAccounts();
    initializeLastSavedValues();

    // Load and initialize reset dates
    ACCOUNTS.forEach(accountNum => {
        const resetData = getResetData(accountNum);
        if (resetData && resetData.resetDate) {
            document.getElementById(`resetDate${accountNum}`).value = resetData.resetDate;
        }
        if (resetData && resetData.needsUpdate) {
            applyNeedsUpdateStyling(accountNum);
        }
    });

    // Initialize time remaining metrics
    updateAllTimeMetrics();

    // Check for pending resets
    checkAndProcessResets();

    // Set up periodic reset check (every 5 minutes)
    setInterval(checkAndProcessResets, 5 * 60 * 1000);

    // Update time metrics every minute
    setInterval(updateAllTimeMetrics, 60 * 1000);
});

// Setup event listeners
function setupEventListeners() {
    ACCOUNTS.forEach(accountNum => {
        const input = document.getElementById(`usage${accountNum}`);
        input.addEventListener('input', () => updateAccount(accountNum));
    });

    document.getElementById('saveBtn').addEventListener('click', saveData);
    document.getElementById('resetBtn').addEventListener('click', resetAll);
    document.getElementById('x2Toggle').addEventListener('change', toggleX2Mode);
}

// Update individual account
function updateAccount(accountNum) {
    const input = document.getElementById(`usage${accountNum}`);
    let usage = parseFloat(input.value) || 0;

    // Check if x2 mode is active
    const isX2Mode = document.body.classList.contains('x2-mode');
    const maxUsage = isX2Mode ? 200 : 100;

    // Validate input
    if (usage < 0) usage = 0;
    if (usage > maxUsage) usage = maxUsage;
    input.value = usage;

    const remaining = 100 - usage;

    // Update progress bar
    const progressFill = document.getElementById(`progress${accountNum}`);
    // In x2 mode, scale to 200%, otherwise 100%
    const visualWidth = isX2Mode ? (usage / 200 * 100) : Math.min(usage, 100);
    progressFill.style.width = `${visualWidth}%`;

    // Update gradient based on usage - thresholds adapt to x2 mode
    const threshold1 = isX2Mode ? 100 : 50;  // Green threshold
    const threshold2 = isX2Mode ? 160 : 80;  // Yellow threshold
    const threshold3 = isX2Mode ? 200 : 100; // Red threshold

    if (usage < threshold1) {
        progressFill.style.background = 'linear-gradient(90deg, #10b981, #059669)';
    } else if (usage < threshold2) {
        progressFill.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
    } else {
        progressFill.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
    }

    // Update labels
    document.getElementById(`used${accountNum}`).textContent = `${usage}%`;
    document.getElementById(`remaining${accountNum}`).textContent = `${remaining}%`;

    // Update status badge - adapt to x2 mode
    const status = document.getElementById(`status${accountNum}`);
    const exceedThreshold = isX2Mode ? 200 : 100;

    if (usage > exceedThreshold) {
        status.textContent = 'Excedido';
        status.className = 'account-status danger';
    } else if (remaining > 50) {
        status.textContent = 'Disponible';
        status.className = 'account-status';
    } else if (remaining > 20) {
        status.textContent = 'Moderado';
        status.className = 'account-status warning';
    } else if (remaining >= 0) {
        status.textContent = 'Crítico';
        status.className = 'account-status danger';
    } else {
        status.textContent = 'Excedido';
        status.className = 'account-status danger';
    }

    // Update remaining text
    const remainingText = document.getElementById(`remainingText${accountNum}`);
    if (remaining < 0) {
        remainingText.textContent = `Excedido por ${Math.abs(remaining)}%`;
        remainingText.className = 'remaining-text danger';
    } else {
        remainingText.textContent = `${remaining}% disponible`;
        if (remaining > 50) {
            remainingText.className = 'remaining-text';
        } else if (remaining > 20) {
            remainingText.className = 'remaining-text warning';
        } else {
            remainingText.className = 'remaining-text danger';
        }
    }

    // Update x2 mode indicators
    updateX2Indicators(accountNum, usage, remaining);

    // Update overview stats
    updateOverviewStats();

    // Update time metrics (including balance)
    updateTimeRemainingMetric(accountNum);

    // Trigger debounced auto-save
    debouncedAutoSave();
}

// Update x2 mode indicators
function updateX2Indicators(accountNum, usage, remaining) {
    // With x2 limit, the actual usage is half of the normal limit
    // Example: 50% usage on normal limit = 25% usage on x2 limit
    const usageX2 = usage / 2;
    const remainingX2 = 100 - usageX2;

    // Update x2 labels
    document.getElementById(`usedX2${accountNum}`).textContent = `${usageX2.toFixed(1)}%`;
    document.getElementById(`remainingX2${accountNum}`).textContent = `${remainingX2.toFixed(1)}%`;

    // Update x2 remaining text
    const remainingTextX2 = document.getElementById(`remainingTextX2${accountNum}`);
    if (remainingX2 < 0) {
        remainingTextX2.textContent = `Excedido por ${Math.abs(remainingX2).toFixed(1)}% (con límite x2)`;
        remainingTextX2.className = 'remaining-text-x2 danger';
    } else {
        remainingTextX2.textContent = `${remainingX2.toFixed(1)}% disponible (con límite x2)`;
        if (remainingX2 > 75) {
            remainingTextX2.className = 'remaining-text-x2';
        } else if (remainingX2 > 50) {
            remainingTextX2.className = 'remaining-text-x2 warning';
        } else {
            remainingTextX2.className = 'remaining-text-x2 danger';
        }
    }
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
    const bestAccountText = `${getAccountName(bestAccountIndex + 1)} (${maxRemaining.toFixed(0)}%)`;
    document.getElementById('bestAccount').textContent = bestAccountText;

    // Average remaining
    const avgRemaining = totalRemaining / ACCOUNTS.length;
    document.getElementById('averageRemaining').textContent = `${avgRemaining.toFixed(1)}%`;

    // Update x2 mode stats
    const usagesX2 = usages.map(usage => usage / 2);
    const remainingsX2 = usagesX2.map(usage => 100 - usage);

    // Total available x2
    const totalRemainingX2 = remainingsX2.reduce((sum, val) => sum + val, 0);
    document.getElementById('totalAvailableX2').textContent = `${totalRemainingX2.toFixed(0)}%`;

    // Best account x2
    const maxRemainingX2 = Math.max(...remainingsX2);
    const bestAccountIndexX2 = remainingsX2.indexOf(maxRemainingX2);
    const bestAccountTextX2 = `${getAccountName(bestAccountIndexX2 + 1)} (${maxRemainingX2.toFixed(1)}%)`;
    document.getElementById('bestAccountX2').textContent = bestAccountTextX2;

    // Average remaining x2
    const avgRemainingX2 = totalRemainingX2 / ACCOUNTS.length;
    document.getElementById('averageRemainingX2').textContent = `${avgRemainingX2.toFixed(1)}%`;
}

// Save data to localStorage
function saveData() {
    const data = {};
    ACCOUNTS.forEach(accountNum => {
        const usage = document.getElementById(`usage${accountNum}`).value;
        data[`account${accountNum}`] = usage;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Save to history if values changed
    saveToHistory(data);

    // Show feedback
    showNotification('Datos guardados correctamente', 'success');
}

// Initialize last saved values
function initializeLastSavedValues() {
    ACCOUNTS.forEach(accountNum => {
        const usage = document.getElementById(`usage${accountNum}`).value;
        lastSavedValues[`account${accountNum}`] = usage;
    });
}

// Check if values have changed
function hasValuesChanged(newData) {
    for (let key in newData) {
        if (newData[key] !== lastSavedValues[key]) {
            return true;
        }
    }
    return false;
}

// Save to history only if values changed
function saveToHistory(data) {
    if (!hasValuesChanged(data)) {
        return; // No changes, don't save
    }

    // Update last saved values
    lastSavedValues = {...data};

    // Get existing history
    let history = [];
    const savedHistory = localStorage.getItem(HISTORY_KEY);
    if (savedHistory) {
        try {
            history = JSON.parse(savedHistory);
        } catch (error) {
            console.error('Error loading history:', error);
            history = [];
        }
    }

    // Create new data point
    const dataPoint = {
        timestamp: new Date().toISOString(),
        account1: parseFloat(data.account1) || 0,
        account2: parseFloat(data.account2) || 0,
        account3: parseFloat(data.account3) || 0
    };

    // Add to history
    history.push(dataPoint);

    // Save history
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
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

// Load reset dates from localStorage
function loadResetDates() {
    const savedDates = localStorage.getItem(RESET_DATES_KEY);
    if (savedDates) {
        try {
            return JSON.parse(savedDates);
        } catch (error) {
            console.error('Error loading reset dates:', error);
            return {};
        }
    }
    return {};
}

// Save reset dates to localStorage
function saveResetDates(resetDates) {
    localStorage.setItem(RESET_DATES_KEY, JSON.stringify(resetDates));
}

// Get reset data for a specific account
function getResetData(accountNum) {
    const resetDates = loadResetDates();
    const accountKey = `account${accountNum}`;
    return resetDates[accountKey] || { resetDate: null, needsUpdate: false };
}

// Set needsUpdate flag for a specific account
function setResetDataNeedsUpdate(accountNum, value) {
    const resetDates = loadResetDates();
    const accountKey = `account${accountNum}`;
    if (!resetDates[accountKey]) {
        resetDates[accountKey] = { resetDate: null, needsUpdate: false };
    }
    resetDates[accountKey].needsUpdate = value;
    saveResetDates(resetDates);
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

// Check and process automatic resets
function checkAndProcessResets() {
    const resetDates = loadResetDates();
    const now = new Date();

    ACCOUNTS.forEach(accountNum => {
        const accountKey = `account${accountNum}`;
        const resetData = resetDates[accountKey];

        if (!resetData || !resetData.resetDate || resetData.needsUpdate) {
            return; // Skip if no date set or already needs update
        }

        const resetDate = new Date(resetData.resetDate);

        if (now >= resetDate) {
            performAutoReset(accountNum);
        }
    });
}

// Perform automatic reset for an account
function performAutoReset(accountNum) {
    // 1. Reset usage to 0
    const usageInput = document.getElementById(`usage${accountNum}`);
    usageInput.value = 0;
    updateAccount(accountNum);

    // 2. Mark as needing update
    setResetDataNeedsUpdate(accountNum, true);

    // 3. Apply visual styling
    applyNeedsUpdateStyling(accountNum);

    // 4. Save data (triggers history save)
    saveData();

    // 5. Notify user
    const accountName = getAccountName(accountNum);
    showNotification(
        `${accountName} reiniciada automáticamente. Por favor, selecciona una nueva fecha de reinicio.`,
        'warning'
    );
}

// Handle reset date change event
function onResetDateChange(accountNum) {
    const dateInput = document.getElementById(`resetDate${accountNum}`);
    const selectedDate = dateInput.value;
    const usage = parseFloat(document.getElementById(`usage${accountNum}`).value) || 0;

    // Load current reset dates
    const resetDates = loadResetDates();
    const accountKey = `account${accountNum}`;

    if (!selectedDate) {
        // Date cleared
        delete resetDates[accountKey];
        saveResetDates(resetDates);
        removeNeedsUpdateStyling(accountNum);
        updateTimeRemainingMetric(accountNum);
        return;
    }

    // Validate future date
    const now = new Date();
    const resetDate = new Date(selectedDate);

    if (resetDate <= now) {
        showNotification('Por favor selecciona una fecha y hora futura', 'error');
        dateInput.value = '';
        return;
    }

    // Save reset date
    if (!resetDates[accountKey]) {
        resetDates[accountKey] = {};
    }

    resetDates[accountKey].resetDate = selectedDate;

    // Check if we should clear the needs-update flag
    if (usage === 0 && resetDates[accountKey].needsUpdate) {
        resetDates[accountKey].needsUpdate = false;
        removeNeedsUpdateStyling(accountNum);
        showNotification('Fecha de reinicio actualizada correctamente', 'success');
    }

    saveResetDates(resetDates);
    updateTimeRemainingMetric(accountNum);
}

// Apply needs-update styling to an account card
function applyNeedsUpdateStyling(accountNum) {
    const card = document.getElementById(`usage${accountNum}`).closest('.account-card');
    const dateGroup = card.querySelector('.reset-date-group');
    const dateHelper = document.getElementById(`dateHelper${accountNum}`);

    if (card) {
        card.classList.add('needs-reset-date');
    }
    if (dateGroup) {
        dateGroup.classList.add('needs-update');
    }
    if (dateHelper) {
        dateHelper.classList.add('warning');
        dateHelper.textContent = '¡Atención! Selecciona una nueva fecha de reinicio';
    }
}

// Remove needs-update styling from an account card
function removeNeedsUpdateStyling(accountNum) {
    const card = document.getElementById(`usage${accountNum}`).closest('.account-card');
    const dateGroup = card.querySelector('.reset-date-group');
    const dateHelper = document.getElementById(`dateHelper${accountNum}`);

    if (card) {
        card.classList.remove('needs-reset-date');
    }
    if (dateGroup) {
        dateGroup.classList.remove('needs-update');
    }
    if (dateHelper) {
        dateHelper.classList.remove('warning');
        dateHelper.textContent = 'La cuenta se reiniciará automáticamente en esta fecha y hora';
    }
}

// Update time remaining percentage metric and usage balance
function updateTimeRemainingMetric(accountNum) {
    const timeUsedElement = document.getElementById(`timeUsed${accountNum}`);
    const usageBalanceElement = document.getElementById(`usageBalance${accountNum}`);
    const progressFillElement = document.getElementById(`timeProgressFill${accountNum}`);

    if (!timeUsedElement || !usageBalanceElement || !progressFillElement) return;

    const resetData = getResetData(accountNum);

    if (!resetData || !resetData.resetDate) {
        timeUsedElement.textContent = '--';
        usageBalanceElement.textContent = '--';
        timeUsedElement.className = 'time-metric-value used';
        usageBalanceElement.className = 'time-metric-value balance';
        progressFillElement.style.width = '0%';
        progressFillElement.className = 'time-progress-fill';
        return;
    }

    const now = new Date();
    const resetDate = new Date(resetData.resetDate);

    // Calculate start date as 7 days before reset date
    const PERIOD_DAYS = 7;
    const startDate = new Date(resetDate.getTime() - (PERIOD_DAYS * 24 * 60 * 60 * 1000));

    // Calculate total period (7 days) and time elapsed in milliseconds
    const totalPeriod = resetDate - startDate;
    const timeElapsed = now - startDate;

    // Calculate time percentage used (expected usage based on time)
    let percentageTimeUsed = (timeElapsed / totalPeriod) * 100;
    percentageTimeUsed = Math.max(0, Math.min(100, percentageTimeUsed));

    // Get actual usage from input
    const usageInput = document.getElementById(`usage${accountNum}`);
    const actualUsage = parseFloat(usageInput.value) || 0;

    // Calculate usage balance: actual usage - expected usage
    // Positive = overusing, Negative = underusing/wasting
    const usageBalance = actualUsage - percentageTimeUsed;

    // Update time used display
    timeUsedElement.textContent = `${Math.round(percentageTimeUsed)}%`;

    // Update balance display with sign
    const balanceSign = usageBalance >= 0 ? '+' : '';
    usageBalanceElement.textContent = `${balanceSign}${Math.round(usageBalance)}%`;

    // Define tolerance zones
    const TOLERANCE_GREEN = 10;   // ±10%
    const TOLERANCE_YELLOW = 20;  // ±20%

    // Apply color coding based on balance and tolerance
    const absBalance = Math.abs(usageBalance);

    if (absBalance <= TOLERANCE_GREEN) {
        // Within tolerance - Green
        usageBalanceElement.className = 'time-metric-value balance success';
        progressFillElement.className = 'time-progress-fill success';
    } else if (absBalance <= TOLERANCE_YELLOW) {
        // Moderate deviation - Yellow
        usageBalanceElement.className = 'time-metric-value balance warning';
        progressFillElement.className = 'time-progress-fill warning';
    } else {
        // High deviation - Red
        usageBalanceElement.className = 'time-metric-value balance danger';
        progressFillElement.className = 'time-progress-fill danger';
    }

    // Update progress bar width to show actual time used
    progressFillElement.style.width = `${percentageTimeUsed}%`;

    // Apply color coding to time used value
    if (percentageTimeUsed < 50) {
        timeUsedElement.className = 'time-metric-value used success';
    } else if (percentageTimeUsed < 75) {
        timeUsedElement.className = 'time-metric-value used warning';
    } else {
        timeUsedElement.className = 'time-metric-value used danger';
    }
}

// Update all time remaining metrics
function updateAllTimeMetrics() {
    ACCOUNTS.forEach(accountNum => {
        updateTimeRemainingMetric(accountNum);
    });
}

// Toggle x2 mode
function toggleX2Mode(event) {
    const isX2Mode = event.target.checked;

    if (isX2Mode) {
        document.body.classList.add('x2-mode');
        // Update input max to 200 and placeholder
        ACCOUNTS.forEach(num => {
            const input = document.getElementById(`usage${num}`);
            input.setAttribute('max', '200');
            input.setAttribute('placeholder', '0-200');
        });
        showNotification('Modo límite x2 activado - Máximo 200%', 'success');
    } else {
        document.body.classList.remove('x2-mode');
        // Update input max back to 100 and placeholder
        ACCOUNTS.forEach(num => {
            const input = document.getElementById(`usage${num}`);
            input.setAttribute('max', '100');
            input.setAttribute('placeholder', '0');
            // If current value is over 100, reset it
            if (parseFloat(input.value) > 100) {
                input.value = 100;
                updateAccount(num);
            }
        });
        showNotification('Modo límite normal activado - Máximo 100%', 'success');
    }

    // Save preference
    localStorage.setItem(X2_MODE_KEY, isX2Mode);
}

// Load x2 mode preference
function loadX2Mode() {
    const savedX2Mode = localStorage.getItem(X2_MODE_KEY);
    const isX2Mode = savedX2Mode === 'true';

    const toggle = document.getElementById('x2Toggle');
    toggle.checked = isX2Mode;

    if (isX2Mode) {
        document.body.classList.add('x2-mode');
        // Set input max to 200 and placeholder
        ACCOUNTS.forEach(num => {
            const input = document.getElementById(`usage${num}`);
            input.setAttribute('max', '200');
            input.setAttribute('placeholder', '0-200');
        });
    }
}

// Load account names
function loadAccountNames() {
    const savedNames = localStorage.getItem(NAMES_KEY);
    if (savedNames) {
        try {
            accountNames = JSON.parse(savedNames);
        } catch (error) {
            console.error('Error loading account names:', error);
        }
    }

    // Update UI with loaded names
    ACCOUNTS.forEach(num => {
        const nameElement = document.getElementById(`accountName${num}`);
        if (nameElement) {
            nameElement.textContent = accountNames[`account${num}`];
        }
    });
}

// Save account names
function saveAccountNames() {
    localStorage.setItem(NAMES_KEY, JSON.stringify(accountNames));
}

// Edit account name
function editAccountName(accountNum) {
    const currentName = accountNames[`account${accountNum}`];
    const newName = prompt(`Ingresa un nuevo nombre para ${currentName}:`, currentName);

    if (newName && newName.trim() !== '') {
        accountNames[`account${accountNum}`] = newName.trim();
        saveAccountNames();

        // Update UI
        document.getElementById(`accountName${accountNum}`).textContent = newName.trim();

        // Update overview stats
        updateOverviewStats();

        showNotification('Nombre actualizado correctamente', 'success');
    }
}

// Get account name
function getAccountName(accountNum) {
    return accountNames[`account${accountNum}`] || `Cuenta ${accountNum}`;
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

// Debounced auto-save function
function debouncedAutoSave() {
    // Clear existing timeout
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
    }

    // Set new timeout - save after 3 seconds of no changes
    autoSaveTimeout = setTimeout(() => {
        const hasData = ACCOUNTS.some(num => {
            const value = document.getElementById(`usage${num}`).value;
            return value && parseFloat(value) > 0;
        });

        if (hasData) {
            saveData();
        }
    }, 3000); // Wait 3 seconds after last change
}
