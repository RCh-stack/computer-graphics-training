let labsChartInstance = null;
let testsChartInstance = null;
let rawHistoryData = { labs: [], tests: [] };

document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();
    loadUserStats();
    loadUserHistory();

    document.getElementById('profile-form').addEventListener('submit', handleProfileUpdate);
    document.getElementById('password-form').addEventListener('submit', handlePasswordChange);
});

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('bg-indigo-600/20', 'text-indigo-400', 'font-semibold');
        el.classList.add('text-[var(--text-muted)]');
    });

    const activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.classList.remove('hidden');

    const activeBtn = document.getElementById(`btn-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-indigo-600/20', 'text-indigo-400', 'font-semibold');
        activeBtn.classList.remove('text-[var(--text-muted)]');
    }
}

async function loadUserProfile() {
    try {
        const token = localStorage.getItem('authToken');

        const response = await fetch(`/api/v1/users/profile`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        if (!response.ok) throw new Error('Не удалось получить данные пользователя.');

        const data = await response.json();

        document.getElementById('input-first-name').value = data.user.first_name || '';
        document.getElementById('input-last-name').value = data.user.last_name || '';
        document.getElementById('input-email').value = data.user.email || '';
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
    }
}

async function loadUserStats() {
    try {
        const token = localStorage.getItem('authToken');

        const response = await fetch('/api/v1/progress/summary', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        if (!response.ok) throw new Error('Не удалось получить статистику пользователя.');

        const result = await response.json();

        const labs = result.data.labs;
        const tests = result.data.tests;

        const average_result = (labs.averageGrade + tests.averageScore) / 2;

        document.getElementById('stat-labs-count').innerText = `${labs.passed} / ${labs.total}`;
        document.getElementById('stat-tests-count').innerText = `${tests.passed} / ${tests.passed}`;
        document.getElementById('stat-avg-grade').innerText = `${average_result}%`;

        renderDoughnutChart('labsChart', labs.passed, labs.passed, '#6366f1', 'Сдано');
        renderDoughnutChart('testsChart', tests.passed, tests.passed, '#10b981', 'Пройдено');
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

async function loadUserHistory() {
    try {
        const token = localStorage.getItem('authToken');

        const response = await fetch('/api/v1/progress/history', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        if (!response.ok) throw new Error('Не удалось загрузить историю активности');

        const result = await response.json();
        
        if (result.status === 'success' && result.data) {
            rawHistoryData = result.data;
            renderHistoryTable('all');
        }
    } catch (error) {
        console.error('Ошибка загрузки истории:', error);
        const tbody = document.getElementById('history-table-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="py-4 text-center text-red-400">
                        Не удалось загрузить историю активности.
                    </td>
                </tr>`;
        }
    }
}

function renderHistoryTable(filter = 'all') {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    let items = [];

    if (filter === 'all' || filter === 'labs') {
        (rawHistoryData.labs || []).forEach(item => {
            items.push({
                type: 'lab',
                title: item.lab_title || 'Лабораторная работа',
                grade: item.grade ?? 0,
                date: new Date(item.submitted_at)
            });
        });
    }

    if (filter === 'all' || filter === 'tests') {
        (rawHistoryData.tests || []).forEach(item => {
            items.push({
                type: 'test',
                title: item.test_title || 'Тестирование',
                grade: item.score_percent ?? 0,
                date: new Date(item.completed_at)
            });
        });
    }

    items.sort((a, b) => b.date - a.date);

    if (items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="py-6 text-center text-gray-400">
                    История сдач пока пуста
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => {
        const isLab = item.type === 'lab';
        
        const typeBadge = isLab 
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><i class="fa-solid fa-flask"></i> Lab</span>`
            : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><i class="fa-solid fa-list-check"></i> Test</span>`;

        let gradeColor = 'text-emerald-400';
        if (item.grade < 60) gradeColor = 'text-red-400';
        else if (item.grade < 80) gradeColor = 'text-amber-400';

        const formattedDate = item.date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <tr class="hover:bg-gray-800/20 transition">
                <td class="py-3 px-3">${typeBadge}</td>
                <td class="py-3 px-3 font-medium text-gray-200">${item.title}</td>
                <td class="py-3 px-3 text-center font-bold font-mono ${gradeColor}">${item.grade}%</td>
                <td class="py-3 px-3 text-right text-gray-400">${formattedDate}</td>
            </tr>
        `;
    }).join('');
}

function filterHistory(filterType) {
    const filterBtns = {
        all: document.getElementById('history-filter-all'),
        labs: document.getElementById('history-filter-labs'),
        tests: document.getElementById('history-filter-tests')
    };

    Object.keys(filterBtns).forEach(key => {
        const btn = filterBtns[key];
        if (!btn) return;

        if (key === filterType) {
            btn.className = 'px-3 py-1 rounded-lg font-medium text-pink-400 bg-pink-500/10 border border-pink-500/20 transition';
        } else {
            btn.className = 'px-3 py-1 rounded-lg font-medium text-gray-400 hover:text-white transition';
        }
    });

    renderHistoryTable(filterType);
}

function renderDoughnutChart(canvasId, passed, remaining, activeColor, label) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [label, 'Осталось'],
            datasets: [{
                data: [passed, remaining],
                backgroundColor: [activeColor, '#374151'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            cutout: '75%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const firstName = document.getElementById('input-first-name').value;
    const lastName = document.getElementById('input-last-name').value;

    try {
        const token = localStorage.getItem('authToken');

        const response = await fetch('/api/v1/users/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ firstName, lastName })
        });

        const result = await response.json();

        if (result.status = 'success') {
            const localUser = JSON.parse(localStorage.getItem('user') || '{}');

            localUser.firstName = firstName;
            localUser.lastName = lastName;

            localStorage.setItem('user', JSON.stringify(localUser));

            Swal.fire({ title: 'Сохранено!', text: 'Данные профиля обновлены', icon: 'success', confirmButtonColor: '#10b981' });

            updateHeaderProfile();
        } else {
            Swal.fire({ title: 'Ошибка', text: response.message || 'Не удалось обновить данные', icon: 'error' });
        }
    } catch (error) {
        console.error(error);
    }
}

async function handlePasswordChange(e) {
    e.preventDefault();
    const oldPassword = document.getElementById('input-old-password').value;
    const newPassword = document.getElementById('input-new-password').value;

    try {
        const token = localStorage.getItem('authToken');

        const response = await fetch('/api/v1/users/profile', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ oldPassword, newPassword })
        });

        const result = await response.json();

        if (result.status = 'success') {
            Swal.fire({ title: 'Успешно!', text: 'Пароль успешно изменен', icon: 'success', confirmButtonColor: '#10b981' });
            document.getElementById('password-form').reset();
        } else {
            Swal.fire({ title: 'Ошибка', text: response.message || 'Неверный текущий пароль', icon: 'error' });
        }
    } catch (error) {
        console.error(error);
    }
}

function updateHeaderProfile() {
    const rawUser = localStorage.getItem('user');
    if (!rawUser) return;

    try {
        const user = JSON.parse(rawUser);

        const userNameEl = document.getElementById('user-name');
        if (userNameEl) {
            const fullName = `${user.firstName}`.trim();
            userNameEl.innerText = fullName || user.email || 'Студент';
        }

        const userEmailEl = document.getElementById('dropdown-user-email');
        if (userEmailEl) {
            userEmailEl.innerText = user.email || '';
        }

        const userAvatarEl = document.getElementById('user-avatar');
        if (userAvatarEl) {
            const firstLetter = (user.firstName || user.email || 'U').charAt(0).toUpperCase();
            userAvatarEl.innerText = firstLetter;
        }
    } catch (error) {
        console.error('Ошибка парсинга пользователя из localStorage:', error);
    }
}