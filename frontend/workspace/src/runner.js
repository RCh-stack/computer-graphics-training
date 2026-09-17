document.getElementById('btn-run')?.addEventListener('click', runCode);
document.getElementById('btn-submit')?.addEventListener('click', submitCode)

async function runCode() {
    if (!window.windowEditor) {
        alert('Редактор кода не инициализирован!');
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const labId = urlParams.get('id');

    if (!labId) {
        alert('Не удалось определить ID лабораторной работы!');
        return;
    }

    const code = window.windowEditor.getValue();   
    const btnRun = document.getElementById('btn-run');
    const wasmBadge = document.getElementById('wasm-status');

    setUIStateLoading(true, btnRun, wasmBadge);

    try {
        const response = await fetch('http://127.0.0.1:3000/api/v1/labs/run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                lab_id: labId,
                compiler: "g++-15",
                student_code: code
            })
        });

        if (!response.ok) {
            throw new Error(`Ошибка сервера: ${response.status}`);
        }

        const result = await response.json();
        handleExecutionResult(result);
    } catch (error) {
        console.error('Ошибка при отправке кода:', error);
        showErrorInUI('Не удалось связаться с сервером проверки.');
    } finally {
        setUIStateLoading(false, btnRun, wasmBadge);
    }
}

async function submitCode() {
    
}

function setUIStateLoading(isLoading, btnRun, wasmBadge) {
    if (isLoading) {
        btnRun.disabled = true;
        btnRun.classList.add('opacity-50', 'cursor-not-allowed');
        btnRun.innerHTML = `<span>⏳ Build...</span>`;
        if (wasmBadge) {
            wasmBadge.textContent = 'Компиляция C++...';
            wasmBadge.className = 'px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse';
        }
    } else {
        btnRun.disabled = false;
        btnRun.classList.remove('opacity-50', 'cursor-not-allowed');
        btnRun.innerHTML = `<span>▶ Run</span>`;
        if (wasmBadge) {
            wasmBadge.textContent = 'Ready';
            wasmBadge.className = 'px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
        }
    }
}

function handleExecutionResult(result) {
    const testsContainer = document.getElementById('tests-container');
    const testsCountBadge = document.getElementById('tests-status-count');
    
    if (!testsContainer) return;

    if (result.status === 'compile_error') {
        testsContainer.innerHTML = `
            <div class="bg-rose-950/30 border border-rose-500/30 rounded-xl p-3 text-xs space-y-2">
                <div class="font-bold text-rose-200 flex items-center space-x-1">
                    <span>❌ Ошибка компиляции</span>
                </div>
                <pre class="font-mono text-[10px] text-black whitespace-pre-wrap overflow-x-auto bg-black/40 p-2 rounded">${escapeHtml(result.compile_output)}</pre>
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
            const statusBg = isPassed ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20';
            const icon = isPassed ? '✓' : '✗';
            const iconColor = isPassed ? 'text-emerald-400' : 'text-rose-400';

            return `
                <div class="bg-[var(--bg-panel)] border ${statusBg} rounded-xl p-2.5 flex flex-col space-y-1 text-xs">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-2">
                            <span class="${iconColor} font-bold">${icon}</span>
                            <span class="font-medium">${test.name}</span>
                        </div>
                        <span class="font-mono text-[10px] text-[var(--text-muted)]">${test.time_ms} ms</span>
                    </div>
                    ${!isPassed && test.message ? `<div class="text-[11px] font-mono text-rose-400 pl-4">${escapeHtml(test.message)}</div>` : ''}
                </div>
            `;
        }).join('');
    }
}

function showErrorInUI(message) {
    const testsContainer = document.getElementById('tests-container');
    if (!testsContainer) return;

    testsContainer.innerHTML = `
        <div class="bg-rose-950/30 border border-rose-500/30 rounded-xl p-3 text-xs space-y-2">
            <div class="font-bold text-rose-500 flex items-center space-x-1">
                <span>⚠️ Ошибка подключения</span>
            </div>
            <p class="font-bold text-[11px] text-rose-500 leading-relaxed">${escapeHtml(message)}</p>
        </div>
    `;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}