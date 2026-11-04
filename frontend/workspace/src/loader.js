window.windowEditor = null;

let currentLabTemplates = {};
let userCodePerLang = {};
let activeLanguage = 'cpp';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const labId = urlParams.get('id');

    if (!labId) {
        Swal.fire('Ошибка', 'Идентификатор лабораторной работы не указан!', 'error');
        window.location.href = 'index.html';
        return;
    }

    try {
        const token = localStorage.getItem('authToken');

        const response = await fetch(`/api/v1/labs/${labId}`, {
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
            userCodePerLang[lang] = currentLabTemplates[lang] || '';
        });

        if (userSubmission && userSubmission.submittedCode) {
            userCodePerLang[activeLanguage] = userSubmission.submittedCode;
        }

        const initialCode = userCodePerLang[activeLanguage] || currentLabTemplates[activeLanguage] || '// Код не предоставлен';

        initMonacoEditor(initialCode);
        setupSubmissionState(userSubmission);
    } catch (error) {
        console.error('Ошибка загрузки данных лабораторной работы:', error);
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
    if (reqList && lab.task_json?.requirements) {
        reqList.innerHTML = lab.task_json.requirements.map(req => `<li>${req}</li>`).join('');
    }

    const testsStatusCount = document.getElementById('tests-status-count');
    if (testsStatusCount) {
        testsStatusCount.innerHTML = `<span class="text-[10px] font-mono text-[var(--text-main)]">0 / ${lab.test_cases ? lab.test_cases.length : 0} Passed</span>`;
    }

    const testsContainer = document.getElementById('tests-container');
    if (testsContainer && lab.test_cases) {
        testsContainer.innerHTML = lab.test_cases.map(test => `
            <div class="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl p-2.5 flex items-center justify-between text-xs">
                <div class="flex items-center space-x-2">
                    <span class="text-[var(--text-main)] font-bold">•</span>
                    <span class="font-medium">${test.name}</span>
                </div>
                <span class="font-mono text-[10px] text-[var(--text-muted)]">${test.timeout_ms}ms</span>
            </div>
        `).join('');
    }
}

function initMonacoEditor(codeTemplate) {
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

    if (window.windowEditor && window.monaco) {
        const model = window.windowEditor.getModel();
        
        window.monaco.editor.setModelLanguage(model, langConfig.monacoLang);
        
        const codeToSet = userCodePerLang[langKey] || currentLabTemplates[langKey] || `// Шаблон для ${langConfig.name} не задан`;
        window.windowEditor.setValue(codeToSet);
        
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
        } else {
            e.target.value = activeLanguage;
        }
    });
});

function setupSubmissionState(userSubmission) {
    if (!userSubmission) return;

    if (userSubmission.submittedCode && window.windowEditor) {
        window.windowEditor.setValue(userSubmission.submittedCode);
    }

    const statusContainer = document.getElementById('teacher-feedback-banner');
    if (!statusContainer) return;

    const { status, teacherComment } = userSubmission;
    statusContainer.classList.remove('hidden');

    let statusBadge = '';
    let bannerStyle = '';

    if (status === 'PASSED') {
        bannerStyle = 'bg-emerald-500/10 border-emerald-400/30 text-emerald-400';
        statusBadge = `<span class="px-2 py-0.5 rounded text-xs font-bold bg-emerald-400/20 text-emerald-400">✅ Принято</span>`;
    } else if (status === 'REVISION') {
        bannerStyle = 'bg-amber-500/10 border-amber-400/30 text-amber-400';
        statusBadge = `<span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-400/20 text-amber-400">⚠️ На доработку</span>`;
    } else if (status === 'REJECTED') {
        bannerStyle = 'bg-red-500/10 border-red-400/30 text-red-400';
        statusBadge = `<span class="px-2 py-0.5 rounded text-xs font-bold bg-red-400/20 text-red-400">❌ Отклонено</span>`;
    } else if (status === 'SUBMITTED'){
        bannerStyle = 'bg-blue-500/10 border-blue-400/30 text-blue-400';
        statusBadge = `<span class="px-2 py-0.5 rounded text-xs font-bold bg-blue-400/20 text-blue-400">🔎 На проверке</span>`;
    } else {
        bannerStyle = 'bg-gray-500/10 border-gray-400/30 text-gray-400';
        statusBadge = `<span class="px-2 py-0.5 rounded text-xs font-bold bg-gray-400/20 text-gray-400">📝 Черновик</span>`;
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