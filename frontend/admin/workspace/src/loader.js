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
    
    try {
        const res = await fetch('/api/v1/admin/labs', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const grid = document.getElementById('labs-grid');

        if (!data.labs || data.labs.length === 0) {
            grid.innerHTML = `<div class="col-span-full py-12 text-center text-[var(--text-main)]">Лабораторные работы пока не созданы.</div>`;
            return;
        }

        grid.innerHTML = data.labs.map(lab => {
            const lockBadge = lab.is_unlocked 
                ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><i class="fa-solid fa-lock-open mr-1"></i> Доступна</span>`
                : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20"><i class="fa-solid fa-lock mr-1"></i> Заблокирована</span>`;

            const testCasesCount = Array.isArray(lab.test_cases) ? lab.test_cases.length : 0;

            return `
                <div class="bg-[var(--bg-card)] border border-gray-700/80 rounded-2xl p-5 hover:border-emerald-500/50 transition-all flex flex-col justify-between space-y-4">
                    <div class="space-y-2">
                        <div class="flex justify-between items-start gap-2">
                            <span class="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">№ ${lab.order || 0}</span>
                            ${lockBadge}
                        </div>
                        <h3 class="font-bold text-base text-[var(--text-main)]">${lab.title}</h3>
                        <p class="text-xs text-[var(--text-main)] line-clamp-2">${lab.description || 'Без описания'}</p>
                    </div>

                    <div class="flex items-center gap-4 text-xs text-[var(--text-main)] pt-2 border-t border-gray-700/50 font-mono">
                        <div><i class="fa-solid fa-vial text-emerald-400 mr-1"></i> ${testCasesCount} тестов</div>
                        <div><i class="fa-solid fa-signal text-emerald-400 mr-1"></i> ${lab.difficulty || 'Средний'}</div>
                    </div>

                    <div class="flex gap-2 pt-2">
                        <a href="lab-workspace.html?id=${lab.id}" class="flex-1 text-center py-2 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-500 hover:text-white font-semibold rounded-xl text-xs transition border border-emerald-500/30">
                            <i class="fa-solid fa-pen-to-square mr-1"></i> Редактировать
                        </a>
                        <button data-lab-id="${lab.id}" data-lab-title="${lab.title}" class="btn-delete-lab px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs transition">
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
        if (data.status === 'success') {
            window.location.href = `lab-workspace.html?id=${data.labId}`;
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
        const response = await fetch(`/api/v1/admin/labs/${labId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            Swal.fire('Удалено!', 'Лабораторная работа удалена', 'success');
            loadLabs();
        }
    }
}