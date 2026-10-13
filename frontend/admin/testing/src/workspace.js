document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    loadTestDetails();
});

const testId = new URLSearchParams(window.location.search).get('id');

let questionsState = [];
let activeQIndex = 0;

function initEvents() {
    document.getElementById('btn-save-test')?.addEventListener('click', saveTest);
    document.getElementById('btn-add-question')?.addEventListener('click', addNewQuestion);
    document.getElementById('btn-delete-active-q')?.addEventListener('click', deleteActiveQuestion);
    document.getElementById('btn-add-option')?.addEventListener('click', addOptionToActiveQuestion);

    document.getElementById('q-type')?.addEventListener('change', (e) => {
        if (questionsState[activeQIndex]) {
            syncDOMToActiveQuestion();
            questionsState[activeQIndex].type = e.target.value;
            renderActiveQuestionEditor();
        }
    });

    document.getElementById('questions-nav-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.q-nav-btn');
        if (btn) {
            const idx = parseInt(btn.dataset.index);
            if (!isNaN(idx) && idx !== activeQIndex) {
                switchActiveQuestion(idx);
            }
        }
    });

    document.getElementById('options-list-container')?.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.btn-remove-option');
        if (removeBtn) {
            const optIndex = parseInt(removeBtn.dataset.optindex);
            removeOptionFromActiveQuestion(optIndex);
        }
    });
}

async function loadTestDetails() {
    if (!testId) {
        window.location.href = 'index.html';
        return;
    }

    const token = localStorage.getItem('authToken');

    try {
        const res = await fetch(`/api/v1/admin/tests/${testId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.status === 'success') {
            const { test, questions } = data;
            document.getElementById('test-title').value = test.title || '';
            document.getElementById('test-description').value = test.description || '';
            document.getElementById('test-difficulty').value = test.difficulty || 'Средний';
            document.getElementById('test-time-limit').value = test.time_limit || 15;
            document.getElementById('test-is-unlocked').checked = test.is_unlocked;

            questionsState = (questions || []).map(q => {
                let optionsData = q.options_json;
                if (typeof optionsData === 'string') {
                    try { optionsData = JSON.parse(optionsData); } catch(e) { optionsData = {}; }
                }

                let qType = 'text_input';
                let parsedOptions = [];
                let mediaUrl = '';
                let codeSnippet = '';

                if (optionsData && typeof optionsData === 'object') {
                    if (optionsData.type) qType = optionsData.type;
                    if (Array.isArray(optionsData.options)) parsedOptions = optionsData.options;
                    if (optionsData.media_url) mediaUrl = optionsData.media_url;
                    if (optionsData.code_snippet) codeSnippet = optionsData.code_snippet;
                }

                return {
                    id: q.id,
                    type: qType,
                    questionText: q.question_text || '',
                    options: parsedOptions, // [{ id: 'opt_1', text: '...' }]
                    correctAnswer: q.correct_answer || '',
                    explanation: q.explanation || '',
                    codeSnippet: codeSnippet,
                    mediaUrl: mediaUrl
                };
            });

            activeQIndex = 0;
            renderQuestionsNav();
            renderActiveQuestionEditor();
        }
    } catch (err) {
        console.error('Ошибка загрузки теста:', err);
    }
}

function switchActiveQuestion(newIndex) {
    syncDOMToActiveQuestion();
    activeQIndex = newIndex;
    renderQuestionsNav();
    renderActiveQuestionEditor();
}

function syncDOMToActiveQuestion() {
    if (!questionsState[activeQIndex]) return;

    const q = questionsState[activeQIndex];
    q.questionText = document.getElementById('q-text').value;
    q.type = document.getElementById('q-type').value;
    q.codeSnippet = document.getElementById('q-code-snippet').value;
    q.mediaUrl = document.getElementById('q-media-url').value;
    q.explanation = document.getElementById('q-explanation').value;

    if (q.type === 'single_choice') {
        const optionRows = document.querySelectorAll('.option-input-row');
        const updatedOptions = [];

        optionRows.forEach((row, idx) => {
            const textInput = row.querySelector('.option-text-input');
            const optId = row.dataset.optid || `opt_${idx + 1}`;
            updatedOptions.push({
                id: optId,
                text: textInput ? textInput.value : ''
            });
        });
        q.options = updatedOptions;

        const checkedRadio = document.querySelector('input[name="active_correct_radio"]:checked');
        if (checkedRadio) {
            q.correctAnswer = checkedRadio.value;
        }
    } else {
        q.correctAnswer = document.getElementById('q-direct-correct').value.trim();
    }
}

function renderQuestionsNav() {
    const container = document.getElementById('questions-nav-list');
    const counter = document.getElementById('questions-counter');
    if (!container) return;

    counter.innerText = questionsState.length;

    if (questionsState.length === 0) {
        container.innerHTML = `<span class="col-span-4 text-xs text-gray-500 text-center py-2">Пусто</span>`;
        return;
    }

    container.innerHTML = questionsState.map((q, idx) => {
        const isActive = idx === activeQIndex;
        const btnClass = isActive 
            ? 'bg-pink-600 text-white font-bold border-pink-500 shadow-md shadow-pink-600/30' 
            : 'bg-[var(--bg-panel)] text-[var(--text-main)] border-gray-700 hover:border-pink-500/50';

        return `
            <button type="button" data-index="${idx}" class="q-nav-btn py-2 px-1 text-xs rounded-xl border transition text-center font-mono ${btnClass}">
                ${idx + 1}
            </button>
        `;
    }).join('');
}

function renderActiveQuestionEditor() {
    const editorCard = document.getElementById('question-editor-card');
    const emptyState = document.getElementById('editor-empty-state');

    if (questionsState.length === 0) {
        editorCard.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    editorCard.classList.remove('hidden');
    emptyState.classList.add('hidden');

    const q = questionsState[activeQIndex];

    document.getElementById('active-question-header').innerText = `Вопрос ${activeQIndex + 1}`;
    document.getElementById('q-text').value = q.questionText || '';
    document.getElementById('q-type').value = q.type || 'single_choice';
    document.getElementById('q-code-snippet').value = q.codeSnippet || '';
    document.getElementById('q-media-url').value = q.mediaUrl || '';
    document.getElementById('q-explanation').value = q.explanation || '';

    const optionsBlock = document.getElementById('options-manager-block');
    const directBlock = document.getElementById('direct-answer-block');

    if (q.type === 'single_choice') {
        optionsBlock.classList.remove('hidden');
        directBlock.classList.add('hidden');

        const optionsContainer = document.getElementById('options-list-container');
        if (q.options.length === 0) {
            q.options = [
                { id: 'opt_1', text: 'Вариант 1' },
                { id: 'opt_2', text: 'Вариант 2' }
            ];
            q.correctAnswer = 'opt_1';
        }

        optionsContainer.innerHTML = q.options.map((opt, optIndex) => {
            const isChecked = q.correctAnswer === opt.id;

            return `
                <div class="option-input-row flex items-center gap-2" data-optid="${opt.id}">
                    <input type="radio" 
                           name="active_correct_radio" 
                           value="${opt.id}" 
                           ${isChecked ? 'checked' : ''} 
                           class="accent-pink-500 cursor-pointer w-4 h-4">
                    <input type="text" 
                           value="${opt.text || ''}" 
                           class="option-text-input flex-1 px-3 py-1.5 bg-[var(--bg-panel)] border border-gray-700 rounded-lg text-xs focus:outline-none focus:border-pink-500" 
                           placeholder="Вариант ${optIndex + 1}">
                    <button type="button" class="btn-remove-option text-gray-500 hover:text-red-400 text-xs px-2" data-optindex="${optIndex}">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        }).join('');
    } else {
        optionsBlock.classList.add('hidden');
        directBlock.classList.remove('hidden');
        document.getElementById('q-direct-correct').value = q.correctAnswer || '';
    }
}

function addNewQuestion() {
    syncDOMToActiveQuestion();

    questionsState.push({
        id: `temp_${Date.now()}`,
        type: 'single_choice',
        questionText: '',
        options: [
            { id: 'opt_1', text: 'Вариант 1' },
            { id: 'opt_2', text: 'Вариант 2' }
        ],
        correctAnswer: 'opt_1',
        explanation: '',
        codeSnippet: '',
        mediaUrl: ''
    });

    activeQIndex = questionsState.length - 1;
    renderQuestionsNav();
    renderActiveQuestionEditor();
}

function deleteActiveQuestion() {
    if (questionsState.length === 0) return;

    questionsState.splice(activeQIndex, 1);
    if (activeQIndex >= questionsState.length) {
        activeQIndex = Math.max(0, questionsState.length - 1);
    }

    renderQuestionsNav();
    renderActiveQuestionEditor();
}

function addOptionToActiveQuestion() {
    syncDOMToActiveQuestion();
    const q = questionsState[activeQIndex];
    if (!q) return;

    const newOptId = `opt_${q.options.length + 1}`;
    q.options.push({ id: newOptId, text: `Вариант ${q.options.length + 1}` });
    renderActiveQuestionEditor();
}

function removeOptionFromActiveQuestion(optIndex) {
    syncDOMToActiveQuestion();
    const q = questionsState[activeQIndex];
    if (!q || !q.options[optIndex]) return;

    const removedId = q.options[optIndex].id;
    q.options.splice(optIndex, 1);

    if (q.correctAnswer === removedId && q.options.length > 0) {
        q.correctAnswer = q.options[0].id;
    }

    renderActiveQuestionEditor();
}

async function saveTest() {
    syncDOMToActiveQuestion();

    const token = localStorage.getItem('authToken');

    const formattedQuestions = questionsState.map(q => {
        return {
            questionText: q.questionText,
            options_json: {
                type: q.type,
                options: q.type === 'single_choice' ? q.options : [],
                media_url: q.mediaUrl || '',
                code_snippet: q.codeSnippet || ''
            },
            correctAnswer: q.correctAnswer,
            explanation: q.explanation
        };
    });

    const payload = {
        title: document.getElementById('test-title').value,
        description: document.getElementById('test-description').value,
        difficulty: document.getElementById('test-difficulty').value,
        timeLimit: parseInt(document.getElementById('test-time-limit').value) || 15,
        isUnlocked: document.getElementById('test-is-unlocked').checked,
        questions: formattedQuestions
    };

    try {
        const res = await fetch(`/api/v1/admin/tests/${testId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            Swal.fire({ title: 'Сохранено!', text: 'Тест успешно обновлен', icon: 'success', confirmButtonColor: '#f59e0b' });
        } else {
            Swal.fire('Ошибка', 'Не удалось сохранить данные теста', 'error');
        }
    } catch (err) {
        console.error(err);
        Swal.fire('Ошибка', 'Ошибка подключения к серверу', 'error');
    }
}