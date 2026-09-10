// Глобальная ссылка на редактор Monaco для доступа из других модулей/кнопок
window.windowEditor = null;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const labId = urlParams.get('id');

    if (!labId) {
        alert('Идентификатор лабораторной работы не указан!');
        window.location.href = 'labs.html';
        return;
    }

    try {
        const response = await fetch('content/manifest.json');
        const labs = await response.json();
        const currentLab = labs.find(item => item.id === labId);

        if (!currentLab) {
            alert('Запрошенная лабораторная работа не найдена!');
            window.location.href = 'labs.html';
            return;
        }

        renderWorkspaceUI(currentLab);

        initMonacoEditor(currentLab.template_code || '// Код не предоставлен');

    } catch (error) {
        console.error('Ошибка загрузки данных лабораторной работы:', error);
    }
});

function renderWorkspaceUI(lab) {
    document.getElementById('header-title').textContent = lab.title;
    document.getElementById('lab-badge-category').textContent = lab.category;
    document.getElementById('lab-instruction-title').textContent = lab.task.title;
    document.getElementById('lab-instruction-text').textContent = lab.task.instruction;

    const reqList = document.getElementById('lab-requirements-list');
    if (reqList && lab.task.requirements) {
        reqList.innerHTML = lab.task.requirements.map(req => `<li>${req}</li>`).join('');
    }

    const testsContainer = document.getElementById('tests-container');
    if (testsContainer && lab.tests) {
        testsContainer.innerHTML = lab.tests.map(test => `
            <div class="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl p-2.5 flex items-center justify-between text-xs">
                <div class="flex items-center space-x-2">
                    <span class="text-gray-400 font-bold">•</span>
                    <span class="font-medium">${test.name}</span>
                </div>
                <span class="font-mono text-[10px] text-[var(--text-muted)]">${test.expected_time}</span>
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

        // Если редактор уже был инициализирован, убираем старый экземпляр
        if (window.windowEditor) {
            window.windowEditor.dispose();
        }

        // Создаем редактор с кодом из JSON
        window.windowEditor = monaco.editor.create(container, {
            value: codeTemplate,
            language: 'cpp',
            theme: 'vs-dark',
            readOnly: false,
            domReadOnly: false,
            automaticLayout: true,
            fontSize: 13,
            fontFamily: 'Consolas, "Fira Code", Monaco, monospace',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 12, bottom: 12 }
        });

        container.addEventListener('click', () => {
            window.windowEditor.focus();
        });
    });
}

document.getElementById('btn-run')?.addEventListener('click', () => {
    if (window.windowEditor) {
        const code = window.windowEditor.getValue();
        console.log('--- Считанный код студента ---');
        console.log(code);
    }
});