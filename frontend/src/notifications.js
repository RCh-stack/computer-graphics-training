function showTestResultModal({ score, correctCount, totalCount, passed }) {
    return Swal.fire({
        title: passed ? 'Тест успешно сдан!' : 'Тест не сдан',
        html: `
            <div class="space-y-2">
                <p class="text-base font-semibold">Результат: <span class="${passed ? 'text-green-500' : 'text-red-500'}">${score}%</span></p>
                <p class="text-xs text-gray-400">Правильных ответов: ${correctCount} из ${totalCount}</p>
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
            html: `<pre class="bg-gray-900 text-red-400 p-3 rounded text-xs text-left overflow-x-auto">${compileError}</pre>`,
            icon: 'error',
            confirmButtonText: 'Закрыть'
        });
    }

    const testListHtml = tests.map(t => `
        <div class="flex items-center justify-between p-2 mb-1 rounded text-xs ${t.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
            <span>${t.name}</span>
            <span>${t.passed ? '✓ Пройден' : '✗ Ошибка'} (${t.time_ms} ms)</span>
        </div>
    `).join('');

    return Swal.fire({
        title: isSubmit ? 'Лабораторная работа отправлена!' : (isPassed ? 'Тесты пройдены!' : 'Тесты не пройдены'),
        html: `
            <div class="text-left space-y-2">
                <p class="text-sm font-semibold mb-2">Детализация тестов:</p>
                <div class="max-h-48 overflow-y-auto space-y-1">${testListHtml}</div>
            </div>
        `,
        icon: isPassed ? 'success' : 'warning',
        confirmButtonText: 'Продолжить',
        confirmButtonColor: '#2563eb',
        allowOutsideClick: false,
        allowEscapeKey: false
    });
}