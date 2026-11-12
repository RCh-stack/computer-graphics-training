document.addEventListener('DOMContentLoaded', () => {
    loadNewsFeed();
    initNewsEvents();
});

let allNewsItems = [];

async function loadNewsFeed() {
    const feedContainer = document.getElementById('news-feed-list');
    if (!feedContainer) return;

    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch('/api/v1/news', {
            headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        });

        const data = await res.json();
        if (data.status === 'success') {
            allNewsItems = data.news;
            renderNewsFeed(allNewsItems);
        } else {
            feedContainer.innerHTML = `<div class="text-center text-xs text-red-400 py-4">Не удалось загрузить новости</div>`;
        }
    } catch (err) {
        console.error('Ошибка загрузки ленты новостей:', err);
    }
}

function renderNewsFeed(items) {
    const feedContainer = document.getElementById('news-feed-list');
    const clearAllBtn = document.getElementById('btn-clear-all-news');
    if (!feedContainer) return;

    if (clearAllBtn) {
        clearAllBtn.classList.toggle('hidden', items.length === 0);
    }

    if (items.length === 0) {
        feedContainer.innerHTML = `<div class="text-center text-xs text-[var(--text-muted)] py-6">Уведомлений пока нет</div>`;
        return;
    }

    const filter = document.getElementById('news-filter-type')?.value || 'ALL';
    const filtered = items.filter(item => {
        if (filter === 'PERSONAL') return item.user_id !== null;
        if (filter === 'ANNOUNCEMENT') return item.user_id === null;
        return true;
    });

    if (filtered.length === 0) {
        feedContainer.innerHTML = `<div class="text-center text-xs text-[var(--text-muted)] py-6">В выбранной категории записей нет</div>`;
        return;
    }

    feedContainer.innerHTML = filtered.map(item => createNewsCardHTML(item)).join('');
}

function createNewsCardHTML(item) {
    const isPersonal = item.user_id !== null;
    const dateStr = new Date(item.created_at).toLocaleString('ru-RU', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });

    let iconType = 'fa-bell';
    let iconClass = 'text-pink-400 bg-pink-500/10 border-pink-500/20';
    let typeBadge = '<span class="text-[10px] px-2 py-0.5 rounded bg-pink-500/10 text-pink-400 border border-pink-500/20">Уведомление</span>';

    if (item.type === 'LAB_STATUS') {
        iconType = 'fa-flask';
        iconClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        typeBadge = '<span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Лабораторная</span>';
    } else if (item.type === 'NEW_TEST') {
        iconType = 'fa-list-check';
        iconClass = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        typeBadge = '<span class="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Тест</span>';
    } else if (item.type === 'NEW_LESSON') {
        iconType = 'fa-book';
        iconClass = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        typeBadge = '<span class="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Урок</span>';
    } else if (!isPersonal) {
        iconType = 'fa-bullhorn';
        iconClass = 'text-red-400 bg-red-500/10 border-red-500/20';
        typeBadge = '<span class="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">Объявление</span>';
    }

    const dismissTitle = isPersonal ? 'Удалить уведомление' : 'Скрыть объявление из ленты';

    return `
        <div data-news-card="${item.id}" class="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] hover:border-pink-500/40 transition-all duration-200 flex items-start space-x-3 group">
            <div class="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${iconClass}">
                <i class="fa-solid ${iconType} text-xs"></i>
            </div>
            
            <div class="flex-1 min-w-0 space-y-1">
                <div class="flex items-start justify-between gap-2">
                    <div class="flex flex-wrap items-center gap-2">
                        ${typeBadge}
                        <h4 class="text-xs font-bold text-[var(--text-main)] group-hover:text-pink-400 transition">${item.title}</h4>
                    </div>

                    <div class="flex items-center space-x-2 shrink-0">
                        <span class="text-[10px] text-[var(--text-muted)] font-mono">${dateStr}</span>
                        <button
                            type="button"
                            data-dismiss-id="${item.id}"
                            title="${dismissTitle}"
                            aria-label="${dismissTitle}"
                            class="btn-dismiss-news w-6 h-6 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition opacity-80 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                        >
                            <i class="fa-solid fa-xmark text-xs pointer-events-none"></i>
                        </button>
                    </div>
                </div>

                <p class="text-xs text-[var(--text-muted)] leading-relaxed">${item.message}</p>

                ${item.link ? `
                    <div class="pt-1">
                        <a href="${item.link}" class="inline-flex items-center space-x-1 text-[11px] text-pink-400 hover:underline font-semibold">
                            <span>Перейти</span>
                            <i class="fa-solid fa-arrow-right text-[9px]"></i>
                        </a>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

async function dismissNewsItem(id, cardElement) {
    if (!id) return;

    if (cardElement) {
        cardElement.classList.add('opacity-40', 'pointer-events-none');
    }

    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch(`/api/v1/news/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        const data = await res.json();
        if (res.ok && data.status === 'success') {
            allNewsItems = allNewsItems.filter(item => String(item.id) !== String(id));
            renderNewsFeed(allNewsItems);
        } else {
            throw new Error(data.message || 'Не удалось убрать уведомление');
        }
    } catch (error) {
        console.error('Ошибка скрытия уведомления:', error);
        if (cardElement) {
            cardElement.classList.remove('opacity-40', 'pointer-events-none');
        }
        Swal.fire('Ошибка', error.message || 'Не удалось удалить уведомление', 'error');
    }
}

async function clearAllNews() {
    if (allNewsItems.length === 0) return;

    const confirmation = await Swal.fire({
        title: 'Очистить ленту?',
        text: 'Личные уведомления будут удалены, а объявления курса скрыты из вашей ленты.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#db2777',
        cancelButtonColor: '#374151',
        confirmButtonText: 'Да, очистить',
        cancelButtonText: 'Отмена'
    });

    if (!confirmation.isConfirmed) return;

    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch('/api/v1/news', {
            method: 'DELETE',
            headers: {
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        const data = await res.json();
        if (res.ok && data.status === 'success') {
            allNewsItems = [];
            renderNewsFeed(allNewsItems);
        } else {
            throw new Error(data.message || 'Не удалось очистить ленту');
        }
    } catch (error) {
        console.error('Ошибка очистки ленты:', error);
        Swal.fire('Ошибка', error.message || 'Не удалось очистить ленту уведомлений', 'error');
    }
}

function initNewsEvents() {
    document.getElementById('news-filter-type')?.addEventListener('change', () => {
        renderNewsFeed(allNewsItems);
    });

    document.getElementById('btn-clear-all-news')?.addEventListener('click', clearAllNews);

    document.getElementById('news-feed-list')?.addEventListener('click', (e) => {
        const dismissBtn = e.target.closest('.btn-dismiss-news');
        if (!dismissBtn) return;

        const id = dismissBtn.dataset.dismissId;
        const card = dismissBtn.closest('[data-news-card]');
        dismissNewsItem(id, card);
    });

    const modal = document.getElementById('create-news-modal');
    const userRaw = localStorage.getItem('user');
    if (userRaw) {
        const user = JSON.parse(userRaw);
        if (user.role === 'TEACHER' || user.role === 'ADMIN') {
            document.getElementById('btn-open-create-news')?.classList.remove('hidden');
        }
    }

    document.getElementById('btn-open-create-news')?.addEventListener('click', () => {
        modal?.classList.remove('hidden');
    });

    const closeModal = () => modal?.classList.add('hidden');
    document.getElementById('btn-close-news-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-news')?.addEventListener('click', closeModal);

    document.getElementById('btn-publish-news')?.addEventListener('click', async () => {
        const titleInput = document.getElementById('news-title-input');
        const messageInput = document.getElementById('news-message-input');
        const linkInput = document.getElementById('news-link-input');

        const title = titleInput.value;
        const message = messageInput.value;
        const link = linkInput.value;

        if (!title.trim() || !message.trim()) {
            Swal.fire('Заполните поля', 'Укажите заголовок и текст сообщения', 'warning');
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch('/api/v1/news', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title, message, link })
            });

            if (res.ok) {
                titleInput.value = '';
                messageInput.value = '';
                linkInput.value = '';
                closeModal();
                Swal.fire('Опубликовано!', 'Объявление видно всем студентам', 'success');
                loadNewsFeed();
            }
        } catch (error) {
            console.error('Ошибка публикации новости:', error);
        }
    });
}