document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    initMathEditorModalEvents();
    loadTestDetails();
});

const testId = new URLSearchParams(window.location.search).get('id');
const adminTestDraftKey = `admin_test_${testId || 'new'}`;

const adminTestGuard = window.DraftGuard
    ? window.DraftGuard.create({
          confirmTitle: 'Изменения в тесте не сохранены',
          confirmText: 'Сохранить изменения в тесте перед переходом?',
          onSave: () => saveTest()
      })
    : null;

let questionsState = [];
let activeQIndex = 0;
let activeInputTarget = null;
let isTestLoaded = false;

function normalizeQuestionForSnapshot(q) {
    const type = q.type || 'single_choice';
    return {
        type,
        questionText: q.questionText || '',
        options: type === 'single_choice'
            ? (Array.isArray(q.options) ? q.options.map(o => ({ id: o.id, text: o.text || '' })) : [])
            : [],
        correctAnswer: String(q.correctAnswer ?? ''),
        explanation: q.explanation || '',
        codeSnippet: q.codeSnippet || '',
        mediaUrl: q.mediaUrl || ''
    };
}

function getTestFormSnapshot() {
    const questionsSnapshot = questionsState.map((q, idx) => {
        if (idx === activeQIndex && document.getElementById('q-text')) {
            const type = document.getElementById('q-type').value;
            let options = q.options;
            let correctAnswer = q.correctAnswer;

            if (type === 'single_choice') {
                const optionRows = document.querySelectorAll('.option-input-row');
                options = Array.from(optionRows).map((row, optIdx) => {
                    const textInput = row.querySelector('.option-text-input');
                    return {
                        id: row.dataset.optid || `opt_${optIdx + 1}`,
                        text: textInput ? textInput.value : ''
                    };
                });
                const checkedRadio = document.querySelector('input[name="active_correct_radio"]:checked');
                if (checkedRadio) {
                    correctAnswer = checkedRadio.value;
                }
            } else {
                correctAnswer = document.getElementById('q-direct-correct')?.value.trim() ?? '';
            }

            return normalizeQuestionForSnapshot({
                type,
                questionText: document.getElementById('q-text').value,
                options,
                correctAnswer,
                explanation: document.getElementById('q-explanation').value,
                codeSnippet: document.getElementById('q-code-snippet').value,
                mediaUrl: document.getElementById('q-media-url').value
            });
        }

        return normalizeQuestionForSnapshot(q);
    });

    return {
        title: document.getElementById('test-title')?.value ?? '',
        description: document.getElementById('test-description')?.value ?? '',
        difficulty: document.getElementById('test-difficulty')?.value ?? 'Средний',
        timeLimit: parseInt(document.getElementById('test-time-limit')?.value) || 15,
        isUnlocked: Boolean(document.getElementById('test-is-unlocked')?.checked),
        questions: questionsSnapshot
    };
}

function applyTestSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;

    document.getElementById('test-title').value = snapshot.title || '';
    document.getElementById('test-description').value = snapshot.description || '';
    document.getElementById('test-difficulty').value = snapshot.difficulty || 'Средний';
    document.getElementById('test-time-limit').value = snapshot.timeLimit || 15;
    document.getElementById('test-is-unlocked').checked = Boolean(snapshot.isUnlocked);

    questionsState = Array.isArray(snapshot.questions)
        ? snapshot.questions.map((q, idx) => ({
              id: `restored_${idx}_${Date.now()}`,
              type: q.type || 'single_choice',
              questionText: q.questionText || '',
              options: Array.isArray(q.options) ? q.options.map(o => ({ ...o })) : [],
              correctAnswer: q.correctAnswer || '',
              explanation: q.explanation || '',
              codeSnippet: q.codeSnippet || '',
              mediaUrl: q.mediaUrl || ''
          }))
        : [];

    activeQIndex = 0;
    renderQuestionsNav();
    renderActiveQuestionEditor();
}

function trackTestChanges() {
    if (!isTestLoaded || !adminTestGuard) return;
    adminTestGuard.watch(adminTestDraftKey, getTestFormSnapshot());
}

function initEvents() {
    document.getElementById('btn-save-test')?.addEventListener('click', saveTest);
    document.getElementById('btn-add-question')?.addEventListener('click', addNewQuestion);
    document.getElementById('btn-delete-active-q')?.addEventListener('click', deleteActiveQuestion);
    document.getElementById('btn-add-option')?.addEventListener('click', addOptionToActiveQuestion);

    const watchedFieldIds = [
        'test-title',
        'test-description',
        'test-difficulty',
        'test-time-limit',
        'test-is-unlocked',
        'q-text',
        'q-code-snippet',
        'q-media-url',
        'q-explanation',
        'q-direct-correct'
    ];

    watchedFieldIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const eventName = (el.tagName === 'SELECT' || el.type === 'checkbox') ? 'change' : 'input';
        el.addEventListener(eventName, trackTestChanges);
    });

    document.getElementById('q-type')?.addEventListener('change', (e) => {
        if (questionsState[activeQIndex]) {
            syncDOMToActiveQuestion();
            questionsState[activeQIndex].type = e.target.value;
            renderActiveQuestionEditor();
            trackTestChanges();
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

    document.getElementById('options-list-container')?.addEventListener('input', (e) => {
        if (e.target.classList.contains('option-text-input')) {
            trackTestChanges();
        }
    });

    document.getElementById('options-list-container')?.addEventListener('change', (e) => {
        if (e.target.name === 'active_correct_radio') {
            trackTestChanges();
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

function setEditorLoadingState(isLoading) {
    const navList = document.getElementById('questions-nav-list');
    const editorCard = document.getElementById('question-editor-card');
    const emptyState = document.getElementById('editor-empty-state');
    const saveBtn = document.getElementById('btn-save-test');

    if (saveBtn) saveBtn.disabled = isLoading;

    if (isLoading) {
        if (navList && window.Skeleton) {
            Skeleton.render(navList, Skeleton.questionPalette(6));
        }
        emptyState?.classList.add('hidden');
        editorCard?.classList.add('hidden');

        if (editorCard && editorCard.parentElement && !document.getElementById('question-editor-skeleton') && window.Skeleton) {
            const skeletonWrapper = document.createElement('div');
            skeletonWrapper.id = 'question-editor-skeleton';
            skeletonWrapper.className = editorCard.className.replace('hidden', '');
            skeletonWrapper.innerHTML = Skeleton.testQuestionEditor();
            editorCard.parentElement.insertBefore(skeletonWrapper, editorCard);
        }
    } else {
        document.getElementById('question-editor-skeleton')?.remove();
    }
}

async function loadTestDetails() {
    if (!testId) {
        window.location.href = 'index.html';
        return;
    }

    setEditorLoadingState(true);

    const token = localStorage.getItem('authToken');

    try {
        const res = await fetch(`/api/v1/admin/tests/${testId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok && data.status === 'success') {
            const { test, questions } = data;
            document.getElementById('test-title').value = test.title || '';
            document.getElementById('test-description').value = test.description || '';
            document.getElementById('test-difficulty').value = test.difficulty || 'Средний';
            document.getElementById('test-time-limit').value = test.time_limit || 15;
            document.getElementById('test-is-unlocked').checked = test.is_unlocked;

            questionsState = (questions || []).map(q => {
                let optionsData = q.options_json;
                if (typeof optionsData === 'string') {
                    try { optionsData = JSON.parse(optionsData); } catch { optionsData = {}; }
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
                    options: parsedOptions,
                    correctAnswer: q.correct_answer || '',
                    explanation: q.explanation || '',
                    codeSnippet: codeSnippet,
                    mediaUrl: mediaUrl
                };
            });

            setEditorLoadingState(false);

            activeQIndex = 0;
            renderQuestionsNav();
            renderActiveQuestionEditor();

            isTestLoaded = true;
            const serverSnapshot = getTestFormSnapshot();
            adminTestGuard?.setBaseline(adminTestDraftKey, serverSnapshot);

            if (adminTestGuard?.hasDiffFromBaseline(adminTestDraftKey, serverSnapshot)) {
                const savedDraft = adminTestGuard.load(adminTestDraftKey);
                const savedTime = savedDraft?.savedAt
                    ? new Date(savedDraft.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                const restoreRes = await Swal.fire({
                    title: 'Найден несохранённый черновик',
                    text: `Обнаружены локальные изменения теста${savedTime ? ` от ${savedTime}` : ''}, которые не были сохранены в БД. Восстановить их?`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Восстановить черновик',
                    cancelButtonText: 'Загрузить из БД',
                    confirmButtonColor: '#d97706'
                });

                if (restoreRes.isConfirmed && savedDraft?.data) {
                    applyTestSnapshot(savedDraft.data);
                    trackTestChanges();
                    window.Toast?.info('Черновик восстановлен', 'Нажмите «Сохранить», чтобы записать изменения в БД');
                } else {
                    adminTestGuard.clear(adminTestDraftKey);
                }
            }
        } else {
            throw new Error(data.message || 'Не удалось загрузить тест');
        }
    } catch (err) {
        console.error('Ошибка загрузки теста:', err);
        setEditorLoadingState(false);
        window.Toast?.error('Ошибка загрузки', 'Не удалось загрузить параметры теста');
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
        container.innerHTML = `<span class="col-span-4 text-xs text-[var(--text-muted)] text-center py-2">Пусто</span>`;
        return;
    }

    container.innerHTML = questionsState.map((q, idx) => {
        const isActive = idx === activeQIndex;
        const btnClass = isActive
            ? 'bg-amber-600 text-white font-bold border-amber-500 shadow-md shadow-amber-600/25'
            : 'bg-[var(--bg-elevated)] text-[var(--text-main)] border-[var(--border-color)] hover:border-amber-500/50';

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

    document.getElementById('active-question-header').innerText = `Вопрос №${activeQIndex + 1}`;
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
            const safeOptText = String(opt.text || '')
                .replace(/&/g, '&')
                .replace(/"/g, '"');

            return `
                <div class="option-input-row flex items-center gap-2" data-optid="${opt.id}">
                    <input type="radio" 
                           name="active_correct_radio" 
                           value="${opt.id}" 
                           ${isChecked ? 'checked' : ''} 
                           class="accent-amber-500 cursor-pointer w-4 h-4">
                    <input type="text" 
                           id="opt_${optIndex + 1}"
                           value="${safeOptText}" 
                           class="option-text-input ui-input flex-1 px-3 py-1.5" 
                           placeholder="Вариант ${optIndex + 1}">
                    <button type="button" onclick="openMathEditorFor('opt_${optIndex + 1}')" 
                        class="p-1.5 text-amber-500 hover:text-amber-400 transition" title="Вставить формулу">
                        <i class="fa-solid fa-calculator"></i>
                    </button>
                    <button type="button" class="btn-remove-option text-[var(--text-muted)] hover:text-rose-500 text-xs px-2 transition" data-optindex="${optIndex}">
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
    trackTestChanges();
}

async function deleteActiveQuestion() {
    if (questionsState.length === 0) return;

    const confirmRes = await Swal.fire({
        title: `Удалить вопрос №${activeQIndex + 1}?`,
        text: 'Вопрос будет удален из теста после нажатия «Сохранить».',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Удалить',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#ef4444'
    });

    if (!confirmRes.isConfirmed) return;

    questionsState.splice(activeQIndex, 1);
    if (activeQIndex >= questionsState.length) {
        activeQIndex = Math.max(0, questionsState.length - 1);
    }

    renderQuestionsNav();
    renderActiveQuestionEditor();
    trackTestChanges();
    window.Toast?.info('Вопрос удален', 'Не забудьте сохранить изменения теста');
}

function addOptionToActiveQuestion() {
    syncDOMToActiveQuestion();
    const q = questionsState[activeQIndex];
    if (!q) return;

    const newOptId = `opt_${q.options.length + 1}`;
    q.options.push({ id: newOptId, text: `Вариант ${q.options.length + 1}` });
    renderActiveQuestionEditor();
    trackTestChanges();
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
    trackTestChanges();
}

async function saveTest() {
    if (!isTestLoaded) return false;

    syncDOMToActiveQuestion();

    const saveBtn = document.getElementById('btn-save-test');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.classList.add('opacity-60', 'cursor-not-allowed');
    }

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

        const data = await res.json();

        if (res.ok) {
            adminTestGuard?.markClean(adminTestDraftKey, getTestFormSnapshot());
            Toast.success('Тест успешно обновлен');
            return true;
        } else {
            Toast.error(data.message || 'Не удалось сохранить тест');
            return false;
        }
    } catch (error) {
        console.error(error);
        Toast.error('Ошибка подключения к серверу');
        return false;
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.classList.remove('opacity-60', 'cursor-not-allowed');
        }
    }
}

window.openMathEditorFor = function(target) {
    if (typeof target === 'string') {
        activeInputTarget = document.getElementById(target);
    } else {
        activeInputTarget = target;
    }

    if (!activeInputTarget) {
        console.warn('Целевое поле для вставки формулы не найдено');
        return;
    }

    const mathField = document.getElementById('formula-input-field');
    if (mathField) {
        mathField.value = '\\mathbf{a} \\cdot \\mathbf{b}';
    }

    document.getElementById('math-editor-modal')?.classList.remove('hidden');
};

window.insertSymbol = function(latexSnippet) {
    const mathField = document.getElementById('formula-input-field');
    if (mathField) {
        mathField.insert(latexSnippet);
    }
};

function initMathEditorModalEvents() {
    const modal = document.getElementById('math-editor-modal');
    const btnInsert = document.getElementById('btn-insert-math');
    const btnClose = document.getElementById('btn-close-math-modal');
    const btnCancel = document.getElementById('btn-cancel-math');

    const closeModal = () => modal?.classList.add('hidden');

    btnClose?.addEventListener('click', closeModal);
    btnCancel?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    btnInsert?.addEventListener('click', () => {
        const mathField = document.getElementById('formula-input-field');
        if (!mathField || !activeInputTarget) {
            closeModal();
            return;
        }

        const rawLatex = mathField.value;
        if (!rawLatex || !rawLatex.trim()) {
            closeModal();
            return;
        }

        const formattedFormula = `$${rawLatex.trim()}$`;

        const startPos = activeInputTarget.selectionStart ?? activeInputTarget.value.length;
        const endPos = activeInputTarget.selectionEnd ?? activeInputTarget.value.length;
        const currentValue = activeInputTarget.value;

        activeInputTarget.value = currentValue.substring(0, startPos) + formattedFormula + currentValue.substring(endPos);

        activeInputTarget.dispatchEvent(new Event('input', { bubbles: true }));

        closeModal();
    });
}