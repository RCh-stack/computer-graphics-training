document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    initModalCloseEvents();
});

let allTests = [];
let currentTestQuestionsData = [];
let activeQuestionIndex = 0;

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

        let difficultyColor = '';
        if (test.difficulty === 'Легкий')
            difficultyColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        else if (test.difficulty === 'Средний')
            difficultyColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        else
            difficultyColor = 'text-red-400 bg-red-500/10 border-red-500/20';

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

            <div class="pt-4 mt-4 border-t border-[var(--border-color)] flex items-center justify-between gap-2">
                <div class="text-xs text-[var(--text-muted)] font-mono flex space-x-3">
                    <span>⏱️ ${test.time_limit} мин</span>
                    <span>❓ ${test.questions_count} вопр.</span>
                </div>

                <div class="flex items-center gap-2">
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

                    ${test.completed ? `
                        <button 
                            onclick="openTestAnalysis('${test.id}', '${test.title}')" 
                            class="px-3 py-1.5 rounded-lg text-xs font-bold transition bg-[var(--bg-card)] hover:bg-gray-300/30 text-[var(--text-main)] border border-[var(--border-color)] flex items-center gap-1.5 cursor-pointer"
                            title="Разбор ошибок">
                            <i class="fa-solid fa-chart-pie text-pink-400"></i>
                            <span>Анализ</span>
                        </button>
                    ` : ''}
                </div>
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

async function openTestAnalysis(testId, testTitle) {
    currentTestQuestionsData = [];
    activeQuestionIndex = 0;

    const palette = document.getElementById('questions-palette');
    const optionsContainer = document.getElementById('analysis-options-container');
    const explanationText = document.getElementById('analysis-explanation-text');
    const questionTitle = document.getElementById('analysis-question-title');
    const statusBadge = document.getElementById('analysis-status-badge');

    if (palette) palette.innerHTML = '';
    if (optionsContainer) optionsContainer.innerHTML = '';
    if (explanationText) explanationText.innerText = 'Загрузка данных...';
    if (questionTitle) questionTitle.innerText = 'Загрузка вопроса...';
    if (statusBadge) {
        statusBadge.innerText = '—';
        statusBadge.className = 'px-2.5 py-1 rounded-lg text-xs font-bold border border-gray-700 bg-gray-800 text-gray-400';
    }

    document.getElementById('analysis-test-title').innerText = testTitle;
    document.getElementById('analysis-score').innerText = '0%';
    document.getElementById('test-analysis-modal')?.classList.remove('hidden');

    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`/api/v1/tests/${testId}/result`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });
        const data = await response.json();

        if (data.status === 'success' && data.result) {
            const { scorePercent, questions } = data.result;

            currentTestQuestionsData = questions || [];
            document.getElementById('analysis-score').innerText = `${scorePercent}%`;

            if (currentTestQuestionsData.length === 0) {
                if (questionTitle) questionTitle.innerText = 'В данном тестировании отсутствуют вопросы';
                if (explanationText) explanationText.innerText = 'Для данного теста нет сохраненных вопросов.';
                return;
            }

            renderQuestionsPalette();
            selectQuestionForAnalysis(0);
        } else {
            if (questionTitle) questionTitle.innerText = 'Результаты недоступны';
            if (explanationText) explanationText.innerText = data.message || 'Ошибка получения результатов теста.';
        }
    } catch (error) {
        console.error('Ошибка загрузки разбора теста:', error);
        if (questionTitle) questionTitle.innerText = 'Ошибка загрузки';
        if (explanationText) explanationText.innerText = 'Не удалось загрузить данные с сервера.';
    }
}

function renderQuestionsPalette() {
    const palette = document.getElementById('questions-palette');
    if (!palette) return;

    if (currentTestQuestionsData.length === 0) {
        palette.innerHTML = `<span class="text-xs text-gray-500 col-span-full">Нет вопросов</span>`;
        return;
    }

    palette.innerHTML = currentTestQuestionsData.map((q, idx) => {
        let styleClass = 'bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border-color)] hover:border-pink-500';

        if (q.status === 'correct') {
            styleClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30';
        } else if (q.status === 'incorrect') {
            styleClass = 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30';
        }

        return `
            <button type="button" 
                onclick="selectQuestionForAnalysis(${idx})" 
                id="btn-palette-q-${idx}" 
                class="w-9 h-9 rounded-xl font-mono text-xs font-bold border transition flex items-center justify-center cursor-pointer ${styleClass}">
                ${idx + 1}
            </button>
        `;
    }).join('');
}

function selectQuestionForAnalysis(index) {
    if (!currentTestQuestionsData[index]) return;

    activeQuestionIndex = index;
    const q = currentTestQuestionsData[index];

    document.querySelectorAll('#questions-palette button').forEach((btn, i) => {
        if (i === index) {
            btn.classList.add('ring-2', 'ring-pink-500', 'scale-105');
        } else {
            btn.classList.remove('ring-2', 'ring-pink-500', 'scale-105');
        }
    });

    document.getElementById('analysis-question-title').innerText = `Вопрос №${q.number}: ${q.questionText}`;

    const badgeEl = document.getElementById('analysis-status-badge');
    if (q.status === 'correct') {
        badgeEl.className = 'px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
        badgeEl.innerText = '✓ Верно';
    } else if (q.status === 'incorrect') {
        badgeEl.className = 'px-2.5 py-1 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20';
        badgeEl.innerText = '✕ Ошибка';
    } else {
        badgeEl.className = 'px-2.5 py-1 rounded-lg text-xs font-bold bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-color)]';
        badgeEl.innerText = '— Пропущен';
    }

    document.getElementById('analysis-explanation-text').innerText = q.explanation || 'Пояснение к данному вопросу отсутствует.';

    renderOptionsAnalysis(q);
}

function renderOptionsAnalysis(q) {
    const container = document.getElementById('analysis-options-container');
    if (!container) return;

    if (!q.options || q.options.length === 0) {
        container.innerHTML = `
            <div class="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] space-y-2 text-xs">
                <div><span class="text-[var(--text-muted)]">Ваш ответ:</span> <span class="font-bold text-[var(--text-main)]">${q.userAnswer || '—'}</span></div>
                <div><span class="text-[var(--text-muted)]">Правильный ответ:</span> <span class="font-bold text-emerald-400">${q.correctAnswer}</span></div>
            </div>
        `;
        return;
    }

    container.innerHTML = q.options.map(opt => {
        const optId = typeof opt === 'object' ? opt.id : opt;
        const optText = typeof opt === 'object' ? opt.text : opt;

        const isUserSelected = String(optId) === String(q.userAnswer) || String(optText) === String(q.userAnswer);
        const isCorrectOpt = String(optId) === String(q.correctAnswer) || String(optText) === String(q.correctAnswer);

        let optionStyle = 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-main)]';
        let badgeHtml = '';

        if (isCorrectOpt) {
            optionStyle = 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-semibold';
            badgeHtml = `<span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">Правильный ответ</span>`;
        }
        
        if (isUserSelected && !isCorrectOpt) {
            optionStyle = 'bg-red-500/10 border-red-500/40 text-red-400 font-semibold';
            badgeHtml = `<span class="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">Ваш выбор</span>`;
        } else if (isUserSelected && isCorrectOpt) {
            badgeHtml = `<span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">Ваш выбор (Верно)</span>`;
        }

        return `
            <div class="p-3 rounded-xl border ${optionStyle} text-xs flex justify-between items-center transition">
                <span>${optText}</span>
                ${badgeHtml}
            </div>
        `;
    }).join('');
}

function initModalCloseEvents() {
    const modal = document.getElementById('test-analysis-modal');
    const closeBtn = document.getElementById('btn-close-analysis');

    const closeModal = () => modal?.classList.add('hidden');

    closeBtn?.addEventListener('click', closeModal);

    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}