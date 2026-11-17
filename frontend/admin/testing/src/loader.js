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
    const grid = document.getElementById('tests-grid');
    if (!grid) return;

    if (window.Skeleton) {
        Skeleton.render(grid, Skeleton.testCards(4));
    }

    try {
        const res = await fetch('/api/v1/admin/tests', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Не удалось загрузить список тестов');

        const data = await res.json();

        if (!data.tests || data.tests.length === 0) {
            grid.innerHTML = `<div class="col-span-full ui-card py-12 text-center text-xs text-[var(--text-muted)]">Тесты пока не созданы. Нажмите «Создать тест» для начала.</div>`;
            return;
        }

        grid.innerHTML = data.tests.map(test => {
            const lockBadge = test.is_unlocked
                ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 shrink-0"><i class="fa-solid fa-lock-open mr-1"></i> Доступен</span>`
                : `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/25 shrink-0"><i class="fa-solid fa-lock mr-1"></i> Заблокирован</span>`;

            const safeTitle = String(test.title || '').replace(/"/g, '"');

            return `
                <div class="ui-card p-5 hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-4">
                    <div class="space-y-2">
                        <div class="flex justify-between items-start gap-2">
                            <h3 class="font-bold text-base text-[var(--text-main)]">${test.title}</h3>
                            ${lockBadge}
                        </div>
                        <p class="text-xs text-[var(--text-muted)] line-clamp-2">${test.description || 'Без описания'}</p>
                    </div>

                    <div class="flex items-center gap-4 text-xs text-[var(--text-muted)] pt-3 ui-divider-t font-mono">
                        <div><i class="fa-solid fa-clock text-amber-500 mr-1"></i> ${test.time_limit || 15} мин</div>
                        <div><i class="fa-solid fa-signal text-amber-500 mr-1"></i> ${test.difficulty || 'Средний'}</div>
                        <div><i class="fa-solid fa-circle-question text-amber-500 mr-1"></i> ${test.questions_count || 0} вопр.</div>
                    </div>

                    <div class="flex gap-2 pt-1">
                        <a href="test-workspace.html?id=${test.id}" class="ui-btn ui-btn-soft flex-1">
                            <i class="fa-solid fa-pen-to-square"></i> Редактировать
                        </a>
                        <button type="button" data-test-id="${test.id}" data-test-title="${safeTitle}" class="btn-delete-test ui-btn ui-btn-danger px-3" title="Удалить тест">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error(error);
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-rose-500 text-xs">Ошибка загрузки списка тестов. Проверьте подключение к серверу.</div>`;
        window.Toast?.error('Ошибка загрузки', 'Не удалось получить список тестов');
    }
}

async function createNewTest() {
    const token = localStorage.getItem('authToken');

    const { value: title } = await Swal.fire({
        title: 'Новый тест',
        input: 'text',
        inputLabel: 'Введите название теста',
        placeholder: 'Например: Тест №1: Векторный анализ',
        showCancelButton: true,
        confirmButtonText: 'Создать',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#d97706',
        inputValidator: (v) => !v && 'Название не может быть пустым!'
    });

    if (title) {
        try {
            const res = await fetch('/api/v1/admin/tests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ title, description: '', difficulty: 'Легкий', timeLimit: 15, isUnlocked: true })
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                window.location.href = `test-workspace.html?id=${data.testId}`;
            } else {
                Toast.error(data.message || 'Не удалось создать новый тест');
            }
        } catch (error) {
            console.error(error);
            Toast.error('Ошибка соединения при создании теста');
        }
    }
}

async function confirmDeleteTest(testId, testTitle) {
    const token = localStorage.getItem('authToken');

    const res = await Swal.fire({
        title: 'Удалить тест?',
        text: `Вы действительно хотите удалить "${testTitle}"? Вопросы и результаты студентов будут удалены!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Да, удалить',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#ef4444'
    });

    if (res.isConfirmed) {
        try {
            const response = await fetch(`/api/v1/admin/tests/${testId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                Toast.success('Тест успешно удален');
                loadTests();
            } else {
                const data = await response.json().catch(() => ({}));
                Toast.error(data.message || 'Не удалось удалить тест');
            }
        } catch (error) {
            console.error(error);
            Toast.error('Ошибка соединения при удалении теста');
        }
    }
}