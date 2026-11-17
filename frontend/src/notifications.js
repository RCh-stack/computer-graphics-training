function showTestResultModal({ score, correctCount, totalCount, passed }) {
    return Swal.fire({
        title: passed ? 'Тест успешно сдан!' : 'Тест не сдан',
        html: `
            <div class="space-y-2">
                <p class="text-base font-semibold">Результат: <span class="${passed ? 'text-emerald-500' : 'text-rose-500'}">${score}%</span></p>
                <p class="text-xs opacity-75">Правильных ответов: ${correctCount} из ${totalCount}</p>
            </div>
        `,
        icon: passed ? 'success' : 'error',
        confirmButtonText: 'Продолжить',
        confirmButtonColor: '#10b981',
        allowOutsideClick: false,
        allowEscapeKey: false
    });
}

function showLabResultModal({ isSubmit, isPassed, tests, compileError }) {
    if (compileError) {
        return Swal.fire({
            title: 'Ошибка компиляции',
            html: `<pre class="bg-slate-950 text-rose-400 border border-rose-500/25 p-3 rounded-xl text-xs text-left overflow-x-auto font-mono">${compileError}</pre>`,
            icon: 'error',
            confirmButtonText: 'Закрыть',
            confirmButtonColor: '#ef4444'
        });
    }

    const testListHtml = tests.map(t => `
        <div class="flex items-center justify-between px-3 py-2 mb-1 rounded-xl border text-xs font-medium ${
            t.passed
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
                : 'bg-rose-500/10 text-rose-600 border-rose-500/25'
        }">
            <span>${t.name}</span>
            <span class="font-mono font-bold">${t.passed ? '✓ Пройден' : '✕ Ошибка'} (${t.time_ms} ms)</span>
        </div>
    `).join('');

    return Swal.fire({
        title: isSubmit ? 'Лабораторная работа отправлена!' : (isPassed ? 'Тесты пройдены!' : 'Тесты не пройдены'),
        html: `
            <div class="text-left space-y-2">
                <p class="text-sm font-semibold mb-2">Детализация тестов:</p>
                <div class="max-h-48 overflow-y-auto space-y-1.5">${testListHtml}</div>
            </div>
        `,
        icon: isPassed ? 'success' : 'warning',
        confirmButtonText: 'Продолжить',
        confirmButtonColor: '#10b981',
        allowOutsideClick: false,
        allowEscapeKey: false
    });
}