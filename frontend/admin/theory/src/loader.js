document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    loadChaptersTree();
});

function initEvents() {
    document.getElementById('btn-create-chapter')?.addEventListener('click', createChapter);

    document.getElementById('chapters-tree-container')?.addEventListener('click', (e) => {
        const editChapterBtn = e.target.closest('.btn-edit-chapter');
        if (editChapterBtn) {
            editChapter(editChapterBtn.dataset.chapterId, editChapterBtn.dataset.chapterTitle);
            return;
        }

        const createLesBtn = e.target.closest('.btn-create-lesson');
        if (createLesBtn) {
            createLesson(createLesBtn.dataset.chapterId);
            return;
        }

        const deleteChapterBtn = e.target.closest('.btn-delete-chapter');
        if (deleteChapterBtn) {
            confirmDeleteChapter(deleteChapterBtn.dataset.chapterId, deleteChapterBtn.dataset.chapterTitle);
            return;
        }

        const deleteLesBtn = e.target.closest('.btn-delete-lesson');
        if (deleteLesBtn) {
            confirmDeletelesson(deleteLesBtn.dataset.lessonId, deleteLesBtn.dataset.lessonTitle);
            return;
        }
    });
}

async function loadChaptersTree() {
    const token = localStorage.getItem('authToken');

    try {
        const res = await fetch('/api/v1/admin/ebook/chapters', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        const container = document.getElementById('chapters-tree-container');

        if (!data.chapters || data.chapters.length === 0) {
            container.innerHTML = `<div class="p-12 border border-dashed border-gray-700 rounded-2xl text-center text-[var(--text-main)] text-xs">Главы учебника пока не созданы.</div>`;
            return;
        }

        container.innerHTML = data.chapters.map((ch, idx) => {
            const lessons = Array.isArray(ch.lessons) ? ch.lessons : [];

            return `
                <div class="bg-[var(--bg-card)] border border-gray-400 rounded-2xl overflow-hidden">
                    <div class="p-4 bg-gray-400/40 flex justify-between items-center border-b border-gray-200/40">
                        <div class="flex items-center gap-3">
                            <span class="w-7 h-7 rounded-lg bg-blue-200/20 text-blue-600 font-mono font-bold text-xs flex items-center justify-center border border-blue-500/30">
                                ${ch.order || idx + 1}
                            </span>
                            <h3 class="font-bold text-sm text-[var(--text-main)]">${ch.title}</h3>
                            <button data-chapter-id="${ch.id}" data-chapter-title="${ch.title}" class="btn-edit-chapter text-[var(--text-main)] hover:text-blue-400 text-xs ml-1" title="Переименовать главу">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                        </div>

                        <div class="flex items-center gap-2">
                            <button data-chapter-id="${ch.id}" class="btn-create-lesson px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg text-xs font-semibold transition border border-blue-500/30 flex items-center gap-1">
                                <i class="fa-solid fa-plus text-[10px]"></i> Страница
                            </button>
                            <button data-chapter-id="${ch.id}" data-chapter-title="${ch.title}" class="btn-delete-chapter text-red-600 hover:text-red-600 p-1.5 text-xs">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>

                    <div class="p-2 divide-y divide-gray-600/40">
                        ${lessons.length === 0 
                            ? `<div class="p-3 text-center text-xs text-[var(--text-main)]">В этой главе еще нет статей</div>`
                            : lessons.map(les => `
                                <div class="p-3 hover:bg-gray-400/30 transition flex justify-between items-center rounded-xl">
                                    <div class="flex items-center gap-2">
                                        <span class="text-[11px] font-mono text-blue-400 font-semibold px-1.5 py-0.5 rounded bg-blue-500/10">№ ${les.order || 0}</span>
                                        <span class="text-xs font-medium text-[var(--text-main)]">${les.title}</span>
                                    </div>

                                    <div class="flex items-center gap-3">
                                        <a href="editor.html?id=${les.id}" class="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold">
                                            <i class="fa-solid fa-pen-to-square"></i> Редактировать
                                        </a>
                                        <button data-lesson-id="${les.id}" data-lesson-title="${les.title}" class="btn-delete-lesson text-xs text-red-600 hover:text-red-300">
                                            <i class="fa-solid fa-xmark"></i>
                                        </button>
                                    </div>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error(error);
    }
}

async function createChapter() {
    const token = localStorage.getItem('authToken');

    const { value: title } = await Swal.fire({
        title: 'Новая глава учебника',
        input: 'text',
        inputLabel: 'Название главы',
        placeholder: 'Например: Глава 1. Основы трассировки лучей',
        showCancelButton: true,
        confirmButtonText: 'Создать',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#2563eb',
        inputValidator: (v) => !v && 'Название обязательно!'
    });

    if (title) {
        const res = await fetch('/api/v1/admin/ebook/chapters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title })
        });
        if (res.ok) loadChaptersTree();
    }
}

async function editChapter(chapterId, currentTitle) {
    const token = localStorage.getItem('authToken');

    const { value: newTitle } = await Swal.fire({
        title: 'Редактирование главы',
        input: 'text',
        inputValue: currentTitle,
        inputLabel: 'Название главы',
        showCancelButton: true,
        confirmButtonText: 'Сохранить',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#2563eb',
        inputValidator: (v) => !v && 'Название не может быть пустым!'
    });

    if (newTitle && newTitle !== currentTitle) {
        const res = await fetch(`/api/v1/admin/ebook/chapters/${chapterId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title: newTitle })
        });
        if (res.ok) loadChaptersTree();
    }
}

async function createLesson(chapterId) {
    const token = localStorage.getItem('authToken');

    const { value: title } = await Swal.fire({
        title: 'Новая статья',
        input: 'text',
        inputLabel: 'Название параграфа/статьи',
        placeholder: 'Например: Пересечение луча со сферой',
        showCancelButton: true,
        confirmButtonText: 'Создать и открыть',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#2563eb',
        inputValidator: (v) => !v && 'Название обязательно!'
    });

    if (title) {
        const res = await fetch('/api/v1/admin/ebook/lessons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ chapterId, title })
        });

        const data = await res.json();

        if (data.status === 'success') {
            window.location.href = `editor.html?id=${data.lessonId}`;
        }
    }
}

async function confirmDeleteChapter(chapterId, title) {
    const token = localStorage.getItem('authToken');

    const res = await Swal.fire({
        title: 'Удалить главу?',
        text: `Удалить "${title}" со всеми страницами?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Удалить',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#ef4444'
    });

    if (res.isConfirmed) {
        const response = await fetch(`/api/v1/admin/ebook/chapters/${chapterId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) loadChaptersTree();
    }
}

async function confirmDeletelesson(lessonId, title) {
    const token = localStorage.getItem('authToken');

    const res = await Swal.fire({
        title: 'Удалить страницу?',
        text: `Удалить "${title}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Удалить',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#ef4444'
    });

    if (res.isConfirmed) {
        const response = await fetch(`/api/v1/admin/ebook/lessons/${lessonId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) loadChaptersTree();
    }
}