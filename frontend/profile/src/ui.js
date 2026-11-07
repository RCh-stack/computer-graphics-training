let chartInstances = {};
let cachedStatsData = null;
let rawHistoryData = { labs: [], tests: [], theory: [] };

document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();
    loadUserStats();
    loadUserHistory();
    initThemeToggleListener();

    document.getElementById('profile-form')?.addEventListener('submit', handleProfileUpdate);
    document.getElementById('password-form')?.addEventListener('submit', handlePasswordChange);
});

function initThemeToggleListener() {
    const themeBtn = document.getElementById('theme-toggle');
    if (!themeBtn) return;

    themeBtn.addEventListener('click', () => {
        setTimeout(() => {
            if (cachedStatsData) {
                renderAllCharts(cachedStatsData);
            }
        }, 50);
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));

    const activeClasses = ['bg-pink-500/10', 'text-pink-400', 'font-semibold', 'border-pink-500/20', 'active'];
    const inactiveClasses = ['hover:border-[var(--border-color)]', 'hover:bg-[var(--bg-card)]', 'text-[var(--text-main)]', 'font-medium', 'border-transparent'];

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove(...activeClasses);
        btn.classList.add(...inactiveClasses);
    });

    const activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.classList.remove('hidden');

    const activeBtn = document.getElementById(`btn-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.remove(...inactiveClasses);
        activeBtn.classList.add(...activeClasses);
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
        cachedStatsData = result.data;

        const { theory, labs, tests } = cachedStatsData;

        const average_result = Math.round((theory.percent + labs.averageGrade + tests.averageScore) / 3);

        document.getElementById('stat-lessons-count').innerText = `${theory.completedArticles} / ${theory.totalArticles}`;
        document.getElementById('stat-labs-count').innerText = `${labs.passed} / ${labs.total}`;
        document.getElementById('stat-tests-count').innerText = `${tests.passed} / ${tests.total}`;
        document.getElementById('stat-avg-grade').innerText = `${average_result}%`;

        renderAllCharts(cachedStatsData);
        renderTheoryChapters(theory.chapters);
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

function renderAllCharts(data) {
    const { theory, labs, tests } = data;
    renderDoughnutChart('theoryChart', theory.completedArticles, theory.totalArticles, '#6366f1', 'Изучено');
    renderDoughnutChart('labsChart', labs.passed, labs.total, '#10b981', 'Сдано');
    renderDoughnutChart('testsChart', tests.passed, tests.total, '#debb0c', 'Пройдено');
}

function renderDoughnutChart(canvasId, passed, total, activeColor, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const isDark = document.body.classList.contains('dark-theme');
    const remainingColor = isDark ? '#374151' : '#e5e7eb';

    const remaining = Math.max(0, total - passed);
    const dataValues = total > 0 ? [passed, remaining] : [0, 1];
    const bgColors = total > 0 ? [activeColor, remainingColor] : [remainingColor, remainingColor];

    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: total > 0 ? [label, 'Осталось'] : ['Нет данных'],
            datasets: [{
                data: dataValues,
                backgroundColor: bgColors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            cutout: '75%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: total > 0 }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function renderTheoryChapters(chapters) {
    const container = document.getElementById('theory-chapters-list');
    if (!container || !chapters || chapters.length === 0) return;

    container.innerHTML = chapters.map(ch => `
        <div class="space-y-1">
            <div class="flex justify-between text-xs font-medium">
                <span class="text-[var(--text-main)]">${ch.title}</span>
                <span class="font-mono text-indigo-400 font-bold">${ch.completedArticles} / ${ch.totalArticles} (${ch.percent}%)</span>
            </div>
            <div class="w-full bg-[var(--bg-panel)] rounded-full h-2 overflow-hidden border border-[var(--border-color)]">
                <div class="bg-indigo-500 h-2 rounded-full transition-all duration-500" style="width: ${ch.percent}%"></div>
            </div>
        </div>
    `).join('');
}

function toggleChaptersCollapse() {
    const content = document.getElementById('theory-chapters-collapse');
    const icon = document.getElementById('collapse-icon');
    if (!content || !icon) return;

    content.classList.toggle('hidden');
    icon.classList.toggle('rotate-180');
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

    if (filter === 'all' || filter === 'theory') {
        (rawHistoryData.theory || []).forEach(item => {
            items.push({
                type: 'lesson',
                title: item.article_title || 'Урок',
                chapterTitle: item.chapter_title || '',
                grade: 100,
                date: new Date(item.completed_at)
            });
        });
    }

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
                <td colspan="4" class="py-6 text-center text-[var(--text-main)]">
                    История сдач пока пуста
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => {
        const isLab = item.type === 'lab';
        const isTest = item.type === 'test';
        const isLesson = item.type === 'lesson';

        const typeBadge = isLab 
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><i class="fa-solid fa-flask"></i> Lab</span>`
            : isTest ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><i class="fa-solid fa-list-check"></i> Test</span>`
            : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20"><i class="fa-solid fa-book"></i> Lesson</span>`;

        const titleHTML = (isLesson && item.chapterTitle) 
            ? `<div>
                <div class="font-medium text-[var(--text-main)]">${item.title}</div>
                <div class="text-[10px] text-[var(--text-muted)] opacity-80 font-normal">${item.chapterTitle}</div>
               </div>`
            : `<div class="font-medium text-[var(--text-main)]">${item.title}</div>`;

        let gradeColor = 'text-emerald-400';
        if (item.grade < 60) gradeColor = 'text-red-400';
        else if (item.grade < 80) gradeColor = 'text-amber-400';

        const gradeHTML = isLesson
            ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">✓ Изучено</span>`
            : `<span class="font-bold font-mono ${gradeColor}">${item.grade}%</span>`;

        const formattedDate = item.date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <tr class="hover:bg-[var(--bg-card)] transition">
                <td class="py-3 px-3">${typeBadge}</td>
                <td class="py-3 px-3">${titleHTML}</td>
                <td class="py-3 px-3 text-center">${gradeHTML}</td>
                <td class="py-3 px-3 text-right text-[var(--text-main)]">${formattedDate}</td>
            </tr>
        `;
    }).join('');
}

function filterHistory(filterType) {
    const filterBtns = {
        all: document.getElementById('history-filter-all'),
        theory: document.getElementById('history-filter-theory'),
        labs: document.getElementById('history-filter-labs'),
        tests: document.getElementById('history-filter-tests')
    };

    Object.keys(filterBtns).forEach(key => {
        const btn = filterBtns[key];
        if (!btn) return;

        if (key === filterType) {
            btn.className = 'px-3 py-1 rounded-lg font-medium text-pink-400 bg-pink-500/10 border border-pink-500/20 transition';
        } else {
            btn.className = 'px-3 py-1 rounded-lg font-medium text-[var(--text-main)] hover:text-[var(--text-main)] transition';
        }
    });

    renderHistoryTable(filterType);
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

        if (result.status === 'success') {
            const localUser = JSON.parse(localStorage.getItem('user') || '{}');

            localUser.firstName = firstName;
            localUser.lastName = lastName;

            localStorage.setItem('user', JSON.stringify(localUser));

            Swal.fire({ title: 'Сохранено!', text: 'Данные профиля обновлены', icon: 'success', confirmButtonColor: '#10b981' });

            updateHeaderProfile();
        } else {
            Swal.fire({ title: 'Ошибка', text: result.message || 'Не удалось обновить данные', icon: 'error' });
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

        if (result.status === 'success') {
            Swal.fire({ title: 'Успешно!', text: 'Пароль успешно изменен', icon: 'success', confirmButtonColor: '#10b981' });
            document.getElementById('password-form').reset();
        } else {
            Swal.fire({ title: 'Ошибка', text: result.message || 'Неверный текущий пароль', icon: 'error' });
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