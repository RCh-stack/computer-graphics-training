document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    loadTests();
});

function initEvents() {
    document.getElementById('btn-create-test')?.addEventListener('click', createNewTest);

    document.getElementById('tests-grid')?.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.btn-delete-test');
        if (deleteBtn) {
            const { testId, testTitle } = deleteBtn.dataset;
            confirmDeleteTest(testId, testTitle);
        }
    });
}

async function loadTests() {
    const token = localStorage.getItem('authToken');

    try {
        const res = await fetch('/api/v1/admin/tests', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        const grid = document.getElementById('tests-grid');

        if (!data.tests || data.tests.length === 0) {
            grid.innerHTML = `<div class="col-span-full py-12 text-center text-[var(--text-main)]">Тесты пока не созданы. Нажмите "Создать тест" для начала.</div>`;
            return;
        }

        grid.innerHTML = data.tests.map(test => {
            const lockBadge = test.is_unlocked 
                ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><i class="fa-solid fa-lock-open mr-1"></i> Доступен</span>`
                : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20"><i class="fa-solid fa-lock mr-1"></i> Заблокирован</span>`;

            return `
                <div class="bg-[var(--bg-card)] border border-gray-700/80 rounded-2xl p-5 hover:border-pink-500/50 transition-all flex flex-col justify-between space-y-4">
                    <div class="space-y-2">
                        <div class="flex justify-between items-start gap-2">
                            <h3 class="font-bold text-base text-[var(--text-main)]">${test.title}</h3>
                            ${lockBadge}
                        </div>
                        <p class="text-xs text-[var(--text-main)] line-clamp-2">${test.description || 'Без описания'}</p>
                    </div>

                    <div class="flex items-center gap-4 text-xs text-[var(--text-main)] pt-2 border-t border-gray-700/50 font-mono">
                        <div><i class="fa-solid fa-clock text-pink-400 mr-1"></i> ${test.time_limit || 15} мин</div>
                        <div><i class="fa-solid fa-signal text-pink-400 mr-1"></i> ${test.difficulty || 'Средний'}</div>
                        <div><i class="fa-solid fa-circle-question text-pink-400 mr-1"></i> ${test.questions_count || 0} вопр.</div>
                    </div>

                    <div class="flex gap-2 pt-2">
                        <a href="test-workspace.html?id=${test.id}" class="flex-1 text-center py-2 bg-pink-600/20 hover:bg-pink-600 text-pink-400 hover:text-white font-semibold rounded-xl text-xs transition border border-pink-500/30">
                            <i class="fa-solid fa-pen-to-square mr-1"></i> Редактировать
                        </a>
                        <button data-test-id="${test.id}" data-test-title="${test.title}" class="btn-delete-test px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs transition">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
    }
}

async function createNewTest() {
    const token = localStorage.getItem('authToken');

    const { value: title } = await Swal.fire({
        title: 'Новый тест',
        input: 'text',
        inputLabel: 'Введите название теста',
        placeholder: 'Например: Тест #1: Векторный анализ',
        showCancelButton: true,
        confirmButtonText: 'Создать',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#f50b90',
        inputValidator: (v) => !v && 'Название не может быть пустым!'
    });

    if (title) {
        const res = await fetch('/api/v1/admin/tests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title, description: '', difficulty: 'Легкий', timeLimit: 15, isUnlocked: true })
        });
        const data = await res.json();
        if (data.status === 'success') {
            window.location.href = `test-workspace.html?id=${data.testId}`;
        }
    }
}

async function confirmDeleteTest(testId, testTitle) {
    const token = localStorage.getItem('authToken');

    const res = await Swal.fire({
        title: 'Удалить тест?',
        text: `Вы действительно хотите удалить "${testTitle}"? Вопросы и результаты студентов будут стираться!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Да, удалить',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#ef4444'
    });

    if (res.isConfirmed) {
        const response = await fetch(`/api/v1/admin/tests/${testId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            Swal.fire('Удалено!', 'Тест успешно удален', 'success');
            loadTests();
        }
    }
}