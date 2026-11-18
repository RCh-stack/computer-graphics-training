document.addEventListener('DOMContentLoaded', () => {
    initTestWorkspace();
});

let currentTest = null;
let currentAttempt = null;
let currentQuestionIndex = 0;
let userAnswers = {};
let timerInterval = null;
let targetEndTimestampMs = null;
let hasTimeLimit = true;
let testStartTime = null;
let isSubmittingTest = false;
let isTestCompleted = false;

function getAnswersStorageKey(testId, attemptId) {
    return `cg_test_answers_${testId}_${attemptId || 'active'}`;
}

function loadSavedAnswersFromStorage(storageKey) {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function persistAnswersToStorage() {
    if (!currentTest) return;
    const key = getAnswersStorageKey(currentTest.id, currentAttempt?.id);
    try {
        localStorage.setItem(key, JSON.stringify(userAnswers));
        scheduleServerAnswersSync();
    } catch (error) {
        console.warn('Не удалось сохранить ответы в localStorage:', error);
    }
}

let progressSyncTimer = null;

function scheduleServerAnswersSync() {
    if (!currentTest || isSubmittingTest || isTestCompleted) return;

    clearTimeout(progressSyncTimer);
    progressSyncTimer = setTimeout(syncAnswersToServer, 800);
}

async function syncAnswersToServer() {
    if (!currentTest || isSubmittingTest || isTestCompleted) return;

    try {
        const token = localStorage.getItem('authToken');
        await fetch(`/api/v1/tests/${currentTest.id}/progress`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({
                answers: userAnswers,
                attemptId: currentAttempt?.id || null
            }),
            keepalive: true
        });
    } catch {
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && currentTest && !isTestCompleted) {
        clearTimeout(progressSyncTimer);
        syncAnswersToServer();
    }
});

function clearSavedAnswersFromStorage() {
    if (!currentTest) return;
    const key = getAnswersStorageKey(currentTest.id, currentAttempt?.id);
    localStorage.removeItem(key);
    localStorage.removeItem(getAnswersStorageKey(currentTest.id, 'active'));
}

window.addEventListener('beforeunload', (e) => {
    if (currentTest && !isSubmittingTest && !isTestCompleted) {
        e.preventDefault();
    }
});

function renderWorkspaceSkeletons() {
    if (!window.Skeleton) return;

    Skeleton.render('#questions-navigation-grid', Skeleton.questionPalette(10));
    Skeleton.render('#options-container', Skeleton.questionOptions(4));

    const qTextElem = document.getElementById('question-text');
    if (qTextElem) {
        qTextElem.innerHTML = `
            <div aria-hidden="true" class="space-y-2.5 animate-pulse">
                <div class="h-4 w-5/6 rounded bg-gray-500/20"></div>
                <div class="h-4 w-2/3 rounded bg-gray-500/15"></div>
            </div>
        `;
    }
}

async function initTestWorkspace() {
    const urlParams = new URLSearchParams(window.location.search);
    const testId = urlParams.get('id');

    if (!testId) {
        await Swal.fire({ title: 'Ошибка', text: 'Не указан идентификатор теста', icon: 'error', confirmButtonText: 'ОК' });
        window.location.href = 'index.html';
        return;
    }

    renderWorkspaceSkeletons();

    try {
        const token = localStorage.getItem('authToken');

        const response = await fetch(`/api/v1/tests/${testId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        if (!response.ok) throw new Error('Ошибка загрузки теста');

        const data = await response.json();
        currentTest = data.test;
        currentAttempt = data.attempt || null;

        document.getElementById('test-title').textContent = currentTest.title;

        const timeLimitMinutes = Number(currentTest.time_limit) || 0;

        if (currentAttempt && typeof currentAttempt.remainingSeconds === 'number') {
            hasTimeLimit = true;
            targetEndTimestampMs = Date.now() + currentAttempt.remainingSeconds * 1000;
            testStartTime = currentAttempt.startedAt || new Date().toISOString();
        } else if (currentAttempt && currentAttempt.hasTimeLimit === false) {
            hasTimeLimit = false;
            targetEndTimestampMs = null;
            testStartTime = currentAttempt.startedAt || new Date().toISOString();
        } else if (timeLimitMinutes > 0) {
            hasTimeLimit = true;
            targetEndTimestampMs = Date.now() + timeLimitMinutes * 60 * 1000;
            testStartTime = new Date().toISOString();
        } else {
            hasTimeLimit = false;
            targetEndTimestampMs = null;
            testStartTime = new Date().toISOString();
        }

        const storageKey = getAnswersStorageKey(currentTest.id, currentAttempt?.id);
        const cachedAnswers = loadSavedAnswersFromStorage(storageKey);
        const serverAnswers = (currentAttempt && typeof currentAttempt.savedAnswers === 'object' && currentAttempt.savedAnswers)
            ? currentAttempt.savedAnswers
            : {};

        userAnswers = { ...serverAnswers, ...cachedAnswers };

        const validQuestionIds = new Set((currentTest.questions || []).map(q => String(q.id)));
        Object.keys(userAnswers).forEach(qId => {
            if (!validQuestionIds.has(String(qId))) {
                delete userAnswers[qId];
            }
        });

        const initialRemainingSec = getRemainingSeconds();

        if (hasTimeLimit && (currentAttempt?.isExpired || initialRemainingSec <= 0)) {
            renderQuestionsGrid();
            renderCurrentQuestion();
            await Swal.fire({
                title: 'Время попытки истекло',
                text: 'Отведенное на тест время закончилось. Ваши сохраненные ответы будут отправлены.',
                icon: 'info',
                confirmButtonText: 'ОК',
                allowOutsideClick: false
            });
            await submitTest({ isAutoTimeout: true });
            return;
        }

        if (Object.keys(userAnswers).length > 0 && currentAttempt) {
            window.Toast?.info('Попытка восстановлена', 'Ранее выбранные ответы и остаток времени загружены');
        }

        startTimer();
        renderQuestionsGrid();
        renderCurrentQuestion();
        setupNavigationListeners();

    } catch (error) {
        console.error('Ошибка инициализации workspace:', error);
        await Swal.fire({ title: 'Ошибка', text: 'Не удалось загрузить данные теста', icon: 'error', confirmButtonText: 'ОК' });
        window.location.href = 'index.html';
    }
}

function getRemainingSeconds() {
    if (!hasTimeLimit || targetEndTimestampMs === null) return Infinity;
    return Math.max(0, Math.ceil((targetEndTimestampMs - Date.now()) / 1000));
}

function startTimer() {
    updateTimerDisplay();
    if (!hasTimeLimit) return;

    timerInterval = setInterval(() => {
        const remaining = updateTimerDisplay();

        if (remaining <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            Swal.fire({
                title: 'Время истекло!',
                text: 'Отведенное время закончилось. Ваши ответы будут автоматически отправлены.',
                icon: 'info',
                confirmButtonText: 'ОК',
                allowOutsideClick: false
            }).then(() => {
                submitTest({ isAutoTimeout: true });
            });
        }
    }, 500);
}

function updateTimerDisplay() {
    const timerEl = document.getElementById('test-timer');
    if (!hasTimeLimit) {
        if (timerEl) timerEl.textContent = '∞';
        return Infinity;
    }

    const remaining = getRemainingSeconds();
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    if (timerEl) {
        timerEl.textContent = formatted;
        if (remaining <= 60) {
            timerEl.classList.add('text-rose-500', 'animate-pulse');
        } else {
            timerEl.classList.remove('text-rose-500', 'animate-pulse');
        }
    }

    return remaining;
}

function renderQuestionsGrid() {
    const gridContainer = document.getElementById('questions-navigation-grid');
    gridContainer.innerHTML = '';

    currentTest.questions.forEach((t, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.index = idx;

        const isAnswered = userAnswers[t.id] !== undefined && userAnswers[t.id] !== '';
        const isActive = idx === currentQuestionIndex;

        let classes = 'h-9 w-full rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ';

        if (isActive) {
            classes += 'ring-2 ring-pink-500 border border-transparent bg-pink-500/15 text-pink-500 ';
        } else if (isAnswered) {
            classes += 'bg-blue-600 text-white shadow-sm ';
        } else {
            classes += 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-hover)] hover:border-pink-500/40 ';
        }

        btn.className = classes;
        btn.textContent = idx + 1;
        btn.addEventListener('click', () => {
            currentQuestionIndex = idx;
            renderCurrentQuestion();
            renderQuestionsGrid();
        });

        gridContainer.appendChild(btn);
    });
}

function renderCurrentQuestion() {
    const q = currentTest.questions[currentQuestionIndex];

    document.getElementById('question-number-badge').textContent = `Вопрос ${currentQuestionIndex + 1} из ${currentTest.questions.length}`;

    const qTextElem = document.getElementById('question-text');
    qTextElem.innerHTML = q.question_text;

    if (typeof window.renderMathInElement === 'function') {
        window.renderMathInElement(qTextElem, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false }
            ],
            throwOnError: false
        });
    }

    const mediaContainer = document.getElementById('question-media-container');
    mediaContainer.innerHTML = '';

    if (q.code_snippet) {
        mediaContainer.classList.remove('hidden');
        mediaContainer.innerHTML = `
            <pre class="bg-slate-950 p-4 rounded-xl border border-[var(--border-color)] text-xs font-mono text-slate-200 overflow-x-auto"><code>${escapeHtml(q.code_snippet)}</code></pre>
        `;
    } else if (q.media_url) {
        mediaContainer.classList.remove('hidden');
        mediaContainer.innerHTML = `
            <img src="${q.media_url}" alt="Вопрос" class="max-h-64 rounded-xl border border-[var(--border-color)] object-contain my-2">
        `;
    } else {
        mediaContainer.classList.add('hidden');
    }

    renderInteractiveOptions(q);

    document.getElementById('btn-prev-q').disabled = currentQuestionIndex === 0;
    const nextBtn = document.getElementById('btn-next-q');

    if (currentQuestionIndex === currentTest.questions.length - 1) {
        nextBtn.textContent = 'Завершить →';
        nextBtn.classList.replace('bg-blue-600', 'bg-pink-600');
        nextBtn.classList.replace('hover:bg-blue-500', 'hover:bg-pink-500');
    } else {
        nextBtn.textContent = 'Следующий →';
        nextBtn.classList.replace('bg-pink-600', 'bg-blue-600');
        nextBtn.classList.replace('hover:bg-pink-500', 'hover:bg-blue-500');
    }
}

function renderInteractiveOptions(question) {
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';

    const currentAnswer = userAnswers[question.id];

    if (question.type === 'numeric_input') {
        const wrapper = document.createElement('div');
        wrapper.className = 'space-y-2';
        wrapper.innerHTML = `
            <label class="block text-xs font-mono text-[var(--text-muted)]">Введите числовой ответ:</label>
            <input 
                type="number" 
                step="any"
                id="numeric-answer-input"
                value="${currentAnswer !== undefined ? currentAnswer : ''}"
                placeholder="Например: 10.0"
                class="w-full max-w-xs bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-pink-500 transition"
            >
        `;
        optionsContainer.appendChild(wrapper);

        const input = wrapper.querySelector('#numeric-answer-input');
        input.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val !== '') {
                userAnswers[question.id] = parseFloat(val);
            } else {
                delete userAnswers[question.id];
            }
            persistAnswersToStorage();
            renderQuestionsGrid();
        });
        return;
    }

    if (question.type === 'text_input') {
        const wrapper = document.createElement('div');
        wrapper.className = 'space-y-2';
        wrapper.innerHTML = `
            <label class="block text-xs font-mono text-[var(--text-muted)]">Введите ответ строкой:</label>
            <input 
                type="text" 
                id="text-answer-input"
                value="${currentAnswer !== undefined ? escapeHtml(currentAnswer) : ''}"
                placeholder="Например: ray tracing"
                class="w-full max-w-xs bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-pink-500 transition"
            >
        `;
        optionsContainer.appendChild(wrapper);

        const input = wrapper.querySelector('#text-answer-input');
        input.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val !== '') {
                userAnswers[question.id] = val;
            } else {
                delete userAnswers[question.id];
            }
            persistAnswersToStorage();
            renderQuestionsGrid();
        });
        return;
    }

    if (question.options && Array.isArray(question.options)) {
        question.options.forEach(opt => {
            const isSelected = currentAnswer === opt.id;
            const label = document.createElement('label');
            label.className = `flex items-center justify-between p-4 rounded-xl border cursor-pointer transition text-[var(--text-main)] ${
                isSelected 
                    ? 'border-pink-500 bg-pink-500/10' 
                    : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-pink-500/40 hover:bg-[var(--bg-hover)]'
            }`;

            label.innerHTML = `
                <div class="flex items-center space-x-3">
                    <input 
                        type="radio" 
                        name="test_option" 
                        value="${opt.id}" 
                        ${isSelected ? 'checked' : ''}
                        class="accent-pink-500 w-4 h-4 cursor-pointer"
                    >
                    <span class="text-sm font-medium">${opt.text}</span>
                </div>
            `;

            if (typeof window.renderMathInElement === 'function') {
                window.renderMathInElement(label, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false }
                    ],
                    throwOnError: false
                });
            }

            const radioInput = label.querySelector('input[type="radio"]');
            radioInput.addEventListener('change', () => {
                userAnswers[question.id] = opt.id;
                persistAnswersToStorage();
                renderCurrentQuestion();
                renderQuestionsGrid();
            });

            optionsContainer.appendChild(label);
        });
    }
}

function setupNavigationListeners() {
    document.getElementById('btn-prev-q').addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            renderCurrentQuestion();
            renderQuestionsGrid();
        }
    });

    document.getElementById('btn-next-q').addEventListener('click', () => {
        if (currentQuestionIndex < currentTest.questions.length - 1) {
            currentQuestionIndex++;
            renderCurrentQuestion();
            renderQuestionsGrid();
        } else {
            confirmAndSubmitTest();
        }
    });

    document.getElementById('btn-finish-test').addEventListener('click', () => {
        confirmAndSubmitTest();
    });
}

async function confirmAndSubmitTest() {
    if (isSubmittingTest) return;

    const result = await Swal.fire({
        title: 'Завершение тестирования',
        html: 'Вы уверены, что хотите завершить тестирование и отправить ответы?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Да, завершить',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#ec4899'
    });

    if (result.isConfirmed) {
        submitTest();
    }
}

async function submitTest({ isAutoTimeout = false } = {}) {
    if (isSubmittingTest) return;
    isSubmittingTest = true;

    const finishBtn = document.getElementById('btn-finish-test');
    if (finishBtn) finishBtn.disabled = true;

    try {
        const token = localStorage.getItem('authToken');

        const response = await fetch(`/api/v1/tests/${currentTest.id}/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({
                answers: userAnswers,
                startedIn: testStartTime,
                attemptId: currentAttempt?.id || null,
                isAutoTimeout
            })
        });

        if (!response.ok) throw new Error('Не удалось завершить тестирование');

        clearInterval(timerInterval);
        timerInterval = null;
        isTestCompleted = true;
        clearSavedAnswersFromStorage();

        const result = await response.json();
        const passThreshold = currentTest.passing_score ?? 70;

        await showTestResultModal({
            score: result.score_percent,
            correctCount: result.correct_count,
            totalCount: result.total_count,
            passed: result.passed !== undefined ? Boolean(result.passed) : result.score_percent >= passThreshold
        });

        window.location.href = 'index.html';
    } catch (error) {
        console.error('Ошибка проверки теста:', error);
        window.Toast?.error('Ошибка отправки', 'Не удалось сохранить ответы. Проверьте соединение и повторите попытку.', { duration: 5000 });
    } finally {
        isSubmittingTest = false;
        if (finishBtn) finishBtn.disabled = false;
    }
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}