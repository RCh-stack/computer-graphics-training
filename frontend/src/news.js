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
    if (!feedContainer) return;

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

    feedContainer.innerHTML = filtered.map(item => createNewsCardHTML(item)).join('');
}

function createNewsCardHTML(item) {
    const isPersonal = item.user_id !== null;
    const dateStr = new Date(item.created_at).toLocaleString('ru-RU', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });

    let iconClass = 'fa-bell text-pink-400 bg-pink-500/10 border-pink-500/20';
    let typeBadge = '<span class="text-[10px] px-2 py-0.5 rounded bg-pink-500/10 text-pink-400 border border-pink-500/20">Уведомление</span>';

    if (item.type === 'LAB_STATUS') {
        iconClass = 'fa-flask text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        typeBadge = '<span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Лабораторная</span>';
    } else if (item.type === 'NEW_TEST') {
        iconClass = 'fa-list-check text-amber-400 bg-amber-500/10 border-amber-500/20';
        typeBadge = '<span class="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Новый тест</span>';
    } else if (!isPersonal) {
        iconClass = 'fa-bullhorn text-blue-400 bg-blue-500/10 border-blue-500/20';
        typeBadge = '<span class="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Объявление</span>';
    }

    return `
        <div class="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] hover:border-pink-500/40 transition flex items-start space-x-3 group">
            <div class="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${iconClass}">
                <i class="fa-solid ${iconClass.split(' ')[0]} text-xs"></i>
            </div>
            
            <div class="flex-1 space-y-1">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                        ${typeBadge}
                        <h4 class="text-xs font-bold text-[var(--text-main)] group-hover:text-pink-400 transition">${item.title}</h4>
                    </div>
                    <span class="text-[10px] text-[var(--text-muted)] font-mono">${dateStr}</span>
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

function initNewsEvents() {
    document.getElementById('news-filter-type')?.addEventListener('change', () => {
        renderNewsFeed(allNewsItems);
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
        const title = document.getElementById('news-title-input').value;
        const message = document.getElementById('news-message-input').value;
        const link = document.getElementById('news-link-input').value;

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
                closeModal();
                Swal.fire('Опубликовано!', 'Объявление видно всем студентам', 'success');
                loadNewsFeed();
            }
        } catch (error) {
            console.error('Ошибка публикации новости:', error);
        }
    });
}