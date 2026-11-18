window.windowEditor = null;

let currentLabId = null;
let currentLabTemplates = {};
let serverCodePerLang = {};
let userCodePerLang = {};
let activeLanguage = 'cpp';
let isSyncingEditorValue = false;

function resolveLabDraftKey(labId, lang) {
    if (typeof window.getStudentLabDraftKey === 'function') {
        return window.getStudentLabDraftKey(labId, lang);
    }
    return `student_lab_${labId}_${lang || 'cpp'}`;
}

function renderLabWorkspaceSkeletons() {
    const headerTitle = document.getElementById('header-title');
    if (headerTitle) {
        headerTitle.innerHTML = `<span aria-hidden="true" class="inline-block h-5 w-48 rounded bg-gray-500/20 animate-pulse align-middle"></span>`;
    }

    const instrTitle = document.getElementById('lab-instruction-title');
    if (instrTitle) {
        instrTitle.innerHTML = `<span aria-hidden="true" class="inline-block h-5 w-2/3 rounded bg-gray-500/20 animate-pulse"></span>`;
    }

    const instrText = document.getElementById('lab-instruction-text');
    if (instrText) {
        instrText.innerHTML = `
            <div aria-hidden="true" class="space-y-2 animate-pulse pt-1">
                <div class="h-3 w-full rounded bg-gray-500/15"></div>
                <div class="h-3 w-5/6 rounded bg-gray-500/15"></div>
                <div class="h-3 w-3/4 rounded bg-gray-500/10"></div>
            </div>
        `;
    }

    const reqList = document.getElementById('lab-requirements-list');
    if (reqList) {
        reqList.innerHTML = `
            <li aria-hidden="true" class="h-3 w-4/5 rounded bg-gray-500/15 animate-pulse list-none"></li>
            <li aria-hidden="true" class="h-3 w-3/5 rounded bg-gray-500/15 animate-pulse list-none"></li>
            <li aria-hidden="true" class="h-3 w-2/3 rounded bg-gray-500/10 animate-pulse list-none"></li>
        `;
    }

    if (window.Skeleton) {
        Skeleton.render('#tests-container', Skeleton.labTestCases(4));
    }

    const editorContainer = document.getElementById('monaco-editor-container');
    if (editorContainer && !window.windowEditor) {
        editorContainer.innerHTML = `
            <div id="monaco-skeleton-placeholder" aria-hidden="true" class="p-4 space-y-2.5 animate-pulse">
                <div class="h-3.5 w-48 rounded bg-gray-500/20"></div>
                <div class="h-3.5 w-64 rounded bg-gray-500/15"></div>
                <div class="h-3.5 w-40 rounded bg-gray-500/15"></div>
                <div class="h-3.5 w-56 rounded bg-gray-500/10"></div>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentLabId = urlParams.get('id');

    if (!currentLabId) {
        await Swal.fire('Ошибка', 'Идентификатор лабораторной работы не указан!', 'error');
        window.location.href = 'index.html';
        return;
    }

    renderLabWorkspaceSkeletons();

    try {
        const token = localStorage.getItem('authToken');

        const response = await fetch(`/api/v1/labs/${currentLabId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        if (!response.ok) throw new Error('Не удалось загрузить лабораторную работу');

        const result = await response.json();
        const currentLab = result.lab;

        renderWorkspaceUI(currentLab);

        currentLabTemplates = parseTemplates(currentLab.template_code);

        const userSubmission = currentLab.userSubmission;
        activeLanguage = (userSubmission && userSubmission.language) ? userSubmission.language : 'cpp';

        Object.keys(SUPPORTED_LANGUAGES).forEach(lang => {
            const baseCode = currentLabTemplates[lang] || '';
            serverCodePerLang[lang] = baseCode;
            userCodePerLang[lang] = baseCode;
        });

        if (userSubmission && userSubmission.submittedCode) {
            serverCodePerLang[activeLanguage] = userSubmission.submittedCode;
            userCodePerLang[activeLanguage] = userSubmission.submittedCode;
        }

        Object.keys(SUPPORTED_LANGUAGES).forEach(lang => {
            const key = resolveLabDraftKey(currentLabId, lang);
            window.labDraftGuard?.setBaseline(key, serverCodePerLang[lang]);
        });

        let initialCode = userCodePerLang[activeLanguage] || currentLabTemplates[activeLanguage] || '// Код не предоставлен';
        let restoredFromDraft = false;

        const activeDraftKey = resolveLabDraftKey(currentLabId, activeLanguage);
        const savedDraft = window.labDraftGuard?.load(activeDraftKey);
        if (savedDraft && typeof savedDraft.data === 'string' && savedDraft.data !== serverCodePerLang[activeLanguage]) {
            initialCode = savedDraft.data;
            userCodePerLang[activeLanguage] = savedDraft.data;
            restoredFromDraft = true;
        }

        initMonacoEditor(initialCode, restoredFromDraft);
        setupSubmissionState(userSubmission, { skipEditorUpdate: true });
    } catch (error) {
        console.error('Ошибка загрузки данных лабораторной работы:', error);
        const instrText = document.getElementById('lab-instruction-text');
        if (instrText) {
            instrText.innerHTML = `<span class="text-rose-500">Не удалось загрузить условие лабораторной работы.</span>`;
        }
        const testsContainer = document.getElementById('tests-container');
        if (testsContainer) testsContainer.innerHTML = '';
        window.Toast?.error('Ошибка загрузки', 'Не удалось открыть лабораторную работу');
    }
});

function parseTemplates(rawTemplate) {
    if (!rawTemplate) return {};
    if (typeof rawTemplate === 'object') return rawTemplate;

    try {
        const parsed = JSON.parse(rawTemplate);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
    } catch (e) {
    }
    return { cpp: rawTemplate };
}

function renderWorkspaceUI(lab) {
    document.getElementById('header-title').textContent = lab.title;
    document.getElementById('lab-badge-category').textContent = "Math";
    document.getElementById('lab-instruction-title').textContent = lab.task_json?.title || 'Задание';
    document.getElementById('lab-instruction-text').textContent = lab.task_json?.instruction || '';

    const reqList = document.getElementById('lab-requirements-list');
    if (reqList) {
        if (lab.task_json?.requirements?.length) {
            reqList.innerHTML = lab.task_json.requirements.map(req => `<li>${req}</li>`).join('');
        } else {
            reqList.innerHTML = '';
        }
    }

    const testsStatusCount = document.getElementById('tests-status-count');
    if (testsStatusCount) {
        testsStatusCount.innerHTML = `<span class="text-[10px] font-mono text-[var(--text-main)]">0 / ${lab.test_cases ? lab.test_cases.length : 0} Passed</span>`;
    }

    const testsContainer = document.getElementById('tests-container');
    if (testsContainer && lab.test_cases) {
        testsContainer.innerHTML = lab.test_cases.map(test => `
            <div class="ui-subcard p-2.5 flex items-center justify-between text-xs">
                <div class="flex items-center space-x-2">
                    <span class="text-[var(--text-muted)] font-bold">•</span>
                    <span class="font-medium text-[var(--text-main)]">${test.name}</span>
                </div>
                <span class="font-mono text-[10px] text-[var(--text-muted)]">${test.timeout_ms}ms</span>
            </div>
        `).join('');
    }
}

function initMonacoEditor(codeTemplate, restoredFromDraft = false) {
    if (typeof require === 'undefined') {
        console.error('Monaco RequireJS Loader не подключен.');
        return;
    }

    require.config({
        paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }
    });

    require(['vs/editor/editor.main'], function () {
        const container = document.getElementById('monaco-editor-container');
        if (!container) return;

        document.getElementById('monaco-skeleton-placeholder')?.remove();

        if (window.windowEditor) {
            window.windowEditor.dispose();
        }

        const isDark = document.body.classList.contains('dark-theme');
        const langConfig = SUPPORTED_LANGUAGES[activeLanguage] || SUPPORTED_LANGUAGES['cpp'];

        window.windowEditor = monaco.editor.create(container, {
            value: codeTemplate,
            language: langConfig.monacoLang,
            theme: isDark ? 'vs-dark' : 'vs-light',
            readOnly: false,
            domReadOnly: false,
            automaticLayout: true,
            fontSize: 13,
            fontFamily: 'Consolas, "Fira Code", Monaco, monospace',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 12, bottom: 12 }
        });

        window.windowEditor.onDidChangeModelContent(() => {
            if (isSyncingEditorValue || !currentLabId) return;
            const currentCode = window.windowEditor.getValue();
            userCodePerLang[activeLanguage] = currentCode;
            window.labDraftGuard?.watch(resolveLabDraftKey(currentLabId, activeLanguage), currentCode);
        });

        if (restoredFromDraft && currentLabId) {
            window.labDraftGuard?.watch(resolveLabDraftKey(currentLabId, activeLanguage), codeTemplate);
            window.Toast?.info(
                'Восстановлен несохранённый черновик',
                'Нажмите «Сохранить черновик», чтобы зафиксировать изменения в базе'
            );
        }

        const selectEl = document.getElementById('language-select');
        if (selectEl) selectEl.value = activeLanguage;

        const compilerBadge = document.getElementById('compiler-badge');
        if (compilerBadge) compilerBadge.innerText = `Compiler: ${langConfig.compiler}`;

        container.addEventListener('click', () => {
            if (window.windowEditor) window.windowEditor.focus();
        });
    });
}

function changeEditorLanguage(langKey) {
    if (window.windowEditor) {
        userCodePerLang[activeLanguage] = window.windowEditor.getValue();
    }

    activeLanguage = langKey;
    const langConfig = SUPPORTED_LANGUAGES[langKey] || SUPPORTED_LANGUAGES['cpp'];

    if (currentLabId && userCodePerLang[langKey] === serverCodePerLang[langKey]) {
        const nextDraft = window.labDraftGuard?.load(resolveLabDraftKey(currentLabId, langKey));
        if (nextDraft && typeof nextDraft.data === 'string' && nextDraft.data !== serverCodePerLang[langKey]) {
            userCodePerLang[langKey] = nextDraft.data;
            window.labDraftGuard?.watch(resolveLabDraftKey(currentLabId, langKey), nextDraft.data);
        }
    }

    if (window.windowEditor && window.monaco) {
        const model = window.windowEditor.getModel();

        window.monaco.editor.setModelLanguage(model, langConfig.monacoLang);

        const codeToSet = userCodePerLang[langKey] || currentLabTemplates[langKey] || `// Шаблон для ${langConfig.name} не задан`;

        isSyncingEditorValue = true;
        try {
            window.windowEditor.setValue(codeToSet);
        } finally {
            isSyncingEditorValue = false;
        }

        const selectEl = document.getElementById('language-select');
        if (selectEl) selectEl.value = activeLanguage;
    }

    const compilerBadge = document.getElementById('compiler-badge');
    if (compilerBadge) compilerBadge.innerText = `Compiler: ${langConfig.compiler}`;
}

document.getElementById('language-select')?.addEventListener('change', (e) => {
    const selectedLang = e.target.value;

    Swal.fire({
        title: 'Смена языка',
        text: 'Переключить редактор на выбранный язык программирования?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Да, переключить',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#ec4899'
    }).then((result) => {
        if (result.isConfirmed) {
            changeEditorLanguage(selectedLang);
            window.Toast?.info(`Язык редактора: ${SUPPORTED_LANGUAGES[selectedLang]?.name || selectedLang}`);
        } else {
            e.target.value = activeLanguage;
        }
    });
});

function setupSubmissionState(userSubmission, { skipEditorUpdate = false } = {}) {
    if (!userSubmission) return;

    if (!skipEditorUpdate && userSubmission.submittedCode && window.windowEditor) {
        isSyncingEditorValue = true;
        try {
            window.windowEditor.setValue(userSubmission.submittedCode);
        } finally {
            isSyncingEditorValue = false;
        }
    }

    const statusContainer = document.getElementById('teacher-feedback-banner');
    if (!statusContainer) return;

    const { status, teacherComment } = userSubmission;
    statusContainer.classList.remove('hidden');

    let statusBadge = '';
    let bannerStyle = '';

    if (status === 'PASSED') {
        bannerStyle = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500';
        statusBadge = `<span class="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-500">✅ Принято</span>`;
    } else if (status === 'REVISION') {
        bannerStyle = 'bg-amber-500/10 border-amber-500/30 text-amber-500';
        statusBadge = `<span class="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-500/15 text-amber-500">⚠️ На доработку</span>`;
    } else if (status === 'REJECTED') {
        bannerStyle = 'bg-rose-500/10 border-rose-500/30 text-rose-500';
        statusBadge = `<span class="px-2 py-0.5 rounded-md text-xs font-bold bg-rose-500/15 text-rose-500">❌ Отклонено</span>`;
    } else if (status === 'SUBMITTED') {
        bannerStyle = 'bg-blue-500/10 border-blue-500/30 text-blue-500';
        statusBadge = `<span class="px-2 py-0.5 rounded-md text-xs font-bold bg-blue-500/15 text-blue-500">🔎 На проверке</span>`;
    } else {
        bannerStyle = 'bg-[var(--bg-elevated)] border-[var(--border-color)] text-[var(--text-muted)]';
        statusBadge = `<span class="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-500/15 text-[var(--text-muted)]">📝 Черновик</span>`;
    }

    statusContainer.className = `p-3 rounded-xl border text-xs space-y-2 ${bannerStyle}`;
    statusContainer.innerHTML = `
        <div class="flex justify-between items-center">
            <span class="font-bold flex items-center gap-1.5">
                <i class="fa-solid fa-comment-dots"></i> Статус проверки:
            </span>
            ${statusBadge}
        </div>
        ${teacherComment ? `
            <div class="pt-2 border-t border-current/20">
                <span class="font-semibold text-[var(--text-main)]">Комментарий преподавателя:</span>
                <p class="mt-0.5 text-[var(--text-main)] leading-relaxed">${escapeHtml(teacherComment)}</p>
            </div>
        ` : ''}
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}