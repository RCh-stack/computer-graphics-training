document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('labs-grid');
    if (!grid) return;

    if (window.Skeleton) {
        Skeleton.render(grid, Skeleton.labCards(4));
        ['stat-passed-labs', 'stat-avg-score'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = `<span aria-hidden="true" class="inline-block h-7 w-14 rounded-lg bg-gray-500/20 animate-pulse align-middle"></span>`;
            }
        });
    }

    try {
        const token = localStorage.getItem('authToken');

        const response = await fetch('/api/v1/labs/', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        if (!response.ok) throw new Error('Не удалось загрузить лабораторные работы');

        const result = await response.json();
        const labs = result.labs || [];

        if (labs.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-8 text-[var(--text-muted)] text-sm">
                    Лабораторные работы пока не добавлены.
                </div>
            `;
        } else {
            grid.innerHTML = labs.map(lab => createLabCardHTML(lab)).join('');
        }

        renderStats(labs);
    } catch (error) {
        console.error('Ошибка загрузки списка лабораторных:', error);
        ['stat-passed-labs', 'stat-avg-score'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '—';
        });
        grid.innerHTML = `
            <div class="col-span-full text-center py-8 text-rose-500 text-sm">
                Не удалось загрузить список лабораторных работ. Проверьте подключение к серверу.
            </div>
        `;
        window.Toast?.error('Ошибка загрузки', 'Не удалось получить список лабораторных работ');
    }
});

function createLabCardHTML(lab) {
    let badgeHTML = '';
    let btnHTML = '';
    let cardBorder = 'border-[var(--border-color)]';

    let difficultyColor = '';

    if (lab.difficulty === 'Легкий')
        difficultyColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/25';
    else if (lab.difficulty === 'Средний')
        difficultyColor = 'text-amber-500 bg-amber-500/10 border-amber-500/25';
    else
        difficultyColor = 'text-rose-500 bg-rose-500/10 border-rose-500/25';

    if (!lab.is_unlocked) {
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-slate-500/10 text-[var(--text-muted)] border border-[var(--border-color)]">🔒 Заблокировано</span>`;
        btnHTML = `<button disabled class="bg-[var(--bg-card)] text-[var(--text-muted)] opacity-60 cursor-not-allowed text-xs font-bold px-4 py-2 rounded-xl border border-[var(--border-color)]">Заблокировано</button>`;
    } else if (lab.status === 'PASSED') {
        cardBorder = 'border-2 border-emerald-500/50';
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">✅ Принято</span>`;
        btnHTML = `<a href="lab-workspace.html?id=${lab.id}" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center space-x-1 shadow-sm"><span>Открыть</span></a>`;
    } else if (lab.status === 'REVISION') {
        cardBorder = 'border-2 border-amber-500/60';
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/25 animate-pulse">⚠️ На доработку</span>`;
        btnHTML = `<a href="lab-workspace.html?id=${lab.id}" class="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center space-x-1 shadow-sm"><span>Исправить</span></a>`;
    } else if (lab.status === 'REJECTED') {
        cardBorder = 'border-2 border-rose-500/50';
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/25 animate-pulse">❌ Отклонено</span>`;
        btnHTML = `<a href="lab-workspace.html?id=${lab.id}" class="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center space-x-1 shadow-sm"><span>Исправить</span></a>`;
    } else if (lab.status === 'SUBMITTED') {
        cardBorder = 'border-2 border-blue-500/50';
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/25">🔎 На проверке</span>`;
        btnHTML = `<a href="lab-workspace.html?id=${lab.id}" class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center space-x-1 shadow-sm"><span>Просмотр</span></a>`;
    } else if (lab.status === 'DRAFT') {
        cardBorder = 'border-2 border-slate-500/40';
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-slate-500/10 text-[var(--text-muted)] border border-[var(--border-color)]">📝 Черновик</span>`;
        btnHTML = `<a href="lab-workspace.html?id=${lab.id}" class="bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center space-x-1 shadow-sm"><span>Продолжить</span></a>`;
    } else {
        cardBorder = 'border-2 border-indigo-500/50';
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-indigo-500/10 text-indigo-500 border border-indigo-500/25">Доступна</span>`;
        btnHTML = `<a href="lab-workspace.html?id=${lab.id}" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center space-x-1 shadow-sm"><span>Начать</span></a>`;
    }

    return `
        <div class="bg-[var(--bg-panel)] ${cardBorder} rounded-2xl p-5 flex flex-col justify-between transition shadow-sm group">
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    ${badgeHTML}
                    <span class="w-2 h-2 rounded-full ${lab.status === 'PASSED' ? 'bg-emerald-500' : lab.status === 'REVISION' ? 'bg-amber-500 animate-ping' :
                        lab.status === 'REJECTED' ? 'bg-rose-500 animate-ping' : lab.is_unlocked ? 'bg-indigo-500' : 'bg-slate-400'}"></span>
                </div>
                <h3 class="text-lg font-bold text-[var(--text-main)] group-hover:text-indigo-500 transition">${lab.title}</h3>
                <p class="text-xs text-[var(--text-muted)] leading-relaxed">${lab.description}</p>
            </div>
            <div class="pt-6 mt-4 border-t border-[var(--border-color)] flex items-center justify-between">
                <span class="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md border ${difficultyColor}">${lab.difficulty}</span>
                ${btnHTML}
            </div>
        </div>
    `;
}

function renderStats(labs) {
    const totalCount = labs.length;
    const completedLabs = labs.filter(l => l.status === 'PASSED');

    let avgScore = 0;
    if (completedLabs.length > 0) {
        const totalScoreSum = completedLabs.reduce((acc, lab) => acc + (lab.grade || 0), 0);
        avgScore = Math.round(totalScoreSum / totalCount);
    }

    document.getElementById('stat-passed-labs').textContent = `${completedLabs.length} / ${totalCount}`;
    document.getElementById('stat-avg-score').textContent = `${avgScore}%`;
}