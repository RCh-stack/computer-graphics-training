document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    loadLabDetails();
});

const labId = new URLSearchParams(window.location.search).get('id');
const adminLabDraftKey = `admin_lab_${labId || 'new'}`;

const adminLabGuard = window.DraftGuard
    ? window.DraftGuard.create({
          confirmTitle: 'Изменения в лабораторной не сохранены',
          confirmText: 'Сохранить изменения в базе данных перед переходом?',
          onSave: () => saveLab()
      })
    : null;

let labState = {
    requirements: [],
    testCases: []
};
let activeTCIndex = 0;
let isLabLoaded = false;

let adminTemplatesState = {
    cpp: '',
    python: '',
    csharp: '',
    go: ''
};
let activeAdminLang = 'cpp';

function getLabFormSnapshot() {
    const templatesSnapshot = {
        ...adminTemplatesState,
        [activeAdminLang]: document.getElementById('lab-template-code')?.value ?? ''
    };

    const requirementsSnapshot = [...labState.requirements];
    document.querySelectorAll('#requirements-list .req-input').forEach((input, idx) => {
        if (requirementsSnapshot[idx] !== undefined) {
            requirementsSnapshot[idx] = input.value;
        }
    });

    const testCasesSnapshot = labState.testCases.map((tc, idx) => {
        if (idx === activeTCIndex && document.getElementById('tc-name')) {
            return {
                ...tc,
                name: document.getElementById('tc-name').value,
                input: document.getElementById('tc-input').value,
                expected_output: document.getElementById('tc-output').value,
                timeout_ms: parseInt(document.getElementById('tc-timeout').value) || 1000
            };
        }
        return { ...tc };
    });

    return {
        title: document.getElementById('lab-title')?.value ?? '',
        description: document.getElementById('lab-description')?.value ?? '',
        difficulty: document.getElementById('lab-difficulty')?.value ?? 'Средний',
        order: parseInt(document.getElementById('lab-order')?.value) || 0,
        isUnlocked: Boolean(document.getElementById('lab-is-unlocked')?.checked),
        templates: templatesSnapshot,
        taskTitle: document.getElementById('task-title')?.value ?? '',
        taskInstruction: document.getElementById('task-instruction')?.value ?? '',
        requirements: requirementsSnapshot,
        testCases: testCasesSnapshot
    };
}

function applyLabFormSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;

    document.getElementById('lab-title').value = snapshot.title || '';
    document.getElementById('lab-difficulty').value = snapshot.difficulty || 'Средний';
    document.getElementById('lab-order').value = snapshot.order || 0;
    document.getElementById('lab-is-unlocked').checked = Boolean(snapshot.isUnlocked);
    document.getElementById('lab-description').value = snapshot.description || '';

    adminTemplatesState = {
        cpp: '',
        python: '',
        csharp: '',
        go: '',
        ...(snapshot.templates || {})
    };
    activeAdminLang = 'cpp';
    const langSelect = document.getElementById('admin-template-lang-select');
    if (langSelect) langSelect.value = 'cpp';
    document.getElementById('lab-template-code').value = adminTemplatesState.cpp || '';

    document.getElementById('task-title').value = snapshot.taskTitle || '';
    document.getElementById('task-instruction').value = snapshot.taskInstruction || '';
    labState.requirements = Array.isArray(snapshot.requirements) ? [...snapshot.requirements] : [];
    labState.testCases = Array.isArray(snapshot.testCases) ? snapshot.testCases.map(tc => ({ ...tc })) : [];

    activeTCIndex = 0;
    renderRequirements();
    renderTestCaseNav();
    renderActiveTestCaseEditor();
}

function trackLabChanges() {
    if (!isLabLoaded || !adminLabGuard) return;
    adminLabGuard.watch(adminLabDraftKey, getLabFormSnapshot());
}

function initEvents() {
    document.getElementById('btn-save-lab')?.addEventListener('click', saveLab);
    document.getElementById('btn-add-req')?.addEventListener('click', addRequirement);
    document.getElementById('btn-add-testcase')?.addEventListener('click', addNewTestCase);
    document.getElementById('btn-delete-active-tc')?.addEventListener('click', deleteActiveTestCase);

    const watchedFieldIds = [
        'lab-title',
        'lab-difficulty',
        'lab-order',
        'lab-is-unlocked',
        'lab-description',
        'lab-template-code',
        'task-title',
        'task-instruction',
        'tc-name',
        'tc-input',
        'tc-output',
        'tc-timeout'
    ];

    watchedFieldIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const eventName = (el.tagName === 'SELECT' || el.type === 'checkbox') ? 'change' : 'input';
        el.addEventListener(eventName, trackLabChanges);
    });

    document.getElementById('admin-template-lang-select')?.addEventListener('change', (e) => {
        adminTemplatesState[activeAdminLang] = document.getElementById('lab-template-code').value;

        activeAdminLang = e.target.value;
        document.getElementById('lab-template-code').value = adminTemplatesState[activeAdminLang] || '';
        trackLabChanges();
    });

    document.getElementById('testcase-nav-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.tc-nav-btn');
        if (btn) {
            const idx = parseInt(btn.dataset.index);
            if (!isNaN(idx) && idx !== activeTCIndex) {
                switchActiveTestCase(idx);
            }
        }
    });

    document.getElementById('requirements-list')?.addEventListener('input', (e) => {
        if (e.target.closest('.req-input')) {
            trackLabChanges();
        }
    });

    document.getElementById('requirements-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-remove-req');
        if (btn) {
            syncRequirementsFromDOM();
            const idx = parseInt(btn.dataset.index);
            labState.requirements.splice(idx, 1);
            renderRequirements();
            trackLabChanges();
        }
    });
}

function setLabLoadingState(isLoading) {
    const saveBtn = document.getElementById('btn-save-lab');
    const reqList = document.getElementById('requirements-list');
    const tcNav = document.getElementById('testcase-nav-list');
    const editorCard = document.getElementById('tc-editor-card');
    const emptyState = document.getElementById('tc-empty-state');

    if (saveBtn) saveBtn.disabled = isLoading;

    if (isLoading) {
        if (reqList) {
            reqList.innerHTML = `
                <div aria-hidden="true" class="space-y-2 animate-pulse">
                    <div class="h-7 w-full rounded-lg bg-gray-500/15"></div>
                    <div class="h-7 w-4/5 rounded-lg bg-gray-500/15"></div>
                </div>
            `;
        }
        if (tcNav && window.Skeleton) {
            Skeleton.render(tcNav, Skeleton.questionPalette(4));
        }

        emptyState?.classList.add('hidden');
        editorCard?.classList.add('hidden');

        if (editorCard && editorCard.parentElement && !document.getElementById('tc-editor-skeleton') && window.Skeleton) {
            const skeletonWrapper = document.createElement('div');
            skeletonWrapper.id = 'tc-editor-skeleton';
            skeletonWrapper.className = editorCard.className.replace('hidden', '');
            skeletonWrapper.innerHTML = Skeleton.labTestCaseEditor();
            editorCard.parentElement.insertBefore(skeletonWrapper, editorCard);
        }
    } else {
        document.getElementById('tc-editor-skeleton')?.remove();
    }
}

async function loadLabDetails() {
    if (!labId) {
        window.location.href = 'labs.html';
        return;
    }

    setLabLoadingState(true);
    const token = localStorage.getItem('authToken');

    try {
        const res = await fetch(`/api/v1/admin/labs/${labId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok && data.status === 'success') {
            const lab = data.lab;

            document.getElementById('lab-title').value = lab.title || '';
            document.getElementById('lab-difficulty').value = lab.difficulty || 'Средний';
            document.getElementById('lab-order').value = lab.order || 0;
            document.getElementById('lab-is-unlocked').checked = lab.is_unlocked;
            document.getElementById('lab-description').value = lab.description || '';

            let rawTemplate = lab.template_code;
            if (typeof rawTemplate === 'string') {
                try {
                    const parsed = JSON.parse(rawTemplate);
                    if (typeof parsed === 'object' && parsed !== null) {
                        adminTemplatesState = { cpp: '', python: '', csharp: '', go: '', ...parsed };
                    } else {
                        adminTemplatesState.cpp = rawTemplate;
                    }
                } catch {
                    adminTemplatesState.cpp = rawTemplate;
                }
            } else if (typeof rawTemplate === 'object' && rawTemplate !== null) {
                adminTemplatesState = { cpp: '', python: '', csharp: '', go: '', ...rawTemplate };
            }

            activeAdminLang = 'cpp';
            const langSelect = document.getElementById('admin-template-lang-select');
            if (langSelect) langSelect.value = 'cpp';
            document.getElementById('lab-template-code').value = adminTemplatesState.cpp || '';

            let taskJson = lab.task_json;
            if (typeof taskJson === 'string') {
                try { taskJson = JSON.parse(taskJson); } catch { taskJson = {}; }
            }
            taskJson = taskJson || {};

            document.getElementById('task-title').value = taskJson.title || '';
            document.getElementById('task-instruction').value = taskJson.instruction || '';
            labState.requirements = Array.isArray(taskJson.requirements) ? taskJson.requirements : [];

            let testCases = lab.test_cases;
            if (typeof testCases === 'string') {
                try { testCases = JSON.parse(testCases); } catch { testCases = []; }
            }
            labState.testCases = Array.isArray(testCases) ? testCases : [];

            isLabLoaded = true;
            setLabLoadingState(false);

            activeTCIndex = 0;
            renderRequirements();
            renderTestCaseNav();
            renderActiveTestCaseEditor();

            const serverSnapshot = getLabFormSnapshot();
            adminLabGuard?.setBaseline(adminLabDraftKey, serverSnapshot);

            if (adminLabGuard?.hasDiffFromBaseline(adminLabDraftKey, serverSnapshot)) {
                const savedDraft = adminLabGuard.load(adminLabDraftKey);
                const savedTime = savedDraft?.savedAt
                    ? new Date(savedDraft.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                const restoreRes = await Swal.fire({
                    title: 'Найден несохранённый черновик',
                    text: `Обнаружены локальные изменения${savedTime ? ` от ${savedTime}` : ''}, которые не были сохранены в БД. Восстановить их?`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Восстановить черновик',
                    cancelButtonText: 'Загрузить из БД',
                    confirmButtonColor: '#10b981'
                });

                if (restoreRes.isConfirmed && savedDraft?.data) {
                    applyLabFormSnapshot(savedDraft.data);
                    trackLabChanges();
                    window.Toast?.info('Черновик восстановлен', 'Нажмите «Сохранить», чтобы записать изменения в БД');
                } else {
                    adminLabGuard.clear(adminLabDraftKey);
                }
            }
        } else {
            throw new Error(data.message || 'Не удалось загрузить лабораторную работу');
        }
    } catch (error) {
        console.error('Ошибка загрузки работы:', error);
        setLabLoadingState(false);
        window.Toast?.error('Ошибка загрузки', 'Не удалось получить параметры лабораторной работы');
    }
}

function syncActiveTestCaseFromDOM() {
    if (!labState.testCases[activeTCIndex]) return;

    const tc = labState.testCases[activeTCIndex];
    tc.name = document.getElementById('tc-name').value;
    tc.input = document.getElementById('tc-input').value;
    tc.expected_output = document.getElementById('tc-output').value;
    tc.timeout_ms = parseInt(document.getElementById('tc-timeout').value) || 1000;
}

function switchActiveTestCase(newIndex) {
    syncActiveTestCaseFromDOM();
    activeTCIndex = newIndex;
    renderTestCaseNav();
    renderActiveTestCaseEditor();
}

function renderTestCaseNav() {
    const container = document.getElementById('testcase-nav-list');
    const counter = document.getElementById('testcases-counter');
    if (!container) return;

    counter.innerText = labState.testCases.length;

    if (labState.testCases.length === 0) {
        container.innerHTML = `<span class="col-span-4 text-xs text-[var(--text-muted)] text-center py-1">Пусто</span>`;
        return;
    }

    container.innerHTML = labState.testCases.map((tc, idx) => {
        const isActive = idx === activeTCIndex;
        const btnClass = isActive
            ? 'bg-emerald-600 text-white font-bold border-emerald-500 shadow-md shadow-emerald-600/25'
            : 'bg-[var(--bg-elevated)] text-[var(--text-main)] border-[var(--border-color)] hover:border-emerald-500/50';

        return `
            <button type="button" data-index="${idx}" class="tc-nav-btn py-1.5 px-1 text-xs rounded-xl border transition text-center font-mono ${btnClass}">
                ${idx + 1}
            </button>
        `;
    }).join('');
}

function renderActiveTestCaseEditor() {
    const editorCard = document.getElementById('tc-editor-card');
    const emptyState = document.getElementById('tc-empty-state');

    if (labState.testCases.length === 0) {
        editorCard.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    editorCard.classList.remove('hidden');
    emptyState.classList.add('hidden');

    const tc = labState.testCases[activeTCIndex];

    document.getElementById('active-tc-header').innerText = `Тест №${activeTCIndex + 1}`;
    document.getElementById('tc-name').value = tc.name || '';
    document.getElementById('tc-input').value = tc.input || '';
    document.getElementById('tc-output').value = tc.expected_output || '';
    document.getElementById('tc-timeout').value = tc.timeout_ms || 1000;
}

function addNewTestCase() {
    syncActiveTestCaseFromDOM();

    labState.testCases.push({
        id: labState.testCases.length + 1,
        name: `№${labState.testCases.length + 1} Тест`,
        input: '',
        timeout_ms: 1000,
        expected_output: ''
    });

    activeTCIndex = labState.testCases.length - 1;
    renderTestCaseNav();
    renderActiveTestCaseEditor();
    trackLabChanges();
}

async function deleteActiveTestCase() {
    if (labState.testCases.length === 0) return;

    const confirmRes = await Swal.fire({
        title: `Удалить тест №${activeTCIndex + 1}?`,
        text: 'Тест-кейс будет удален после сохранения лабораторной работы.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Удалить',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#ef4444'
    });

    if (!confirmRes.isConfirmed) return;

    labState.testCases.splice(activeTCIndex, 1);

    labState.testCases.forEach((tc, idx) => tc.id = idx + 1);

    if (activeTCIndex >= labState.testCases.length) {
        activeTCIndex = Math.max(0, labState.testCases.length - 1);
    }

    renderTestCaseNav();
    renderActiveTestCaseEditor();
    trackLabChanges();
    window.Toast?.info('Тест-кейс удален', 'Не забудьте сохранить лабораторную работу');
}

function renderRequirements() {
    const container = document.getElementById('requirements-list');
    if (!container) return;

    container.innerHTML = labState.requirements.map((req, idx) => {
        const safeReq = String(req || '')
            .replace(/&/g, '&')
            .replace(/"/g, '"');
        return `
            <div class="flex items-center gap-2">
                <input type="text" value="${safeReq}" class="req-input ui-input flex-1 px-2.5 py-1" data-index="${idx}">
                <button type="button" class="btn-remove-req text-[var(--text-muted)] hover:text-rose-500 text-xs px-1.5 transition" data-index="${idx}">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
    }).join('');
}

function addRequirement() {
    syncRequirementsFromDOM();
    labState.requirements.push('Новое требование');
    renderRequirements();
    trackLabChanges();
}

function syncRequirementsFromDOM() {
    document.querySelectorAll('.req-input').forEach((input, idx) => {
        if (labState.requirements[idx] !== undefined) {
            labState.requirements[idx] = input.value;
        }
    });
}

async function saveLab() {
    if (!isLabLoaded) return false;

    syncActiveTestCaseFromDOM();
    syncRequirementsFromDOM();

    adminTemplatesState[activeAdminLang] = document.getElementById('lab-template-code').value;

    const saveBtn = document.getElementById('btn-save-lab');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.classList.add('opacity-60', 'cursor-not-allowed');
    }

    const token = localStorage.getItem('authToken');

    const payload = {
        title: document.getElementById('lab-title').value,
        description: document.getElementById('lab-description').value,
        difficulty: document.getElementById('lab-difficulty').value,
        order: parseInt(document.getElementById('lab-order').value) || 0,
        isUnlocked: document.getElementById('lab-is-unlocked').checked,

        templateCode: JSON.stringify(adminTemplatesState),

        taskJson: {
            title: document.getElementById('task-title').value,
            instruction: document.getElementById('task-instruction').value,
            requirements: labState.requirements
        },
        testCases: labState.testCases
    };

    try {
        const res = await fetch(`/api/v1/admin/labs/${labId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            adminLabGuard?.markClean(adminLabDraftKey, getLabFormSnapshot());
            Toast.success('Лабораторная работа успешно обновлена');
            return true;
        } else {
            Toast.error(data.message || 'Не удалось сохранить лабораторную работу');
            return false;
        }
    } catch (error) {
        console.error(error);
        Toast.error('Ошибка сети при сохранении');
        return false;
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.classList.remove('opacity-60', 'cursor-not-allowed');
        }
    }
}