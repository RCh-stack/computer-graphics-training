document.addEventListener('DOMContentLoaded', () => {
    initTestWorkspace();
});

let currentTest = null;
let currentQuestionIndex = 0;
let userAnswers = {};
let timerInterval = null;
let timeRemaining = 0;

async function initTestWorkspace() {
    const urlParams = new URLSearchParams(window.location.search);
    const testId = urlParams.get('id');

    if (!testId) {
        alert('Не указан идентификатор теста');
        window.location.href = 'index.html';
        return;
    }

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
        
        document.getElementById('test-title').textContent = currentTest.title;
        timeRemaining = currentTest.time_limit * 60;

        startTimer();
        renderQuestionsGrid();
        renderCurrentQuestion();
        setupNavigationListeners();

    } catch (error) {
        console.error('Ошибка инициализации workspace:', error);
        alert('Не удалось загрузить данные теста');
        window.location.href = 'index.html';
    }
}

function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            alert('Время отведенное на тест истекло! Ответы отправляются автоматически.');
            submitTest();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    document.getElementById('test-timer').textContent = formatted;
}

function renderQuestionsGrid() {
    const gridContainer = document.getElementById('questions-navigation-grid');
    gridContainer.innerHTML = '';

    currentTest.questions.forEach((t, idx) => {
        const btn = document.createElement('button');
        btn.dataset.index = idx;
        
        const isAnswered = userAnswers[t.id] !== undefined && userAnswers[t.id] !== '';
        const isActive = idx === currentQuestionIndex;

        let classes = 'h-9 w-full rounded-lg text-xs font-bold transition flex items-center justify-center ';
        
        if (isActive) {
            classes += 'ring-2 ring-pink-500 border-transparent bg-pink-600/20 text-pink-400 ';
        } else if (isAnswered) {
            classes += 'bg-blue-600 text-white ';
        } else {
            classes += 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] hover:bg-gray-800 ';
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
    
    if (window.renderMathInElement) {
        renderMathInElement(qTextElem, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false}
            ]
        });
    }

    const mediaContainer = document.getElementById('question-media-container');
    mediaContainer.innerHTML = '';
    
    if (q.type === 'code_analysis' && q.code_snippet) {
        mediaContainer.classList.remove('hidden');
        mediaContainer.innerHTML = `
            <pre class="bg-gray-950 p-4 rounded-xl border border-[var(--border-color)] text-xs font-mono text-gray-200 overflow-x-auto"><code>${escapeHtml(q.code_snippet)}</code></pre>
        `;
    } else if (q.type === 'image_choice' && q.media_url) {
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
                placeholder="Например: 16.0"
                class="w-full max-w-xs bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-4 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-pink-500"
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
            renderQuestionsGrid();
        });
        return;
    }

    if (question.options && Array.isArray(question.options)) {
        question.options.forEach(opt => {
            const isSelected = currentAnswer === opt.id;
            const label = document.createElement('label');
            label.className = `flex items-center justify-between p-4 rounded-xl border cursor-pointer transition ${
                isSelected 
                    ? 'border-pink-500 bg-pink-500/10' 
                    : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-gray-600'
            }`;

            label.innerHTML = `
                <div class="flex items-center space-x-3">
                    <input 
                        type="radio" 
                        name="test_option" 
                        value="${opt.id}" 
                        ${isSelected ? 'checked' : ''}
                        class="accent-pink-500 w-4 h-4"
                    >
                    <span class="text-sm font-medium">${opt.text}</span>
                </div>
            `;

            label.addEventListener('click', () => {
                userAnswers[question.id] = opt.id;
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
            if (confirm('Вы дошли до конца теста. Завершить и проверить ответы?')) {
                submitTest();
            }
        }
    });

    document.getElementById('btn-finish-test').addEventListener('click', () => {
        if (confirm('Вы уверены, что хотите завершить тестирование?')) {
            submitTest();
        }
    });
}

async function submitTest() {
    clearInterval(timerInterval);

    try {
        const token = localStorage.getItem('authToken');

        const response = await fetch(`/api/v1/tests/${currentTest.id}/submit`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ answers: userAnswers })
        });

        if (!response.ok) throw new Error('Не удалось завершить тестирование');

        const result = await response.json();
        
        alert(`Тестирование завершено!\nВаш результат: ${result.score_percent}%\nУспешно отвечено: ${result.correct_count} из ${result.total_count}`);
        window.location.href = 'index.html';

    } catch (error) {
        console.error('Ошибка проверки теста:', error);
        alert('Произошла ошибка при отправке ответов.');
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