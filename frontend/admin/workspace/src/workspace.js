document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    loadLabDetails();
});

const labId = new URLSearchParams(window.location.search).get('id');

let labState = {
    requirements: [],
    testCases: []
};
let activeTCIndex = 0;

function initEvents() {
    document.getElementById('btn-save-lab')?.addEventListener('click', saveLab);
    document.getElementById('btn-add-req')?.addEventListener('click', addRequirement);
    document.getElementById('btn-add-testcase')?.addEventListener('click', addNewTestCase);
    document.getElementById('btn-delete-active-tc')?.addEventListener('click', deleteActiveTestCase);

    document.getElementById('testcase-nav-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.tc-nav-btn');
        if (btn) {
            const idx = parseInt(btn.dataset.index);
            if (!isNaN(idx) && idx !== activeTCIndex) {
                switchActiveTestCase(idx);
            }
        }
    });

    document.getElementById('requirements-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-remove-req');
        if (btn) {
            syncRequirementsFromDOM();
            const idx = parseInt(btn.dataset.index);
            labState.requirements.splice(idx, 1);
            renderRequirements();
        }
    });
}

async function loadLabDetails() {
    if (!labId) {
        window.location.href = 'labs.html';
        return;
    }

    const token = localStorage.getItem('authToken');

    try {
        const res = await fetch(`/api/v1/admin/labs/${labId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.status === 'success') {
            const lab = data.lab;

            document.getElementById('lab-title').value = lab.title || '';
            document.getElementById('lab-difficulty').value = lab.difficulty || 'Средний';
            document.getElementById('lab-order').value = lab.order || 0;
            document.getElementById('lab-is-unlocked').checked = lab.is_unlocked;
            document.getElementById('lab-description').value = lab.description || '';
            document.getElementById('lab-template-code').value = lab.template_code || '';

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

            activeTCIndex = 0;
            renderRequirements();
            renderTestCaseNav();
            renderActiveTestCaseEditor();
        }
    } catch (err) {
        console.error('Ошибка загрузки работы:', err);
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
        container.innerHTML = `<span class="col-span-4 text-xs text-[var(--text-main)] text-center py-1">Пусто</span>`;
        return;
    }

    container.innerHTML = labState.testCases.map((tc, idx) => {
        const isActive = idx === activeTCIndex;
        const btnClass = isActive 
            ? 'bg-emerald-600 text-white font-bold border-emerald-500 shadow-md shadow-emerald-600/30' 
            : 'bg-[var(--bg-panel)] text-[var(--text-main)] border-gray-700 hover:border-emerald-500/50';

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
}

function deleteActiveTestCase() {
    if (labState.testCases.length === 0) return;

    labState.testCases.splice(activeTCIndex, 1);
    
    labState.testCases.forEach((tc, idx) => tc.id = idx + 1);

    if (activeTCIndex >= labState.testCases.length) {
        activeTCIndex = Math.max(0, labState.testCases.length - 1);
    }

    renderTestCaseNav();
    renderActiveTestCaseEditor();
}

function renderRequirements() {
    const container = document.getElementById('requirements-list');
    if (!container) return;

    container.innerHTML = labState.requirements.map((req, idx) => `
        <div class="flex items-center gap-2">
            <input type="text" value="${req}" class="req-input flex-1 px-2.5 py-1 bg-[var(--bg-panel)] border border-gray-700 rounded-lg text-xs focus:outline-none focus:border-emerald-500" data-index="${idx}">
            <button type="button" class="btn-remove-req text-[var(--text-main)] hover:text-red-400 text-xs px-1.5" data-index="${idx}">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('');
}

function addRequirement() {
    syncRequirementsFromDOM();
    labState.requirements.push('Новое требование');
    renderRequirements();
}

function syncRequirementsFromDOM() {
    document.querySelectorAll('.req-input').forEach((input, idx) => {
        if (labState.requirements[idx] !== undefined) {
            labState.requirements[idx] = input.value;
        }
    });
}

async function saveLab() {
    syncActiveTestCaseFromDOM();
    syncRequirementsFromDOM();

    const token = localStorage.getItem('authToken');

    const payload = {
        title: document.getElementById('lab-title').value,
        description: document.getElementById('lab-description').value,
        difficulty: document.getElementById('lab-difficulty').value,
        order: parseInt(document.getElementById('lab-order').value) || 0,
        isUnlocked: document.getElementById('lab-is-unlocked').checked,
        templateCode: document.getElementById('lab-template-code').value,
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

        if (res.ok) {
            Swal.fire({ 
                title: 'Сохранено!', 
                text: 'Лабораторная работа успешно обновлена', 
                icon: 'success', 
                confirmButtonColor: '#10b981' 
            });
        } else {
            Swal.fire('Ошибка', 'Не удалось сохранить лабораторную работу', 'error');
        }
    } catch (error) {
        console.error(error);
        Swal.fire('Ошибка', 'Ошибка сети при сохранении', 'error');
    }
}