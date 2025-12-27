// Constants
const HISTORY_KEY = 'claude_usage_history';
let charts = {};
let historyData = [];
let isX2Mode = false;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    setupEventListeners();
    renderDashboard();
});

// Setup event listeners
function setupEventListeners() {
    document.getElementById('timeRange').addEventListener('change', renderDashboard);
    document.getElementById('showX2Mode').addEventListener('change', toggleX2Display);
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
}

// Load history from localStorage
function loadHistory() {
    const savedHistory = localStorage.getItem(HISTORY_KEY);
    if (savedHistory) {
        try {
            historyData = JSON.parse(savedHistory);
        } catch (error) {
            console.error('Error loading history:', error);
            historyData = [];
        }
    }
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
    document.getElementById('mostUsedAccount').textContent = `Cuenta ${mostUsedIndex + 1} (${maxAvg.toFixed(1)}%)`;
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

    const processData = (value) => isX2Mode ? value / 2 : value;

    charts.usage = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Cuenta 1',
                    data: data.map(p => processData(p.account1)),
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Cuenta 2',
                    data: data.map(p => processData(p.account2)),
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Cuenta 3',
                    data: data.map(p => processData(p.account3)),
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
                    max: 100,
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

    const processData = (value) => isX2Mode ? value / 2 : value;

    let avg1 = 0, avg2 = 0, avg3 = 0;
    data.forEach(point => {
        avg1 += point.account1;
        avg2 += point.account2;
        avg3 += point.account3;
    });

    avg1 = processData(avg1 / data.length);
    avg2 = processData(avg2 / data.length);
    avg3 = processData(avg3 / data.length);

    charts.average = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Cuenta 1', 'Cuenta 2', 'Cuenta 3'],
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
                    max: 100,
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
    const processData = (value) => isX2Mode ? value / 2 : value;

    charts.distribution = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Cuenta 1', 'Cuenta 2', 'Cuenta 3'],
            datasets: [{
                data: [
                    processData(lastDataPoint.account1),
                    processData(lastDataPoint.account2),
                    processData(lastDataPoint.account3)
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
    const processData = (value) => isX2Mode ? value / 2 : value;

    const remaining1 = 100 - processData(lastDataPoint.account1);
    const remaining2 = 100 - processData(lastDataPoint.account2);
    const remaining3 = 100 - processData(lastDataPoint.account3);

    charts.remaining = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Cuenta 1', 'Cuenta 2', 'Cuenta 3'],
            datasets: [
                {
                    label: 'Usado',
                    data: [
                        processData(lastDataPoint.account1),
                        processData(lastDataPoint.account2),
                        processData(lastDataPoint.account3)
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
                    max: 100,
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
function toggleX2Display(event) {
    isX2Mode = event.target.checked;
    renderDashboard();
}

// Clear history
function clearHistory() {
    if (confirm('¿Estás seguro de que quieres eliminar todo el historial? Esta acción no se puede deshacer.')) {
        localStorage.removeItem(HISTORY_KEY);
        historyData = [];

        // Destroy all charts
        Object.values(charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        charts = {};

        showNoDataMessage();
        showNotification('Historial eliminado correctamente', 'success');
    }
}

// Show notification
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
