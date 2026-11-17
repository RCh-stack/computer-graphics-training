document.getElementById('btn-save-draft')?.addEventListener('click', saveDraft);
document.getElementById('btn-run')?.addEventListener('click', runCode);
document.getElementById('btn-submit')?.addEventListener('click', submitCode);

async function saveDraft() {
    const urlParams = new URLSearchParams(window.location.search);
    const labId = urlParams.get('id');
    const code = window.windowEditor ? window.windowEditor.getValue() : '';
    const selectedLang = document.getElementById('language-select')?.value || 'cpp';

    if (!code.trim()) {
        Toast.warning('Код не может быть пустым');
        return;
    }

    const btnSave = document.getElementById('btn-save-draft');
    if (btnSave) btnSave.disabled = true;

    try {
        const token = localStorage.getItem('authToken');

        const res = await fetch('/api/v1/labs/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ lab_id: labId, student_code: code, language: selectedLang })
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
            Toast.success('Черновик сохранён');

            const statusContainer = document.getElementById('teacher-feedback-banner');
            if (statusContainer && statusContainer.classList.contains('hidden') && typeof setupSubmissionState === 'function') {
                setupSubmissionState({ status: 'DRAFT' });
            }
        } else {
            Toast.error(data.message || 'Не удалось сохранить черновик');
        }
    } catch (error) {
        console.error('Ошибка сохранения черновика:', error);
        Toast.error('Ошибка соединения при сохранении черновика');
    } finally {
        if (btnSave) btnSave.disabled = false;
    }
}

async function runCode() {
    if (!window.windowEditor) {
        Toast.error('Редактор кода не инициализирован');
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const labId = urlParams.get('id');

    if (!labId) {
        Toast.error('Не удалось определить ID лабораторной работы');
        return;
    }

    const code = window.windowEditor.getValue();
    const btnRun = document.getElementById('btn-run');
    const wasmBadge = document.getElementById('wasm-status');

    const selectedLang = document.getElementById('language-select')?.value || 'cpp';
    const langConfig = SUPPORTED_LANGUAGES[selectedLang] || { compiler: 'g++-15' };

    setRunBtnLoading(true, btnRun, wasmBadge);

    if (window.Skeleton) {
        Skeleton.render('#tests-container', Skeleton.labTestCases(3));
    }

    try {
        const token = localStorage.getItem('authToken');

        const response = await fetch('/api/v1/labs/run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({
                lab_id: labId,
                language: selectedLang,
                compiler: langConfig.compiler,
                student_code: code
            })
        });

        const result = await response.json();

        if (response.ok) {
            await showLabResultModal({
                isSubmit: false,
                isPassed: result.all_passed,
                tests: result.tests,
                compileError: result.compile_output
            });

            handleExecutionResult(result);
        } else {
            Swal.fire({
                title: response.status === 429 ? 'Доступ временно ограничен' : 'Ошибка',
                text: result.message,
                icon: response.status === 429 ? 'warning' : 'error',
                confirmButtonColor: '#ec4899'
            });
        }
    } catch (error) {
        console.error('Ошибка при отправке кода:', error);
        showErrorInUI('Не удалось связаться с сервером проверки.');
        Toast.error('Ошибка соединения', 'Сервер проверки недоступен');
    } finally {
        setRunBtnLoading(false, btnRun, wasmBadge);
    }
}

async function submitCode() {
    if (!window.windowEditor) {
        Toast.error('Редактор кода не инициализирован');
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const labId = urlParams.get('id');

    if (!labId) {
        Toast.error('Не удалось определить ID лабораторной работы');
        return;
    }

    const code = window.windowEditor.getValue();
    const btnSubmit = document.getElementById('btn-submit');
    const wasmBadge = document.getElementById('wasm-status');

    const selectedLang = document.getElementById('language-select')?.value || 'cpp';
    const langConfig = SUPPORTED_LANGUAGES[selectedLang] || { compiler: 'g++-15' };

    setSubmitBtnLoading(true, btnSubmit, wasmBadge);

    try {
        const token = localStorage.getItem('authToken');

        const response = await fetch('/api/v1/labs/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({
                lab_id: labId,
                language: selectedLang,
                compiler: langConfig.compiler,
                student_code: code
            })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.message || `Ошибка сервера: ${response.status}`);
        }

        if (result.status === 'compile_error') {
            Swal.fire({
                title: 'Ошибка компиляции',
                html: `<pre class="text-left text-xs bg-slate-950 p-3 rounded-xl border border-rose-500/25 font-mono text-rose-400 overflow-x-auto max-h-60">${escapeHtml(result.compile_output || 'Не удалось скомпилировать код.')}</pre><p class="text-xs opacity-75 mt-2">Код сохранен как черновик.</p>`,
                icon: 'error',
                confirmButtonColor: '#ec4899'
            });
            return;
        }

        const submission = result.submission;

        await showLabResultModal({
            isSubmit: true,
            isPassed: submission.all_passed,
            tests: submission.tests,
            compileError: submission.compile_output
        });

        if (submission.all_passed) {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Ошибка при отправке кода:', error);
        showErrorInUI('Не удалось связаться с сервером проверки.');
        Toast.error('Ошибка отправки', error.message || 'Не удалось отправить решение');
    } finally {
        setSubmitBtnLoading(false, btnSubmit, wasmBadge);
    }
}

function setRunBtnLoading(isLoading, btnRun) {
    if (isLoading) {
        btnRun.disabled = true;
        btnRun.classList.add('opacity-50', 'cursor-not-allowed');
        btnRun.innerHTML = `<span>⏳ Build...</span>`;
    } else {
        btnRun.disabled = false;
        btnRun.classList.remove('opacity-50', 'cursor-not-allowed');
        btnRun.innerHTML = `<span>▶ Run</span>`;
    }
}

function setSubmitBtnLoading(isLoading, btnSubmit) {
    if (isLoading) {
        btnSubmit.disabled = true;
        btnSubmit.classList.add('opacity-50', 'cursor-not-allowed');
        btnSubmit.innerHTML = `<span>⏳ Submit...</span>`;
    } else {
        btnSubmit.disabled = false;
        btnSubmit.classList.remove('opacity-50', 'cursor-not-allowed');
        btnSubmit.innerHTML = `<span>Отправить решение</span>`;
    }
}

function handleExecutionResult(result) {
    const testsContainer = document.getElementById('tests-container');
    const testsCountBadge = document.getElementById('tests-status-count');

    if (!testsContainer) return;

    if (result.status === 'compile_error') {
        testsContainer.innerHTML = `
            <div class="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs space-y-2">
                <div class="font-bold text-rose-500 flex items-center space-x-1">
                    <span>❌ Ошибка компиляции</span>
                </div>
                <pre class="font-mono text-[10px] text-rose-300 whitespace-pre-wrap overflow-x-auto bg-slate-950 border border-rose-500/20 p-2.5 rounded-lg">${escapeHtml(result.compile_output)}</pre>
            </div>
        `;
        if (testsCountBadge) testsCountBadge.textContent = '0 Passed';
        return;
    }

    if (result.status === 'success' && Array.isArray(result.tests)) {
        const passedCount = result.tests.filter(t => t.passed).length;

        if (testsCountBadge) {
            testsCountBadge.textContent = `${passedCount} / ${result.tests.length} Passed`;
        }

        testsContainer.innerHTML = result.tests.map(test => {
            const isPassed = test.passed;
            const statusBg = isPassed ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-rose-500/10 border-rose-500/25';
            const icon = isPassed ? '✓' : '✗';
            const iconColor = isPassed ? 'text-emerald-500' : 'text-rose-500';

            return `
                <div class="border ${statusBg} rounded-xl p-2.5 flex flex-col space-y-1 text-xs">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-2">
                            <span class="${iconColor} font-bold">${icon}</span>
                            <span class="font-medium text-[var(--text-main)]">${test.name}</span>
                        </div>
                        <span class="font-mono text-[10px] text-[var(--text-muted)]">${test.time_ms} ms</span>
                    </div>
                    ${!isPassed && test.message ? `<div class="text-[11px] font-mono text-rose-500 pl-4">${escapeHtml(test.message)}</div>` : ''}
                </div>
            `;
        }).join('');
    }
}

function showErrorInUI(message) {
    const testsContainer = document.getElementById('tests-container');
    if (!testsContainer) return;

    testsContainer.innerHTML = `
        <div class="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs space-y-2">
            <div class="font-bold text-rose-500 flex items-center space-x-1">
                <span>⚠️ Ошибка подключения</span>
            </div>
            <p class="font-medium text-[11px] text-rose-500 leading-relaxed">${escapeHtml(message)}</p>
        </div>
    `;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"');
}