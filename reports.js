// Reports Module for Claude Usage Monitor

let historyData = [];
let accountNames = {};
let resetDates = {};
let currentUsage = {};
let charts = {};

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    const authenticated = await requireAuth();
    if (!authenticated) return;

    showLoading(true);

    try {
        await setupUserUI();
        await loadAllData();

        if (historyData.length < 2) {
            showNoDataMessage();
        } else {
            hideNoDataMessage();
            generateAllReports();
        }
    } catch (error) {
        console.error('Error initializing reports:', error);
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

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await signOut();
        window.location.href = 'login.html';
    });

    setSyncStatus('synced');
}

// Load all required data
async function loadAllData() {
    // Load history
    historyData = await getHistory();

    // Load settings
    const settings = await getSettings();
    if (settings?.account_names) {
        accountNames = settings.account_names;
    } else {
        accountNames = { account1: 'Cuenta 1', account2: 'Cuenta 2', account3: 'Cuenta 3' };
    }

    // Load accounts for current usage and reset dates
    const accounts = await getAccounts();
    accounts.forEach(acc => {
        currentUsage[`account${acc.account_number}`] = acc.usage_percent || 0;
        if (acc.reset_date) {
            resetDates[`account${acc.account_number}`] = new Date(acc.reset_date);
        }
    });
}

// Generate all reports
function generateAllReports() {
    generateQuickStats();
    generateAlerts();
    generateConsumptionReports();
    generatePatternReports();
    generateOptimizationReports();
    generateComparativeReports();
    generateEfficiencyReports();
}

// ==================== QUICK STATS ====================

function generateQuickStats() {
    // Recommended Account
    const recommendation = getRecommendedAccount();
    document.getElementById('recommendedAccount').textContent = recommendation.account;
    document.getElementById('recommendedReason').textContent = recommendation.reason;

    // Average Daily Consumption
    const avgDaily = calculateAverageDailyConsumption();
    document.getElementById('avgDailyConsumption').textContent = `${avgDaily.toFixed(1)}%`;

    // Efficiency Score
    const efficiency = calculateEfficiencyScore();
    document.getElementById('efficiencyScore').textContent = `${efficiency.score}%`;
    document.getElementById('efficiencyDetail').textContent = efficiency.label;
}

// ==================== ALERTS ====================

function generateAlerts() {
    const container = document.getElementById('alertsContainer');
    const alerts = [];

    // Check each account for potential issues
    [1, 2, 3].forEach(num => {
        const key = `account${num}`;
        const name = accountNames[key];
        const usage = currentUsage[key] || 0;
        const resetDate = resetDates[key];

        // Alert: Account near depletion
        if (usage >= 90) {
            alerts.push({
                type: 'danger',
                icon: '🚨',
                title: `${name} casi agotada`,
                description: `Uso actual: ${usage}%. Considera cambiar a otra cuenta.`
            });
        } else if (usage >= 75) {
            alerts.push({
                type: 'warning',
                icon: '⚠️',
                title: `${name} en zona crítica`,
                description: `Uso actual: ${usage}%. Quedan ${100 - usage}% de capacidad.`
            });
        }

        // Alert: Will deplete before reset
        if (resetDate && usage < 100) {
            const daysToReset = (resetDate - new Date()) / (1000 * 60 * 60 * 24);
            const dailyRate = calculateDailyRateForAccount(num);

            if (dailyRate > 0) {
                const daysToDeplete = (100 - usage) / dailyRate;

                if (daysToDeplete < daysToReset && daysToDeplete > 0) {
                    alerts.push({
                        type: 'warning',
                        icon: '📅',
                        title: `${name} se agotará antes del reset`,
                        description: `Al ritmo actual, se agotará en ${Math.ceil(daysToDeplete)} días. Reset en ${Math.ceil(daysToReset)} días.`
                    });
                }
            }
        }

        // Alert: Reset coming soon
        if (resetDate) {
            const hoursToReset = (resetDate - new Date()) / (1000 * 60 * 60);
            if (hoursToReset > 0 && hoursToReset < 24) {
                alerts.push({
                    type: 'info',
                    icon: '🔄',
                    title: `${name} se reinicia pronto`,
                    description: `Reset en ${Math.ceil(hoursToReset)} horas. Uso actual: ${usage}%`
                });
            }
        }
    });

    // Alert: All accounts high usage
    const allHigh = [1, 2, 3].every(num => (currentUsage[`account${num}`] || 0) >= 70);
    if (allHigh) {
        alerts.push({
            type: 'danger',
            icon: '🔥',
            title: 'Todas las cuentas con alto uso',
            description: 'Considera reducir el consumo o esperar los resets.'
        });
    }

    // Render alerts
    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="alert-item success">
                <span class="alert-icon">✅</span>
                <div class="alert-content">
                    <p class="alert-title">Todo en orden</p>
                    <p class="alert-description">No hay alertas pendientes. Tu uso está balanceado.</p>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = alerts.map(alert => `
            <div class="alert-item ${alert.type}">
                <span class="alert-icon">${alert.icon}</span>
                <div class="alert-content">
                    <p class="alert-title">${alert.title}</p>
                    <p class="alert-description">${alert.description}</p>
                </div>
            </div>
        `).join('');
    }
}

// ==================== CONSUMPTION REPORTS ====================

function generateConsumptionReports() {
    // Daily Average
    generateDailyAverageReport();

    // Depletion Projection
    generateDepletionReport();

    // Days Remaining
    generateDaysRemainingReport();

    // Consumption Speed
    generateConsumptionSpeedReport();
}

function generateDailyAverageReport() {
    const container = document.getElementById('dailyAverageStats');
    const html = [1, 2, 3].map(num => {
        const rate = calculateDailyRateForAccount(num);
        const statusClass = rate > 15 ? 'danger' : rate > 10 ? 'warning' : 'success';

        return `
            <div class="account-stat-row">
                <div>
                    <span class="account-stat-name">${accountNames[`account${num}`]}</span>
                    <p class="account-stat-detail">Basado en los últimos 7 días</p>
                </div>
                <span class="account-stat-value ${statusClass}">${rate.toFixed(1)}%/día</span>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

function generateDepletionReport() {
    const container = document.getElementById('depletionStats');
    const html = [1, 2, 3].map(num => {
        const usage = currentUsage[`account${num}`] || 0;
        const rate = calculateDailyRateForAccount(num);

        let depletionDate = 'N/A';
        let statusClass = 'neutral';

        if (rate > 0 && usage < 100) {
            const daysToDeplete = (100 - usage) / rate;
            const date = new Date();
            date.setDate(date.getDate() + daysToDeplete);
            depletionDate = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

            if (daysToDeplete < 2) statusClass = 'danger';
            else if (daysToDeplete < 4) statusClass = 'warning';
            else statusClass = 'success';
        } else if (usage >= 100) {
            depletionDate = 'Agotada';
            statusClass = 'danger';
        }

        return `
            <div class="account-stat-row">
                <div>
                    <span class="account-stat-name">${accountNames[`account${num}`]}</span>
                    <p class="account-stat-detail">Uso actual: ${usage}%</p>
                </div>
                <span class="account-stat-value ${statusClass}">${depletionDate}</span>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

function generateDaysRemainingReport() {
    const container = document.getElementById('daysRemainingStats');
    const html = [1, 2, 3].map(num => {
        const usage = currentUsage[`account${num}`] || 0;
        const rate = calculateDailyRateForAccount(num);

        let daysRemaining = '∞';
        let statusClass = 'success';

        if (rate > 0 && usage < 100) {
            const days = (100 - usage) / rate;
            daysRemaining = `${Math.floor(days)} días`;

            if (days < 2) statusClass = 'danger';
            else if (days < 4) statusClass = 'warning';
        } else if (usage >= 100) {
            daysRemaining = '0 días';
            statusClass = 'danger';
        }

        return `
            <div class="account-stat-row">
                <div>
                    <span class="account-stat-name">${accountNames[`account${num}`]}</span>
                    <p class="account-stat-detail">Al ritmo actual</p>
                </div>
                <span class="account-stat-value ${statusClass}">${daysRemaining}</span>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

function generateConsumptionSpeedReport() {
    const container = document.getElementById('consumptionSpeedStats');
    const html = [1, 2, 3].map(num => {
        const recentRate = calculateDailyRateForAccount(num, 3); // Last 3 days
        const olderRate = calculateDailyRateForAccount(num, 7, 3); // Days 4-7

        let trend = '→';
        let trendText = 'Estable';
        let statusClass = 'neutral';

        if (olderRate > 0) {
            const change = ((recentRate - olderRate) / olderRate) * 100;

            if (change > 20) {
                trend = '↑';
                trendText = `Acelerando (+${change.toFixed(0)}%)`;
                statusClass = 'danger';
            } else if (change < -20) {
                trend = '↓';
                trendText = `Frenando (${change.toFixed(0)}%)`;
                statusClass = 'success';
            }
        }

        return `
            <div class="account-stat-row">
                <div>
                    <span class="account-stat-name">${accountNames[`account${num}`]}</span>
                    <p class="account-stat-detail">${recentRate.toFixed(1)}%/día actual</p>
                </div>
                <span class="account-stat-value ${statusClass}">${trend} ${trendText}</span>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

// ==================== PATTERN REPORTS ====================

function generatePatternReports() {
    generatePeakHoursChart();
    generateDayOfWeekChart();
    generateRotationReport();
    generateStreaksReport();
}

function generatePeakHoursChart() {
    const ctx = document.getElementById('peakHoursChart');
    if (!ctx) return;

    // Calculate usage changes by hour
    const hourlyChanges = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);

    for (let i = 1; i < historyData.length; i++) {
        const prev = historyData[i - 1];
        const curr = historyData[i];
        const hour = new Date(curr.timestamp).getHours();

        const totalChange = (curr.account1 - prev.account1) +
                           (curr.account2 - prev.account2) +
                           (curr.account3 - prev.account3);

        if (totalChange > 0) {
            hourlyChanges[hour] += totalChange;
            hourlyCounts[hour]++;
        }
    }

    const hourlyAvg = hourlyChanges.map((total, i) =>
        hourlyCounts[i] > 0 ? total / hourlyCounts[i] : 0
    );

    if (charts.peakHours) charts.peakHours.destroy();

    charts.peakHours = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
            datasets: [{
                label: 'Cambio promedio (%)',
                data: hourlyAvg,
                backgroundColor: hourlyAvg.map(v =>
                    v > 5 ? 'rgba(239, 68, 68, 0.8)' :
                    v > 2 ? 'rgba(245, 158, 11, 0.8)' :
                    'rgba(139, 92, 246, 0.8)'
                ),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: '#a1a1aa', maxRotation: 45 },
                    grid: { color: 'rgba(39, 39, 42, 0.5)' }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: '#a1a1aa' },
                    grid: { color: 'rgba(39, 39, 42, 0.5)' }
                }
            }
        }
    });
}

function generateDayOfWeekChart() {
    const ctx = document.getElementById('dayOfWeekChart');
    if (!ctx) return;

    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const dailyChanges = new Array(7).fill(0);
    const dailyCounts = new Array(7).fill(0);

    for (let i = 1; i < historyData.length; i++) {
        const prev = historyData[i - 1];
        const curr = historyData[i];
        const day = new Date(curr.timestamp).getDay();

        const totalChange = (curr.account1 - prev.account1) +
                           (curr.account2 - prev.account2) +
                           (curr.account3 - prev.account3);

        if (totalChange > 0) {
            dailyChanges[day] += totalChange;
            dailyCounts[day]++;
        }
    }

    const dailyAvg = dailyChanges.map((total, i) =>
        dailyCounts[i] > 0 ? total / dailyCounts[i] : 0
    );

    if (charts.dayOfWeek) charts.dayOfWeek.destroy();

    charts.dayOfWeek = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [{
                label: 'Uso promedio (%)',
                data: dailyAvg,
                backgroundColor: [
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(99, 102, 241, 0.8)'
                ],
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: '#a1a1aa' },
                    grid: { color: 'rgba(39, 39, 42, 0.5)' }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: '#a1a1aa' },
                    grid: { color: 'rgba(39, 39, 42, 0.5)' }
                }
            }
        }
    });
}

function generateRotationReport() {
    const container = document.getElementById('rotationStats');

    // Detect account switches
    const rotations = [];

    for (let i = 1; i < historyData.length; i++) {
        const prev = historyData[i - 1];
        const curr = historyData[i];

        // Find which account had the most increase
        const changes = [
            { acc: 1, change: curr.account1 - prev.account1 },
            { acc: 2, change: curr.account2 - prev.account2 },
            { acc: 3, change: curr.account3 - prev.account3 }
        ].filter(c => c.change > 0);

        if (changes.length > 0) {
            const maxChange = changes.reduce((a, b) => a.change > b.change ? a : b);
            rotations.push(maxChange.acc);
        }
    }

    // Count switches
    const switchCounts = {};
    for (let i = 1; i < rotations.length; i++) {
        if (rotations[i] !== rotations[i - 1]) {
            const key = `${rotations[i - 1]}→${rotations[i]}`;
            switchCounts[key] = (switchCounts[key] || 0) + 1;
        }
    }

    const sorted = Object.entries(switchCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (sorted.length === 0) {
        container.innerHTML = '<p class="no-alerts">No hay suficientes datos de rotación</p>';
        return;
    }

    container.innerHTML = sorted.map(([key, count]) => {
        const [from, to] = key.split('→');
        return `
            <div class="rotation-item">
                <span class="rotation-text">${accountNames[`account${from}`]}</span>
                <span class="rotation-arrow">→</span>
                <span class="rotation-text">${accountNames[`account${to}`]}</span>
                <span class="rotation-count">${count}x</span>
            </div>
        `;
    }).join('');
}

function generateStreaksReport() {
    const container = document.getElementById('streaksList');

    // Find intensive usage periods (>10% increase in a day)
    const streaks = [];

    for (let i = 1; i < historyData.length; i++) {
        const prev = historyData[i - 1];
        const curr = historyData[i];

        const totalChange = (curr.account1 - prev.account1) +
                           (curr.account2 - prev.account2) +
                           (curr.account3 - prev.account3);

        if (totalChange >= 10) {
            streaks.push({
                date: new Date(curr.timestamp),
                change: totalChange,
                details: `C1: +${curr.account1 - prev.account1}%, C2: +${curr.account2 - prev.account2}%, C3: +${curr.account3 - prev.account3}%`
            });
        }
    }

    // Show top 5 most intensive
    const topStreaks = streaks
        .sort((a, b) => b.change - a.change)
        .slice(0, 5);

    if (topStreaks.length === 0) {
        container.innerHTML = '<p class="no-alerts">No se detectaron rachas de uso intenso</p>';
        return;
    }

    container.innerHTML = topStreaks.map(streak => `
        <div class="streak-item">
            <p class="streak-date">${streak.date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
            <p class="streak-value">+${streak.change.toFixed(0)}% total</p>
        </div>
    `).join('');
}

// ==================== OPTIMIZATION REPORTS ====================

function generateOptimizationReports() {
    generateBalanceSuggestion();
    generateRecommendationDetail();
}

function generateBalanceSuggestion() {
    const container = document.getElementById('balanceSuggestion');

    // Calculate optimal distribution based on reset dates
    const accounts = [1, 2, 3].map(num => {
        const key = `account${num}`;
        const usage = currentUsage[key] || 0;
        const resetDate = resetDates[key];
        const daysToReset = resetDate ? Math.max(0, (resetDate - new Date()) / (1000 * 60 * 60 * 24)) : 7;

        return { num, usage, daysToReset, key };
    });

    // Suggest using accounts with less days to reset more
    const totalDays = accounts.reduce((sum, a) => sum + a.daysToReset, 0);

    container.innerHTML = accounts.map(acc => {
        const suggestedPercent = totalDays > 0
            ? Math.round(((totalDays - acc.daysToReset) / (totalDays * 2)) * 100)
            : 33;

        return `
            <div class="balance-item">
                <span class="balance-account">${accountNames[acc.key]}</span>
                <div class="balance-bar">
                    <div class="balance-fill current" style="width: ${acc.usage}%"></div>
                </div>
                <span class="balance-percent">${acc.usage}%</span>
            </div>
            <div class="balance-item" style="opacity: 0.7;">
                <span class="balance-account">→ Sugerido</span>
                <div class="balance-bar">
                    <div class="balance-fill suggested" style="width: ${suggestedPercent}%"></div>
                </div>
                <span class="balance-percent">${suggestedPercent}%</span>
            </div>
        `;
    }).join('');
}

function generateRecommendationDetail() {
    const container = document.getElementById('recommendationDetail');
    const rec = getRecommendedAccount();

    const reasons = [];

    // Find why this account is recommended
    const usage = currentUsage[`account${rec.accountNum}`] || 0;
    const resetDate = resetDates[`account${rec.accountNum}`];

    if (usage < 50) reasons.push('Tiene más del 50% de capacidad disponible');
    if (usage < 30) reasons.push('Uso muy bajo, ideal para maximizar');

    if (resetDate) {
        const daysToReset = (resetDate - new Date()) / (1000 * 60 * 60 * 24);
        if (daysToReset < 3) reasons.push(`Reset próximo en ${Math.ceil(daysToReset)} días`);
        if (daysToReset > 5) reasons.push('Tiene tiempo suficiente antes del reset');
    }

    // Compare with other accounts
    [1, 2, 3].forEach(num => {
        if (num !== rec.accountNum) {
            const otherUsage = currentUsage[`account${num}`] || 0;
            if (otherUsage > usage + 20) {
                reasons.push(`${accountNames[`account${num}`]} tiene mayor uso (${otherUsage}%)`);
            }
        }
    });

    if (reasons.length === 0) {
        reasons.push('Balance óptimo entre uso y tiempo restante');
    }

    container.innerHTML = `
        <p class="recommendation-account">${rec.account}</p>
        <ul class="recommendation-reasons">
            ${reasons.slice(0, 4).map(r => `<li>${r}</li>`).join('')}
        </ul>
    `;
}

// ==================== COMPARATIVE REPORTS ====================

function generateComparativeReports() {
    generateWeekComparison();
    generateMonthComparison();
    generateTrendChart();
}

function generateWeekComparison() {
    const container = document.getElementById('weekComparisonStats');

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const thisWeek = historyData.filter(h => new Date(h.timestamp) >= oneWeekAgo);
    const lastWeek = historyData.filter(h => {
        const d = new Date(h.timestamp);
        return d >= twoWeeksAgo && d < oneWeekAgo;
    });

    const thisWeekTotal = calculateTotalUsageChange(thisWeek);
    const lastWeekTotal = calculateTotalUsageChange(lastWeek);

    const diff = thisWeekTotal - lastWeekTotal;
    const arrow = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
    const arrowSymbol = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';

    container.innerHTML = `
        <div class="comparison-row">
            <div class="comparison-period">
                <p class="comparison-label">Semana Anterior</p>
                <p class="comparison-value">${lastWeekTotal.toFixed(0)}%</p>
            </div>
            <div>
                <span class="comparison-arrow ${arrow}">${arrowSymbol}</span>
                <p class="comparison-diff ${diff > 0 ? 'positive' : 'negative'}">${diff > 0 ? '+' : ''}${diff.toFixed(0)}%</p>
            </div>
            <div class="comparison-period">
                <p class="comparison-label">Semana Actual</p>
                <p class="comparison-value">${thisWeekTotal.toFixed(0)}%</p>
            </div>
        </div>
    `;
}

function generateMonthComparison() {
    const container = document.getElementById('monthComparisonStats');

    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const thisMonth = historyData.filter(h => new Date(h.timestamp) >= oneMonthAgo);
    const lastMonth = historyData.filter(h => {
        const d = new Date(h.timestamp);
        return d >= twoMonthsAgo && d < oneMonthAgo;
    });

    const thisMonthTotal = calculateTotalUsageChange(thisMonth);
    const lastMonthTotal = calculateTotalUsageChange(lastMonth);

    const diff = thisMonthTotal - lastMonthTotal;
    const arrow = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
    const arrowSymbol = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';

    container.innerHTML = `
        <div class="comparison-row">
            <div class="comparison-period">
                <p class="comparison-label">Mes Anterior</p>
                <p class="comparison-value">${lastMonthTotal.toFixed(0)}%</p>
            </div>
            <div>
                <span class="comparison-arrow ${arrow}">${arrowSymbol}</span>
                <p class="comparison-diff ${diff > 0 ? 'positive' : 'negative'}">${diff > 0 ? '+' : ''}${diff.toFixed(0)}%</p>
            </div>
            <div class="comparison-period">
                <p class="comparison-label">Mes Actual</p>
                <p class="comparison-value">${thisMonthTotal.toFixed(0)}%</p>
            </div>
        </div>
    `;
}

function generateTrendChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    // Get last 30 days of data, grouped by day
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentData = historyData.filter(h => new Date(h.timestamp) >= thirtyDaysAgo);

    // Group by day
    const dailyData = {};
    recentData.forEach(h => {
        const day = new Date(h.timestamp).toLocaleDateString('es-ES');
        if (!dailyData[day]) {
            dailyData[day] = { account1: 0, account2: 0, account3: 0 };
        }
        dailyData[day] = {
            account1: Math.max(dailyData[day].account1, h.account1),
            account2: Math.max(dailyData[day].account2, h.account2),
            account3: Math.max(dailyData[day].account3, h.account3)
        };
    });

    const labels = Object.keys(dailyData);
    const data1 = labels.map(d => dailyData[d].account1);
    const data2 = labels.map(d => dailyData[d].account2);
    const data3 = labels.map(d => dailyData[d].account3);

    if (charts.trend) charts.trend.destroy();

    charts.trend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: accountNames.account1,
                    data: data1,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: accountNames.account2,
                    data: data2,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: accountNames.account3,
                    data: data3,
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
                    labels: { color: '#e4e4e7' }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#a1a1aa', maxRotation: 45 },
                    grid: { color: 'rgba(39, 39, 42, 0.5)' }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: '#a1a1aa',
                        callback: v => v + '%'
                    },
                    grid: { color: 'rgba(39, 39, 42, 0.5)' }
                }
            }
        }
    });
}

// ==================== EFFICIENCY REPORTS ====================

function generateEfficiencyReports() {
    generateCycleStats();
    generateWasteStats();
    generateEfficiencyBreakdown();
}

function generateCycleStats() {
    const container = document.getElementById('cycleStats');

    // Calculate average usage per 7-day cycle
    const cycles = [];
    let cycleStart = null;
    let cycleUsage = 0;

    historyData.forEach((h, i) => {
        const date = new Date(h.timestamp);

        if (!cycleStart) {
            cycleStart = date;
            cycleUsage = h.account1 + h.account2 + h.account3;
        } else {
            const daysDiff = (date - cycleStart) / (1000 * 60 * 60 * 24);

            if (daysDiff >= 7) {
                cycles.push({
                    start: cycleStart,
                    usage: (h.account1 + h.account2 + h.account3) - cycleUsage
                });
                cycleStart = date;
                cycleUsage = h.account1 + h.account2 + h.account3;
            }
        }
    });

    const avgCycleUsage = cycles.length > 0
        ? cycles.reduce((sum, c) => sum + c.usage, 0) / cycles.length
        : 0;

    const maxCycle = cycles.length > 0
        ? Math.max(...cycles.map(c => c.usage))
        : 0;

    const minCycle = cycles.length > 0
        ? Math.min(...cycles.map(c => c.usage))
        : 0;

    container.innerHTML = `
        <div class="cycle-item">
            <span class="cycle-label">Uso promedio por ciclo</span>
            <span class="cycle-value">${avgCycleUsage.toFixed(0)}%</span>
        </div>
        <div class="cycle-item">
            <span class="cycle-label">Ciclo más intenso</span>
            <span class="cycle-value">${maxCycle.toFixed(0)}%</span>
        </div>
        <div class="cycle-item">
            <span class="cycle-label">Ciclo más ligero</span>
            <span class="cycle-value">${minCycle.toFixed(0)}%</span>
        </div>
        <div class="cycle-item">
            <span class="cycle-label">Ciclos analizados</span>
            <span class="cycle-value">${cycles.length}</span>
        </div>
    `;
}

function generateWasteStats() {
    const container = document.getElementById('wasteStats');

    // Estimate waste: capacity not used before resets
    // We'll use current remaining capacity and days to reset

    const html = [1, 2, 3].map(num => {
        const key = `account${num}`;
        const usage = currentUsage[key] || 0;
        const remaining = 100 - usage;
        const resetDate = resetDates[key];

        let waste = 0;
        let wasteClass = 'low';

        if (resetDate) {
            const daysToReset = Math.max(0, (resetDate - new Date()) / (1000 * 60 * 60 * 24));
            const dailyRate = calculateDailyRateForAccount(num);

            if (dailyRate > 0) {
                const projectedUse = dailyRate * daysToReset;
                waste = Math.max(0, remaining - projectedUse);
            } else {
                waste = remaining; // If not using, all remaining is potential waste
            }
        }

        if (waste > 30) wasteClass = 'high';
        else if (waste > 15) wasteClass = 'medium';

        return `
            <div class="waste-item">
                <div class="waste-header">
                    <span class="waste-account">${accountNames[key]}</span>
                    <span class="waste-percent ${wasteClass}">${waste.toFixed(0)}%</span>
                </div>
                <div class="waste-bar">
                    <div class="waste-fill ${wasteClass}" style="width: ${waste}%"></div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

function generateEfficiencyBreakdown() {
    const container = document.getElementById('efficiencyBreakdown');

    // Calculate different efficiency metrics
    const utilizationScore = calculateUtilizationScore();
    const balanceScore = calculateBalanceScore();
    const timingScore = calculateTimingScore();

    const getClass = (score) => {
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'average';
        return 'poor';
    };

    container.innerHTML = `
        <div class="efficiency-metric">
            <div class="efficiency-metric-icon">📈</div>
            <p class="efficiency-metric-value ${getClass(utilizationScore)}">${utilizationScore}%</p>
            <p class="efficiency-metric-label">Utilización</p>
        </div>
        <div class="efficiency-metric">
            <div class="efficiency-metric-icon">⚖️</div>
            <p class="efficiency-metric-value ${getClass(balanceScore)}">${balanceScore}%</p>
            <p class="efficiency-metric-label">Balance</p>
        </div>
        <div class="efficiency-metric">
            <div class="efficiency-metric-icon">⏱️</div>
            <p class="efficiency-metric-value ${getClass(timingScore)}">${timingScore}%</p>
            <p class="efficiency-metric-label">Timing</p>
        </div>
    `;
}

// ==================== HELPER FUNCTIONS ====================

function getRecommendedAccount() {
    let best = { accountNum: 1, score: -Infinity };

    [1, 2, 3].forEach(num => {
        const key = `account${num}`;
        const usage = currentUsage[key] || 0;
        const resetDate = resetDates[key];

        // Score based on: low usage + near reset date
        let score = (100 - usage); // More remaining = better

        if (resetDate) {
            const daysToReset = (resetDate - new Date()) / (1000 * 60 * 60 * 24);
            if (daysToReset < 3 && daysToReset > 0) {
                score += 50; // Bonus for accounts resetting soon
            }
        }

        if (usage >= 95) {
            score -= 100; // Penalty for nearly depleted accounts
        }

        if (score > best.score) {
            best = { accountNum: num, score };
        }
    });

    const key = `account${best.accountNum}`;
    return {
        account: accountNames[key],
        accountNum: best.accountNum,
        reason: `${100 - (currentUsage[key] || 0)}% disponible`
    };
}

function calculateAverageDailyConsumption() {
    if (historyData.length < 2) return 0;

    const firstDate = new Date(historyData[0].timestamp);
    const lastDate = new Date(historyData[historyData.length - 1].timestamp);
    const days = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));

    const totalChange = [1, 2, 3].reduce((sum, num) => {
        const first = historyData[0][`account${num}`];
        const last = historyData[historyData.length - 1][`account${num}`];
        return sum + Math.max(0, last - first);
    }, 0);

    return totalChange / days / 3; // Average per account per day
}

function calculateEfficiencyScore() {
    const utilization = calculateUtilizationScore();
    const balance = calculateBalanceScore();
    const timing = calculateTimingScore();

    const score = Math.round((utilization + balance + timing) / 3);

    let label = 'Excelente';
    if (score < 80) label = 'Bueno';
    if (score < 60) label = 'Regular';
    if (score < 40) label = 'Bajo';

    return { score, label };
}

function calculateDailyRateForAccount(accountNum, days = 7, offset = 0) {
    if (historyData.length < 2) return 0;

    const now = new Date();
    const startDate = new Date(now.getTime() - (days + offset) * 24 * 60 * 60 * 1000);
    const endDate = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);

    const filtered = historyData.filter(h => {
        const d = new Date(h.timestamp);
        return d >= startDate && d <= endDate;
    });

    if (filtered.length < 2) return 0;

    const first = filtered[0][`account${accountNum}`];
    const last = filtered[filtered.length - 1][`account${accountNum}`];
    const daysDiff = (new Date(filtered[filtered.length - 1].timestamp) - new Date(filtered[0].timestamp)) / (1000 * 60 * 60 * 24);

    if (daysDiff <= 0) return 0;

    return Math.max(0, (last - first) / daysDiff);
}

function calculateTotalUsageChange(data) {
    if (data.length < 2) return 0;

    return [1, 2, 3].reduce((sum, num) => {
        const first = data[0][`account${num}`];
        const last = data[data.length - 1][`account${num}`];
        return sum + Math.max(0, last - first);
    }, 0);
}

function calculateUtilizationScore() {
    // How well are you using your capacity before resets?
    const totalUsage = [1, 2, 3].reduce((sum, num) =>
        sum + (currentUsage[`account${num}`] || 0), 0);
    return Math.min(100, Math.round(totalUsage / 3));
}

function calculateBalanceScore() {
    // How evenly distributed is usage across accounts?
    const usages = [1, 2, 3].map(num => currentUsage[`account${num}`] || 0);
    const avg = usages.reduce((a, b) => a + b, 0) / 3;
    const variance = usages.reduce((sum, u) => sum + Math.pow(u - avg, 2), 0) / 3;
    const stdDev = Math.sqrt(variance);

    // Lower std dev = better balance, max 100
    return Math.max(0, Math.round(100 - stdDev));
}

function calculateTimingScore() {
    // Are you using accounts that reset soon?
    let score = 50; // Base score

    [1, 2, 3].forEach(num => {
        const key = `account${num}`;
        const usage = currentUsage[key] || 0;
        const resetDate = resetDates[key];

        if (resetDate) {
            const daysToReset = (resetDate - new Date()) / (1000 * 60 * 60 * 24);

            if (daysToReset < 2 && usage > 80) {
                score += 15; // Good: high usage near reset
            } else if (daysToReset > 5 && usage > 80) {
                score -= 15; // Bad: high usage with time remaining
            } else if (daysToReset < 2 && usage < 50) {
                score -= 10; // Bad: low usage near reset (waste)
            }
        }
    });

    return Math.max(0, Math.min(100, score));
}

// UI Helpers
function setSyncStatus(status) {
    const indicator = document.getElementById('syncIndicator');
    const text = document.getElementById('syncText');

    indicator.className = 'sync-indicator ' + status;

    switch (status) {
        case 'synced': text.textContent = 'Sincronizado'; break;
        case 'syncing': text.textContent = 'Sincronizando...'; break;
        case 'error': text.textContent = 'Error de sync'; break;
    }
}

function showLoading(show) {
    let overlay = document.getElementById('loadingOverlay');

    if (show) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-text">Generando reportes...</div>
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    } else {
        if (overlay) overlay.style.display = 'none';
    }
}

function showNoDataMessage() {
    document.getElementById('noDataMessage').style.display = 'flex';
    document.querySelectorAll('.report-section').forEach(s => s.style.display = 'none');
}

function hideNoDataMessage() {
    document.getElementById('noDataMessage').style.display = 'none';
    document.querySelectorAll('.report-section').forEach(s => s.style.display = 'block');
}

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
