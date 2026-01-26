// Constants
let charts = {};
let historyData = [];
let isX2Mode = false;
let accountNames = {};
let historyChannel = null;

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
        await loadX2Mode();
        await loadHistory();

        setupEventListeners();
        renderDashboard();

        // Setup realtime subscriptions
        setupRealtimeSubscriptions();

    } catch (error) {
        console.error('Error initializing dashboard:', error);
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
    // Subscribe to history changes
    historyChannel = subscribeToHistoryChanges(async (payload) => {
        console.log('History change received:', payload);
        setSyncStatus('syncing');

        // Reload history and re-render
        await loadHistory();
        renderDashboard();

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

// Load account names from Supabase
async function loadAccountNames() {
    const settings = await getSettings();

    if (settings?.account_names) {
        accountNames = settings.account_names;
        // Update UI with custom names
        document.getElementById('account1Name').textContent = accountNames.account1 || 'Cuenta 1';
        document.getElementById('account2Name').textContent = accountNames.account2 || 'Cuenta 2';
        document.getElementById('account3Name').textContent = accountNames.account3 || 'Cuenta 3';
    }
}

// Get account name helper
function getAccountName(accountNum) {
    const key = `account${accountNum}`;
    return accountNames[key] || `Cuenta ${accountNum}`;
}

// Load x2 mode preference from Supabase
async function loadX2Mode() {
    const settings = await getSettings();
    isX2Mode = settings?.x2_mode || false;

    const toggle = document.getElementById('showX2Mode');
    if (toggle) {
        toggle.checked = isX2Mode;
    }
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('timeRange').addEventListener('change', renderDashboard);
    document.getElementById('showX2Mode').addEventListener('change', toggleX2Display);
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistoryData);
}

// Load history from Supabase
async function loadHistory() {
    historyData = await getHistory();
}

// Filter data by time range
function filterDataByTimeRange(data, days) {
    if (days === 'all') return data;

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

    return data.filter(point => {
        const pointDate = new Date(point.timestamp);
        return pointDate >= cutoffDate;
    });
}

// Render dashboard
function renderDashboard() {
    if (historyData.length === 0) {
        showNoDataMessage();
        return;
    }

    hideNoDataMessage();

    const timeRange = document.getElementById('timeRange').value;
    const filteredData = filterDataByTimeRange(historyData, timeRange);

    updateStats(filteredData);
    renderWeekComparison();
    renderCharts(filteredData);
}

// Show no data message
function showNoDataMessage() {
    document.getElementById('noDataMessage').style.display = 'flex';
    document.querySelector('.dashboard-controls').style.display = 'none';
    document.querySelector('.stats-grid').style.display = 'none';
    document.querySelector('.charts-container').style.display = 'none';
}

// Hide no data message
function hideNoDataMessage() {
    document.getElementById('noDataMessage').style.display = 'none';
    document.querySelector('.dashboard-controls').style.display = 'flex';
    document.querySelector('.stats-grid').style.display = 'grid';
    document.querySelector('.charts-container').style.display = 'grid';
}

// Update statistics
function updateStats(data) {
    if (data.length === 0) {
        document.getElementById('totalRecords').textContent = '0';
        document.getElementById('firstRecord').textContent = '-';
        document.getElementById('lastRecord').textContent = '-';
        document.getElementById('mostUsedAccount').textContent = '-';
        return;
    }

    // Total records
    document.getElementById('totalRecords').textContent = data.length;

    // First and last record
    const firstDate = new Date(data[0].timestamp);
    const lastDate = new Date(data[data.length - 1].timestamp);
    document.getElementById('firstRecord').textContent = formatDate(firstDate);
    document.getElementById('lastRecord').textContent = formatDate(lastDate);

    // Most used account
    let totalUsage = [0, 0, 0];
    data.forEach(point => {
        totalUsage[0] += point.account1;
        totalUsage[1] += point.account2;
        totalUsage[2] += point.account3;
    });

    const avgUsage = totalUsage.map(total => total / data.length);
    const maxAvg = Math.max(...avgUsage);
    const mostUsedIndex = avgUsage.indexOf(maxAvg);
    document.getElementById('mostUsedAccount').textContent = `${getAccountName(mostUsedIndex + 1)} (${maxAvg.toFixed(1)}%)`;
}

// Format date
function formatDate(date) {
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Render week comparison
function renderWeekComparison() {
    const now = new Date();
    const currentWeekStart = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const prevWeekStart = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));
    const prevWeekEnd = currentWeekStart;

    // Filter data for current and previous week
    const currentWeekData = historyData.filter(point => {
        const date = new Date(point.timestamp);
        return date >= currentWeekStart && date <= now;
    });

    const prevWeekData = historyData.filter(point => {
        const date = new Date(point.timestamp);
        return date >= prevWeekStart && date < prevWeekEnd;
    });

    // Hide comparison if not enough data
    if (currentWeekData.length === 0 && prevWeekData.length === 0) {
        document.getElementById('weekComparison').style.display = 'none';
        return;
    }

    document.getElementById('weekComparison').style.display = 'block';

    // Calculate averages for each account
    for (let i = 1; i <= 3; i++) {
        const accountKey = `account${i}`;

        // Current week average
        let currentAvg = 0;
        if (currentWeekData.length > 0) {
            const currentSum = currentWeekData.reduce((sum, point) => sum + point[accountKey], 0);
            currentAvg = currentSum / currentWeekData.length;
        }

        // Previous week average
        let prevAvg = 0;
        if (prevWeekData.length > 0) {
            const prevSum = prevWeekData.reduce((sum, point) => sum + point[accountKey], 0);
            prevAvg = prevSum / prevWeekData.length;
        }

        // Apply x2 mode if enabled
        const processData = (value) => isX2Mode ? value / 2 : value;
        currentAvg = processData(currentAvg);
        prevAvg = processData(prevAvg);

        // Calculate difference
        const diff = currentAvg - prevAvg;
        const diffPercent = prevAvg > 0 ? ((diff / prevAvg) * 100) : 0;

        // Update UI
        document.getElementById(`currentWeek${i}`).textContent = currentWeekData.length > 0 ? `${currentAvg.toFixed(1)}%` : '-';
        document.getElementById(`prevWeek${i}`).textContent = prevWeekData.length > 0 ? `${prevAvg.toFixed(1)}%` : '-';

        // Update arrow and difference
        const arrow = document.getElementById(`arrow${i}`);
        const diffElement = document.getElementById(`diff${i}`);

        if (currentWeekData.length > 0 && prevWeekData.length > 0) {
            if (diff > 0) {
                arrow.textContent = String.fromCharCode(0x2197); // Arrow up-right
                arrow.style.color = '#ef4444'; // Red for increase (bad)
                diffElement.innerHTML = `<span class="diff-label">Diferencia:</span> <span class="diff-value increase">+${diff.toFixed(1)}% (+${Math.abs(diffPercent).toFixed(1)}%)</span>`;
            } else if (diff < 0) {
                arrow.textContent = String.fromCharCode(0x2198); // Arrow down-right
                arrow.style.color = '#10b981'; // Green for decrease (good)
                diffElement.innerHTML = `<span class="diff-label">Diferencia:</span> <span class="diff-value decrease">${diff.toFixed(1)}% (${diffPercent.toFixed(1)}%)</span>`;
            } else {
                arrow.textContent = String.fromCharCode(0x2192); // Arrow right
                arrow.style.color = '#a1a1aa';
                diffElement.innerHTML = `<span class="diff-label">Diferencia:</span> <span class="diff-value">Sin cambios</span>`;
            }
        } else {
            arrow.textContent = String.fromCharCode(0x2192);
            arrow.style.color = '#a1a1aa';
            diffElement.innerHTML = `<span class="diff-label">Diferencia:</span> <span class="diff-value">-</span>`;
        }
    }
}

// Render charts
function renderCharts(data) {
    renderUsageChart(data);
    renderAverageChart(data);
    renderDistributionChart(data);
    renderRemainingChart(data);
}

// Render usage over time chart
function renderUsageChart(data) {
    const ctx = document.getElementById('usageChart');

    // Destroy existing chart
    if (charts.usage) {
        charts.usage.destroy();
    }

    const labels = data.map(point => {
        const date = new Date(point.timestamp);
        return date.toLocaleDateString('es-ES', {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'});
    });

    // In x2 mode, don't process data, show raw values
    charts.usage = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: getAccountName(1),
                    data: data.map(p => p.account1),
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: getAccountName(2),
                    data: data.map(p => p.account2),
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: getAccountName(3),
                    data: data.map(p => p.account3),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#e4e4e7',
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#a1a1aa',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        color: 'rgba(39, 39, 42, 0.5)'
                    }
                },
                y: {
                    beginAtZero: true,
                    max: isX2Mode ? 200 : 100,
                    ticks: {
                        color: '#a1a1aa',
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: {
                        color: 'rgba(39, 39, 42, 0.5)'
                    }
                }
            }
        }
    });
}

// Render average usage chart
function renderAverageChart(data) {
    const ctx = document.getElementById('averageChart');

    if (charts.average) {
        charts.average.destroy();
    }

    let avg1 = 0, avg2 = 0, avg3 = 0;
    data.forEach(point => {
        avg1 += point.account1;
        avg2 += point.account2;
        avg3 += point.account3;
    });

    avg1 = avg1 / data.length;
    avg2 = avg2 / data.length;
    avg3 = avg3 / data.length;

    charts.average = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [getAccountName(1), getAccountName(2), getAccountName(3)],
            datasets: [{
                label: 'Uso Promedio (%)',
                data: [avg1, avg2, avg3],
                backgroundColor: [
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(16, 185, 129, 0.8)'
                ],
                borderColor: [
                    '#8b5cf6',
                    '#6366f1',
                    '#10b981'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#a1a1aa'
                    },
                    grid: {
                        color: 'rgba(39, 39, 42, 0.5)'
                    }
                },
                y: {
                    beginAtZero: true,
                    max: isX2Mode ? 200 : 100,
                    ticks: {
                        color: '#a1a1aa',
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: {
                        color: 'rgba(39, 39, 42, 0.5)'
                    }
                }
            }
        }
    });
}

// Render distribution chart
function renderDistributionChart(data) {
    const ctx = document.getElementById('distributionChart');

    if (charts.distribution) {
        charts.distribution.destroy();
    }

    const lastDataPoint = data[data.length - 1];

    charts.distribution = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [getAccountName(1), getAccountName(2), getAccountName(3)],
            datasets: [{
                data: [
                    lastDataPoint.account1,
                    lastDataPoint.account2,
                    lastDataPoint.account3
                ],
                backgroundColor: [
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(16, 185, 129, 0.8)'
                ],
                borderColor: [
                    '#8b5cf6',
                    '#6366f1',
                    '#10b981'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#e4e4e7',
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed.toFixed(1) + '%';
                        }
                    }
                }
            }
        }
    });
}

// Render remaining capacity chart
function renderRemainingChart(data) {
    const ctx = document.getElementById('remainingChart');

    if (charts.remaining) {
        charts.remaining.destroy();
    }

    const lastDataPoint = data[data.length - 1];
    const maxCapacity = isX2Mode ? 200 : 100;

    const remaining1 = Math.max(0, maxCapacity - lastDataPoint.account1);
    const remaining2 = Math.max(0, maxCapacity - lastDataPoint.account2);
    const remaining3 = Math.max(0, maxCapacity - lastDataPoint.account3);

    charts.remaining = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [getAccountName(1), getAccountName(2), getAccountName(3)],
            datasets: [
                {
                    label: 'Usado',
                    data: [
                        lastDataPoint.account1,
                        lastDataPoint.account2,
                        lastDataPoint.account3
                    ],
                    backgroundColor: 'rgba(239, 68, 68, 0.6)',
                    borderColor: '#ef4444',
                    borderWidth: 2
                },
                {
                    label: 'Restante',
                    data: [remaining1, remaining2, remaining3],
                    backgroundColor: 'rgba(16, 185, 129, 0.6)',
                    borderColor: '#10b981',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#e4e4e7'
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        color: '#a1a1aa'
                    },
                    grid: {
                        color: 'rgba(39, 39, 42, 0.5)'
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    max: maxCapacity,
                    ticks: {
                        color: '#a1a1aa',
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: {
                        color: 'rgba(39, 39, 42, 0.5)'
                    }
                }
            }
        }
    });
}

// Toggle x2 display mode
async function toggleX2Display(event) {
    isX2Mode = event.target.checked;

    // Save preference to Supabase
    setSyncStatus('syncing');
    try {
        await saveSettings({
            x2_mode: isX2Mode,
            account_names: accountNames
        });
        setSyncStatus('synced');
    } catch (error) {
        console.error('Error saving x2 mode:', error);
        setSyncStatus('error');
    }

    renderDashboard();
}

// Clear history
async function clearHistoryData() {
    if (confirm('Estas seguro de que quieres eliminar todo el historial? Esta accion no se puede deshacer.')) {
        setSyncStatus('syncing');

        try {
            await clearHistory();
            historyData = [];

            // Destroy all charts
            Object.values(charts).forEach(chart => {
                if (chart) chart.destroy();
            });
            charts = {};

            showNoDataMessage();
            showNotification('Historial eliminado correctamente', 'success');
            setSyncStatus('synced');
        } catch (error) {
            console.error('Error clearing history:', error);
            showNotification('Error al eliminar historial', 'error');
            setSyncStatus('error');
        }
    }
}

// Show notification
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

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
