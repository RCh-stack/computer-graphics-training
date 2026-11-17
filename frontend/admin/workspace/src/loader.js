document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    loadLabs();
});

function initEvents() {
    document.getElementById('btn-create-lab')?.addEventListener('click', createNewLab);

    document.getElementById('labs-grid')?.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.btn-delete-lab');
        if (deleteBtn) {
            const { labId, labTitle } = deleteBtn.dataset;
            confirmDeleteLab(labId, labTitle);
        }
    });
}

async function loadLabs() {
    const token = localStorage.getItem('authToken');
    const grid = document.getElementById('labs-grid');
    if (!grid) return;

    if (window.Skeleton) {
        Skeleton.render(grid, Skeleton.labCards(4));
    }

    try {
        const res = await fetch('/api/v1/admin/labs', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Не удалось загрузить лабораторные работы');

        const data = await res.json();

        if (!data.labs || data.labs.length === 0) {
            grid.innerHTML = `<div class="col-span-full ui-card py-12 text-center text-xs text-[var(--text-muted)]">Лабораторные работы пока не созданы.</div>`;
            return;
        }

        grid.innerHTML = data.labs.map(lab => {
            const lockBadge = lab.is_unlocked
                ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 shrink-0"><i class="fa-solid fa-lock-open mr-1"></i> Доступна</span>`
                : `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/25 shrink-0"><i class="fa-solid fa-lock mr-1"></i> Заблокирована</span>`;

            const testCasesCount = Array.isArray(lab.test_cases) ? lab.test_cases.length : 0;
            const safeTitle = String(lab.title || '').replace(/"/g, '"');

            return `
                <div class="ui-card p-5 hover:border-emerald-500/40 transition-all flex flex-col justify-between space-y-4">
                    <div class="space-y-2">
                        <div class="flex justify-between items-start gap-2">
                            <span class="text-xs font-mono font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">№ ${lab.order || 0}</span>
                            ${lockBadge}
                        </div>
                        <h3 class="font-bold text-base text-[var(--text-main)]">${lab.title}</h3>
                        <p class="text-xs text-[var(--text-muted)] line-clamp-2">${lab.description || 'Без описания'}</p>
                    </div>

                    <div class="flex items-center gap-4 text-xs text-[var(--text-muted)] pt-3 ui-divider-t font-mono">
                        <div><i class="fa-solid fa-vial text-emerald-500 mr-1"></i> ${testCasesCount} тестов</div>
                        <div><i class="fa-solid fa-signal text-emerald-500 mr-1"></i> ${lab.difficulty || 'Средний'}</div>
                    </div>

                    <div class="flex gap-2 pt-1">
                        <a href="lab-workspace.html?id=${lab.id}" class="ui-btn ui-btn-soft flex-1">
                            <i class="fa-solid fa-pen-to-square"></i> Редактировать
                        </a>
                        <button type="button" data-lab-id="${lab.id}" data-lab-title="${safeTitle}" class="btn-delete-lab ui-btn ui-btn-danger px-3" title="Удалить лабораторную">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-rose-500 text-xs">Не удалось загрузить список лабораторных работ. Проверьте подключение к серверу.</div>`;
        window.Toast?.error('Ошибка загрузки', 'Не удалось получить список лабораторных работ');
    }
}

async function createNewLab() {
    const token = localStorage.getItem('authToken');

    const { value: title } = await Swal.fire({
        title: 'Новая лабораторная работа',
        input: 'text',
        inputLabel: 'Введите название',
        placeholder: 'Например: Лабораторная работа №1: Векторные операции',
        showCancelButton: true,
        confirmButtonText: 'Создать',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#10b981',
        inputValidator: (v) => !v && 'Название обязательно!'
    });

    if (title) {
        try {
            const res = await fetch('/api/v1/admin/labs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    title,
                    description: 'Описание работы...',
                    difficulty: 'Средний',
                    isUnlocked: true,
                    order: 1,
                    templateCode: '#include <iostream>\n\nint main() {\n    // Ваш код здесь\n    return 0;\n}',
                    taskJson: {
                        title: title,
                        instruction: 'Реализуйте требуемые функции в заголовочном файле.',
                        requirements: ['Использовать C++20']
                    },
                    testCases: [
                        { id: 1, name: 'Тест №1', input: '1 2', timeout_ms: 1000, expected_output: '3' }
                    ]
                })
            });
            const data = await res.json();
            if (res.ok && data.status === 'success') {
                window.location.href = `lab-workspace.html?id=${data.labId}`;
            } else {
                Toast.error(data.message || 'Не удалось создать лабораторную работу');
            }
        } catch (err) {
            console.error(err);
            Toast.error('Ошибка соединения при создании лабораторной работы');
        }
    }
}

async function confirmDeleteLab(labId, labTitle) {
    const token = localStorage.getItem('authToken');

    const res = await Swal.fire({
        title: 'Удалить лабораторную?',
        text: `Вы действительно хотите удалить "${labTitle}"? Данные студентов будут удалены!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Да, удалить',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#ef4444'
    });

    if (res.isConfirmed) {
        try {
            const response = await fetch(`/api/v1/admin/labs/${labId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                Toast.success('Лабораторная работа успешно удалена');
                loadLabs();
            } else {
                const data = await response.json().catch(() => ({}));
                Toast.error(data.message || 'Не удалось удалить лабораторную работу');
            }
        } catch (err) {
            console.error(err);
            Toast.error('Ошибка соединения при удалении лабораторной работы');
        }
    }
}