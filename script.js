// Constants
const ACCOUNTS = [1, 2, 3];
let lastSavedValues = {};
let accountNames = {
    account1: 'Cuenta 1',
    account2: 'Cuenta 2',
    account3: 'Cuenta 3'
};
let autoSaveTimeout = null;
let accountsChannel = null;
let settingsChannel = null;
let isX2Mode = false;

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const authenticated = await requireAuth();
    if (!authenticated) return;

    // Show loading
    showLoading(true);

    try {
        // Setup user UI
        await setupUserUI();

        // Load data from Supabase
        await loadAccountNames();
        await loadData();
        await loadX2Mode();

        setupEventListeners();
        updateAllAccounts();
        initializeLastSavedValues();

        // Load and initialize reset dates
        await loadResetDates();

        // Initialize time remaining metrics
        updateAllTimeMetrics();

        // Check for pending resets
        checkAndProcessResets();

        // Set up periodic reset check (every 5 minutes)
        setInterval(checkAndProcessResets, 5 * 60 * 1000);

        // Update time metrics every minute
        setInterval(updateAllTimeMetrics, 60 * 1000);

        // Setup realtime subscriptions
        setupRealtimeSubscriptions();

    } catch (error) {
        console.error('Error initializing app:', error);
        showNotification('Error al cargar datos', 'error');
    } finally {
        showLoading(false);
    }
});

// Setup user UI
async function setupUserUI() {
    const user = await getCurrentUser();
    if (user) {
        document.getElementById('userEmail').textContent = user.email;
    }

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await signOut();
        window.location.href = 'login.html';
    });

    setSyncStatus('synced');
}

// Setup realtime subscriptions
function setupRealtimeSubscriptions() {
    // Subscribe to account changes
    accountsChannel = subscribeToAccountChanges(async (payload) => {
        console.log('Account change received:', payload);
        setSyncStatus('syncing');

        if (payload.new && payload.new.account_number) {
            const accountNum = payload.new.account_number;
            const input = document.getElementById(`usage${accountNum}`);
            if (input && payload.new.usage_percent !== undefined) {
                input.value = payload.new.usage_percent;
                updateAccount(accountNum);
            }

            // Update reset date if changed
            if (payload.new.reset_date) {
                const dateInput = document.getElementById(`resetDate${accountNum}`);
                if (dateInput) {
                    dateInput.value = payload.new.reset_date.slice(0, 16);
                }
            }

            if (payload.new.needs_update) {
                applyNeedsUpdateStyling(accountNum);
            } else {
                removeNeedsUpdateStyling(accountNum);
            }
        }

        setSyncStatus('synced');
    });

    // Subscribe to settings changes
    settingsChannel = subscribeToSettingsChanges(async (payload) => {
        console.log('Settings change received:', payload);
        setSyncStatus('syncing');

        if (payload.new) {
            // Update x2 mode
            if (payload.new.x2_mode !== undefined) {
                const toggle = document.getElementById('x2Toggle');
                if (toggle && toggle.checked !== payload.new.x2_mode) {
                    toggle.checked = payload.new.x2_mode;
                    applyX2Mode(payload.new.x2_mode);
                }
            }

            // Update account names
            if (payload.new.account_names) {
                accountNames = payload.new.account_names;
                ACCOUNTS.forEach(num => {
                    const nameElement = document.getElementById(`accountName${num}`);
                    if (nameElement) {
                        nameElement.textContent = accountNames[`account${num}`];
                    }
                });
                updateOverviewStats();
            }
        }

        setSyncStatus('synced');
    });
}

// Set sync status indicator
function setSyncStatus(status) {
    const indicator = document.getElementById('syncIndicator');
    const text = document.getElementById('syncText');

    indicator.className = 'sync-indicator ' + status;

    switch (status) {
        case 'synced':
            text.textContent = 'Sincronizado';
            break;
        case 'syncing':
            text.textContent = 'Sincronizando...';
            break;
        case 'error':
            text.textContent = 'Error de sync';
            break;
    }
}

// Show/hide loading overlay
function showLoading(show) {
    let overlay = document.getElementById('loadingOverlay');

    if (show) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-text">Cargando datos...</div>
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    } else {
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
}

// Setup event listeners
function setupEventListeners() {
    ACCOUNTS.forEach(accountNum => {
        const input = document.getElementById(`usage${accountNum}`);
        input.addEventListener('input', () => updateAccount(accountNum));
    });

    document.getElementById('x2Toggle').addEventListener('change', toggleX2Mode);
}

// Update individual account
function updateAccount(accountNum) {
    const input = document.getElementById(`usage${accountNum}`);
    let usage = parseFloat(input.value) || 0;

    // Check if x2 mode is active
    const isX2ModeActive = document.body.classList.contains('x2-mode');
    const maxUsage = isX2ModeActive ? 200 : 100;

    // Validate input
    if (usage < 0) usage = 0;
    if (usage > maxUsage) usage = maxUsage;
    input.value = usage;

    const remaining = 100 - usage;

    // Update progress bar
    const progressFill = document.getElementById(`progress${accountNum}`);
    // In x2 mode, scale to 200%, otherwise 100%
    const visualWidth = isX2ModeActive ? (usage / 200 * 100) : Math.min(usage, 100);
    progressFill.style.width = `${visualWidth}%`;

    // Update gradient based on usage - thresholds adapt to x2 mode
    const threshold1 = isX2ModeActive ? 100 : 50;  // Green threshold
    const threshold2 = isX2ModeActive ? 160 : 80;  // Yellow threshold

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
    const exceedThreshold = isX2ModeActive ? 200 : 100;

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
        status.textContent = 'Critico';
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
    const usageX2 = usage / 2;
    const remainingX2 = 100 - usageX2;

    // Update x2 labels
    document.getElementById(`usedX2${accountNum}`).textContent = `${usageX2.toFixed(1)}%`;
    document.getElementById(`remainingX2${accountNum}`).textContent = `${remainingX2.toFixed(1)}%`;

    // Update x2 remaining text
    const remainingTextX2 = document.getElementById(`remainingTextX2${accountNum}`);
    if (remainingX2 < 0) {
        remainingTextX2.textContent = `Excedido por ${Math.abs(remainingX2).toFixed(1)}% (con limite x2)`;
        remainingTextX2.className = 'remaining-text-x2 danger';
    } else {
        remainingTextX2.textContent = `${remainingX2.toFixed(1)}% disponible (con limite x2)`;
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

// Save data to Supabase
async function saveData() {
    setSyncStatus('syncing');

    const data = {};
    ACCOUNTS.forEach(accountNum => {
        const usage = document.getElementById(`usage${accountNum}`).value;
        data[`account${accountNum}`] = usage;
    });

    try {
        // Save all accounts
        await saveAllAccounts(data);

        // Save to history if values changed
        await saveToHistoryIfChanged(data);

        showNotification('Datos guardados correctamente', 'success');
        setSyncStatus('synced');
    } catch (error) {
        console.error('Error saving data:', error);
        showNotification('Error al guardar datos', 'error');
        setSyncStatus('error');
    }
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
async function saveToHistoryIfChanged(data) {
    if (!hasValuesChanged(data)) {
        return; // No changes, don't save
    }

    // Update last saved values
    lastSavedValues = {...data};

    // Create and save history point
    const historyPoint = {
        timestamp: new Date().toISOString(),
        account1: parseFloat(data.account1) || 0,
        account2: parseFloat(data.account2) || 0,
        account3: parseFloat(data.account3) || 0
    };

    await saveHistoryPoint(historyPoint);
}

// Load data from Supabase
async function loadData() {
    const accounts = await getAccounts();

    if (accounts && accounts.length > 0) {
        accounts.forEach(account => {
            const input = document.getElementById(`usage${account.account_number}`);
            if (input && account.usage_percent !== undefined) {
                input.value = account.usage_percent;
            }
        });
    }
}

// Load reset dates from Supabase
async function loadResetDates() {
    const accounts = await getAccounts();

    if (accounts && accounts.length > 0) {
        accounts.forEach(account => {
            const accountNum = account.account_number;

            if (account.reset_date) {
                const dateInput = document.getElementById(`resetDate${accountNum}`);
                if (dateInput) {
                    // Format for datetime-local input
                    dateInput.value = account.reset_date.slice(0, 16);
                }
            }

            if (account.needs_update) {
                applyNeedsUpdateStyling(accountNum);
            }
        });
    }
}

// Get reset data for a specific account
async function getResetData(accountNum) {
    const account = await getAccount(accountNum);
    if (!account) {
        return { resetDate: null, needsUpdate: false };
    }
    return {
        resetDate: account.reset_date,
        needsUpdate: account.needs_update || false
    };
}


// Check and process automatic resets
async function checkAndProcessResets() {
    const accounts = await getAccounts();
    const now = new Date();

    for (const account of accounts) {
        if (!account.reset_date || account.needs_update) {
            continue; // Skip if no date set or already needs update
        }

        const resetDate = new Date(account.reset_date);

        if (now >= resetDate) {
            await performAutoReset(account.account_number);
        }
    }
}

// Perform automatic reset for an account
async function performAutoReset(accountNum) {
    // 1. Reset usage to 0
    const usageInput = document.getElementById(`usage${accountNum}`);
    usageInput.value = 0;
    updateAccount(accountNum);

    // 2. Mark as needing update and save
    await saveAccount(accountNum, {
        usage_percent: 0,
        needs_update: true
    });

    // 3. Apply visual styling
    applyNeedsUpdateStyling(accountNum);

    // 4. Save to history
    const data = {};
    ACCOUNTS.forEach(num => {
        data[`account${num}`] = document.getElementById(`usage${num}`).value;
    });
    await saveToHistoryIfChanged(data);

    // 5. Notify user
    const accountName = getAccountName(accountNum);
    showNotification(
        `${accountName} reiniciada automaticamente. Por favor, selecciona una nueva fecha de reinicio.`,
        'warning'
    );
}

// Handle reset date change event
async function onResetDateChange(accountNum) {
    const dateInput = document.getElementById(`resetDate${accountNum}`);
    const selectedDate = dateInput.value;
    const usage = parseFloat(document.getElementById(`usage${accountNum}`).value) || 0;

    setSyncStatus('syncing');

    if (!selectedDate) {
        // Date cleared
        await saveAccount(accountNum, {
            usage_percent: usage,
            reset_date: null,
            needs_update: false
        });
        removeNeedsUpdateStyling(accountNum);
        updateTimeRemainingMetric(accountNum);
        setSyncStatus('synced');
        return;
    }

    // Validate future date
    const now = new Date();
    const resetDate = new Date(selectedDate);

    if (resetDate <= now) {
        showNotification('Por favor selecciona una fecha y hora futura', 'error');
        dateInput.value = '';
        setSyncStatus('synced');
        return;
    }

    // Save reset date
    const currentAccount = await getAccount(accountNum);
    const needsUpdate = currentAccount?.needs_update || false;

    // Check if we should clear the needs-update flag
    const shouldClearNeedsUpdate = usage === 0 && needsUpdate;

    await saveAccount(accountNum, {
        usage_percent: usage,
        reset_date: selectedDate,
        needs_update: shouldClearNeedsUpdate ? false : needsUpdate
    });

    if (shouldClearNeedsUpdate) {
        removeNeedsUpdateStyling(accountNum);
        showNotification('Fecha de reinicio actualizada correctamente', 'success');
    }

    updateTimeRemainingMetric(accountNum);
    setSyncStatus('synced');
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
        dateHelper.textContent = 'Atencion! Selecciona una nueva fecha de reinicio';
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
        dateHelper.textContent = 'La cuenta se reiniciara automaticamente en esta fecha y hora';
    }
}

// Update time remaining percentage metric and usage balance
async function updateTimeRemainingMetric(accountNum) {
    const timeUsedElement = document.getElementById(`timeUsed${accountNum}`);
    const usageBalanceElement = document.getElementById(`usageBalance${accountNum}`);
    const progressFillElement = document.getElementById(`timeProgressFill${accountNum}`);

    if (!timeUsedElement || !usageBalanceElement || !progressFillElement) return;

    const account = await getAccount(accountNum);

    if (!account || !account.reset_date) {
        timeUsedElement.textContent = '--';
        usageBalanceElement.textContent = '--';
        timeUsedElement.className = 'time-metric-value used';
        usageBalanceElement.className = 'time-metric-value balance';
        progressFillElement.style.width = '0%';
        progressFillElement.className = 'time-progress-fill';
        return;
    }

    const now = new Date();
    const resetDate = new Date(account.reset_date);

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
    const usageBalance = actualUsage - percentageTimeUsed;

    // Update time used display
    timeUsedElement.textContent = `${Math.round(percentageTimeUsed)}%`;

    // Update balance display with sign
    const balanceSign = usageBalance >= 0 ? '+' : '';
    usageBalanceElement.textContent = `${balanceSign}${Math.round(usageBalance)}%`;

    // Define tolerance zones
    const TOLERANCE_GREEN = 10;   // +/- 10%
    const TOLERANCE_YELLOW = 20;  // +/- 20%

    // Apply color coding based on balance and tolerance
    const absBalance = Math.abs(usageBalance);

    if (absBalance <= TOLERANCE_GREEN) {
        usageBalanceElement.className = 'time-metric-value balance success';
        progressFillElement.className = 'time-progress-fill success';
    } else if (absBalance <= TOLERANCE_YELLOW) {
        usageBalanceElement.className = 'time-metric-value balance warning';
        progressFillElement.className = 'time-progress-fill warning';
    } else {
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
async function toggleX2Mode(event) {
    const isX2ModeActive = event.target.checked;
    applyX2Mode(isX2ModeActive);

    // Save preference to Supabase
    setSyncStatus('syncing');
    try {
        await saveSettings({
            x2_mode: isX2ModeActive,
            account_names: accountNames
        });
        setSyncStatus('synced');
    } catch (error) {
        console.error('Error saving x2 mode:', error);
        setSyncStatus('error');
    }
}

// Apply x2 mode to UI
function applyX2Mode(isX2ModeActive) {
    if (isX2ModeActive) {
        document.body.classList.add('x2-mode');
        // Update input max to 200 and placeholder
        ACCOUNTS.forEach(num => {
            const input = document.getElementById(`usage${num}`);
            input.setAttribute('max', '200');
            input.setAttribute('placeholder', '0-200');
        });
        showNotification('Modo limite x2 activado - Maximo 200%', 'success');
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
        showNotification('Modo limite normal activado - Maximo 100%', 'success');
    }

    updateAllAccounts();
}

// Load x2 mode preference
async function loadX2Mode() {
    const settings = await getSettings();
    const isX2ModeActive = settings?.x2_mode || false;

    const toggle = document.getElementById('x2Toggle');
    toggle.checked = isX2ModeActive;

    if (isX2ModeActive) {
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
async function loadAccountNames() {
    const settings = await getSettings();

    if (settings?.account_names) {
        accountNames = settings.account_names;
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
async function saveAccountNamesToSupabase() {
    setSyncStatus('syncing');
    try {
        const settings = await getSettings();
        await saveSettings({
            x2_mode: settings?.x2_mode || false,
            account_names: accountNames
        });
        setSyncStatus('synced');
    } catch (error) {
        console.error('Error saving account names:', error);
        setSyncStatus('error');
    }
}

// Edit account name
async function editAccountName(accountNum) {
    const currentName = accountNames[`account${accountNum}`];
    const newName = prompt(`Ingresa un nuevo nombre para ${currentName}:`, currentName);

    if (newName && newName.trim() !== '') {
        accountNames[`account${accountNum}`] = newName.trim();
        await saveAccountNamesToSupabase();

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

    let bgColor = '#10b981';
    if (type === 'error') bgColor = '#ef4444';
    if (type === 'warning') bgColor = '#f59e0b';

    notification.style.cssText = `
        position: fixed;
        top: 2rem;
        right: 2rem;
        background: ${bgColor};
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
    autoSaveTimeout = setTimeout(async () => {
        const hasData = ACCOUNTS.some(num => {
            const value = document.getElementById(`usage${num}`).value;
            return value && parseFloat(value) > 0;
        });

        if (hasData) {
            await saveData();
        }
    }, 3000); // Wait 3 seconds after last change
}
