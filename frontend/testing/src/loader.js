document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

let allTests = [];

async function initDashboard() {
    try {
        const token = localStorage.getItem('authToken');

        const response = await fetch(`/api/v1/tests/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        if (!response.ok) throw new Error('Не удалось загрузить тесты');

        const data = await response.json();
        const rawTests = data.tests || [];

        allTests = processTestStatuses(rawTests);

        renderStats(allTests);
        renderTestCards(allTests);

        setupFilterListeners();

    } catch (error) {
        console.error('Ошибка инициализации дашборда:', error);
        showErrorState();
    }
}

function processTestStatuses(tests) {
    return tests.map(test => {
        const score = test.score !== null ? Number(test.score) : 0;
        const completed = Boolean(test.is_completed);
        const passed = score >= 70;

        return {
            id: test.id,
            title: test.title,
            description: test.description || 'Описание отсутствует',
            difficulty: test.difficulty || 'Не указана',
            time_limit: test.time_limit || 10,
            questions_count: test.questions_count || 0,
            is_unlocked: test.is_unlocked ?? true,
            score: score,
            completed: completed,
            passed: passed
        };
    });
}

function renderStats(tests) {
    const totalCount = tests.length;
    const completedTests = tests.filter(q => q.completed && q.passed);
    
    let avgScore = 0;
    if (completedTests.length > 0) {
        const totalScoreSum = completedTests.reduce((acc, test) => acc + test.score, 0);
        avgScore = Math.round(totalScoreSum / completedTests.length);
    }

    document.getElementById('stat-total-tests').textContent = totalCount;
    document.getElementById('stat-passed-tests').textContent = completedTests.length;
    document.getElementById('stat-avg-score').textContent = `${avgScore}%`;
}

function renderTestCards(testsToRender) {
    const container = document.getElementById('tests-grid');
    container.innerHTML = '';

    if (testsToRender.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-8 text-[var(--text-muted)] text-sm">
                Тестирования не найдены.
            </div>
        `;
        return;
    }

    testsToRender.forEach(test => {
        const card = document.createElement('div');
        card.className = `bg-[var(--bg-panel)] border rounded-xl p-5 flex flex-col justify-between transition relative overflow-hidden ${
            test.is_unlocked 
                ? 'border-[var(--border-color)] hover:border-pink-500/50' 
                : 'border-[var(--border-color)] opacity-60 bg-gray-900/20'
        }`;

        const difficultyColor = test.difficulty === 'Легкая' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20';

        let statusBadge = '';
        if (!test.is_unlocked) {
            statusBadge = `<span class="text-xs px-2.5 py-1 rounded-md bg-gray-800 text-gray-400 border border-gray-700">🔒 Заблокирован</span>`;
        } else if (test.completed) {
            statusBadge = test.passed
                ? `<span class="text-xs px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">✓ Пройден (${test.score}%)</span>`
                : `<span class="text-xs px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">✕ Не сдан (${test.score}%)</span>`;
        } else {
            statusBadge = `<span class="text-xs px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">Доступен</span>`;
        }

        card.innerHTML = `
            <div class="space-y-3">
                <div class="flex items-center justify-between gap-2">
                    <span class="text-[11px] font-mono px-2 py-0.5 rounded border ${difficultyColor}">
                        ${test.difficulty}
                    </span>
                    ${statusBadge}
                </div>

                <div>
                    <h3 class="font-bold text-base text-[var(--text-main)]">${test.title}</h3>
                    <p class="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">${test.description}</p>
                </div>
            </div>

            <div class="pt-4 mt-4 border-t border-[var(--border-color)] flex items-center justify-between">
                <div class="text-xs text-[var(--text-muted)] font-mono flex space-x-3">
                    <span>⏱️ ${test.time_limit} мин</span>
                    <span>❓ ${test.questions_count} вопр.</span>
                </div>

                <button 
                    onclick="startTest('${test.id}')"
                    ${!test.is_unlocked ? 'disabled' : ''}
                    class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                        test.is_unlocked 
                            ? 'bg-pink-600 hover:bg-pink-500 text-white shadow-md cursor-pointer' 
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }">
                    ${test.completed ? 'Пересдать' : 'Начать'}
                </button>
            </div>
        `;

        container.appendChild(card);
    });
}

window.startTest = function(testId) {
    window.location.href = `test-workspace.html?id=${testId}`;
};

function setupFilterListeners() {
    const filterBtns = document.querySelectorAll('.test-filter-btn');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => {
                b.classList.remove('bg-pink-600', 'text-white', 'active');
                b.classList.add('bg-[var(--bg-card)]');
            });

            e.target.classList.add('bg-pink-600', 'text-white', 'active');
            e.target.classList.remove('bg-[var(--bg-card)]');

            const filter = e.target.getAttribute('data-filter');
            applyFilter(filter);
        });
    });
}

function applyFilter(filter) {
    let filtered = [...allTests];

    if (filter === 'available') {
        filtered = allTests.filter(q => q.is_unlocked && !q.completed);
    } else if (filter === 'completed') {
        filtered = allTests.filter(q => q.completed);
    }

    renderTestCards(filtered);
}

function showErrorState() {
    const container = document.getElementById('tests-grid');
    container.innerHTML = `
        <div class="col-span-full text-center py-8 text-rose-400 text-sm">
            Ошибка при загрузке списка тестов. Проверьте подключение к серверу.
        </div>
    `;
}