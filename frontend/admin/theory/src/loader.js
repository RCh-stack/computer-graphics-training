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
    const container = document.getElementById('chapters-tree-container');
    if (!container) return;

    if (window.Skeleton) {
        Skeleton.render(container, Skeleton.ebookChaptersTree(3, 2));
    }

    try {
        const res = await fetch('/api/v1/admin/ebook/chapters', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Не удалось загрузить структуру учебника');

        const data = await res.json();

        if (!data.chapters || data.chapters.length === 0) {
            container.innerHTML = `<div class="p-12 border border-dashed border-[var(--border-strong)] rounded-2xl text-center text-[var(--text-muted)] text-xs">Главы учебника пока не созданы.</div>`;
            return;
        }

        container.innerHTML = data.chapters.map((ch, idx) => {
            const lessons = Array.isArray(ch.lessons) ? ch.lessons : [];
            const safeChTitle = String(ch.title || '').replace(/"/g, '"');

            return `
                <div class="ui-card overflow-hidden">
                    <div class="p-4 bg-[var(--bg-elevated)] flex justify-between items-center ui-divider-b">
                        <div class="flex items-center gap-3">
                            <span class="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 font-mono font-bold text-xs flex items-center justify-center border border-blue-500/25">
                                ${ch.order || idx + 1}
                            </span>
                            <h3 class="font-bold text-sm text-[var(--text-main)]">${ch.title}</h3>
                            <button type="button" data-chapter-id="${ch.id}" data-chapter-title="${safeChTitle}" class="btn-edit-chapter text-[var(--text-muted)] hover:text-blue-500 text-xs ml-1 transition" title="Переименовать раздел">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                        </div>

                        <div class="flex items-center gap-2">
                            <button type="button" data-chapter-id="${ch.id}" class="btn-create-lesson ui-btn ui-btn-soft py-1.5 px-3">
                                <i class="fa-solid fa-plus text-[10px]"></i> Страница
                            </button>
                            <button type="button" data-chapter-id="${ch.id}" data-chapter-title="${safeChTitle}" class="btn-delete-chapter text-[var(--text-muted)] hover:text-rose-500 p-1.5 text-xs transition" title="Удалить раздел">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>

                    <div class="p-2 space-y-1">
                        ${lessons.length === 0
                            ? `<div class="p-4 text-center text-xs text-[var(--text-muted)]">В этой главе еще нет статей</div>`
                            : lessons.map(les => {
                                const safeLesTitle = String(les.title || '').replace(/"/g, '"');
                                return `
                                    <div class="p-3 hover:bg-[var(--bg-hover)] transition flex justify-between items-center rounded-xl">
                                        <div class="flex items-center gap-2.5">
                                            <span class="text-[11px] font-mono text-blue-500 font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20">№ ${les.order || 0}</span>
                                            <span class="text-xs font-medium text-[var(--text-main)]">${les.title}</span>
                                        </div>

                                        <div class="flex items-center gap-3">
                                            <a href="editor.html?id=${les.id}" class="text-xs text-blue-500 hover:underline flex items-center gap-1.5 font-semibold">
                                                <i class="fa-solid fa-pen-to-square"></i> Редактировать
                                            </a>
                                            <button type="button" data-lesson-id="${les.id}" data-lesson-title="${safeLesTitle}" class="btn-delete-lesson text-xs text-[var(--text-muted)] hover:text-rose-500 p-1 transition" title="Удалить страницу">
                                                <i class="fa-solid fa-xmark"></i>
                                            </button>
                                        </div>
                                    </div>
                                `;
                            }).join('')
                        }
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error(error);
        container.innerHTML = `<div class="p-12 border border-dashed border-rose-500/30 rounded-2xl text-center text-rose-500 text-xs">Не удалось загрузить структуру учебника. Проверьте подключение к серверу.</div>`;
        window.Toast?.error('Ошибка загрузки', 'Не удалось получить главы учебника');
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
        try {
            const res = await fetch('/api/v1/admin/ebook/chapters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ title })
            });
            if (res.ok) {
                Toast.success('Раздел учебника создан');
                loadChaptersTree();
            } else {
                const data = await res.json().catch(() => ({}));
                Toast.error(data.message || 'Не удалось создать раздел');
            }
        } catch (error) {
            console.error(error);
            Toast.error('Ошибка соединения при создании раздела');
        }
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
        try {
            const res = await fetch(`/api/v1/admin/ebook/chapters/${chapterId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ title: newTitle })
            });
            if (res.ok) {
                Toast.success('Название раздела обновлено');
                loadChaptersTree();
            } else {
                const data = await res.json().catch(() => ({}));
                Toast.error(data.message || 'Не удалось переименовать раздел');
            }
        } catch (error) {
            console.error(error);
            Toast.error('Ошибка соединения при обновлении раздела');
        }
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
        try {
            const res = await fetch('/api/v1/admin/ebook/lessons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ chapterId, title })
            });

            const data = await res.json();

            if (res.ok && data.status === 'success') {
                window.location.href = `editor.html?id=${data.lessonId}`;
            } else {
                Toast.error(data.message || 'Не удалось создать страницу');
            }
        } catch (error) {
            console.error(error);
            Toast.error('Ошибка соединения при создании страницы');
        }
    }
}

async function confirmDeleteChapter(chapterId, title) {
    const token = localStorage.getItem('authToken');

    const res = await Swal.fire({
        title: 'Удалить раздел?',
        text: `Удалить "${title}" со всеми страницами?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Удалить',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#ef4444'
    });

    if (res.isConfirmed) {
        try {
            const response = await fetch(`/api/v1/admin/ebook/chapters/${chapterId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                Toast.success('Раздел учебника успешно удален');
                loadChaptersTree();
            } else {
                const data = await response.json().catch(() => ({}));
                Toast.error(data.message || 'Не удалось удалить раздел');
            }
        } catch (error) {
            console.error(error);
            Toast.error('Ошибка соединения при удалении раздела');
        }
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
        try {
            const response = await fetch(`/api/v1/admin/ebook/lessons/${lessonId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                Toast.success('Страница учебника успешно удалена');
                loadChaptersTree();
            } else {
                const data = await response.json().catch(() => ({}));
                Toast.error(data.message || 'Не удалось удалить страницу');
            }
        } catch (error) {
            console.error(error);
            Toast.error('Ошибка соединения при удалении страницы');
        }
    }
}