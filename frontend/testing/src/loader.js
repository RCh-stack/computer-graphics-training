document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

let allTests = [];

async function initDashboard() {
    try {
        // 1. Загрузка манифеста тестов
        const response = await fetch('content/manifest.json'); // или путь к JSON файлу напрямую
        if (!response.ok) throw new Error('Не удалось загрузить тесты');
        
        allTests = await response.json();

        // 2. Считывание сохраненного прогресса из localStorage
        const userProgress = JSON.parse(localStorage.getItem('tests_progress') || '{}');

        // 3. Обновление статусов блокировки и результатов
        processTestStatuses(allTests, userProgress);

        // 4. Отрисовка статистики и карточек
        renderStats(allTests, userProgress);
        renderTestCards(allTests);

        // 5. Инициализация фильтров
        setupFilterListeners();

    } catch (error) {
        console.error('Ошибка инициализации дашборда:', error);
        showErrorState();
    }
}

/**
 * Проверяет зависимости (prerequisites) и проставление пройденных баллов
 */
function processTestStatuses(tests, progress) {
    tests.forEach(test => {
        const testResult = progress[test.id];

        if (testResult) {
            test.completed = true;
            test.score = testResult.score; // процент выполнения
            test.passed = test.score >= test.passing_score_percent;
        } else {
            test.completed = false;
            test.score = 0;
            test.passed = false;
        }

        // Проверка условия разблокировки по пререквизитам
        if (test.prerequisite_test_id) {
            const prereqResult = progress[test.prerequisite_test_id];
            const isPrereqPassed = prereqResult && (prereqResult.score >= 70); // базовый порог
            test.is_unlocked = Boolean(isPrereqPassed);
        }
    });
}

/**
 * Вычисление и вывод сводных показателей в верхние блоки
 */
function renderStats(tests, progress) {
    const totalCount = tests.length;
    const completedtests = tests.filter(q => q.completed && q.passed);
    
    let avgScore = 0;
    const completedKeys = Object.keys(progress);
    if (completedKeys.length > 0) {
        const totalScoreSum = completedKeys.reduce((acc, key) => acc + (progress[key].score || 0), 0);
        avgScore = Math.round(totalScoreSum / completedKeys.length);
    }

    document.getElementById('stat-total-tests').textContent = totalCount;
    document.getElementById('stat-passed-tests').textContent = completedtests.length;
    document.getElementById('stat-avg-score').textContent = `${avgScore}%`;
}

/**
 * Отрисовка карточек тестов в сетку
 */
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

        // Метка сложности
        const difficultyColor = test.difficulty === 'Легкая' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20';

        // Статус прохождения
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

        const minutes = Math.floor(test.time_limit_sec / 60);

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
                    <span>⏱️ ${minutes} мин</span>
                    <span>❓ ${test.questions.length} вопр.</span>
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

/**
 * Переход на страницу прохождения с ID выбранного теста
 */
window.startTest = function(testId) {
    window.location.href = `test-workspace.html?id=${testId}`;
};

/**
 * Настройка кнопок фильтрации (Все / Доступные / Пройденные)
 */
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