document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('labs-grid');
    if (!grid) return;

    try {
        const token = localStorage.getItem('authToken');

        const response = await fetch(`/api/v1/labs/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        if (!response.ok) throw new Error('Не удалось загрузить лабораторные работы');

        const result = await response.json();
        const labs = result.labs;

        grid.innerHTML = labs.map(lab => createLabCardHTML(lab)).join('');

        renderStats(labs);
    } catch (error) {
        console.error('Ошибка загрузки списка лабораторных:', error);
    }
});

function createLabCardHTML(lab) {
    let badgeHTML = '';
    let btnHTML = '';
    let cardBorder = 'border-[var(--border-color)]';

    let difficultyColor = '';

    if (lab.difficulty === 'Легкий')
        difficultyColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    else if (lab.difficulty === 'Средний')
        difficultyColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    else
        difficultyColor = 'text-red-400 bg-red-500/10 border-red-500/20';

    if (!lab.is_unlocked) {
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-gray-500/10 text-gray-400 border border-gray-500/20">🔒 Заблокировано</span>`;
        btnHTML = `<button disabled class="bg-[var(--bg-card)] text-[var(--text-muted)] cursor-not-allowed text-xs font-bold px-4 py-2 rounded-xl border border-[var(--border-color)]">Заблокировано</button>`;
    } else if (lab.status === 'PASSED') {
        cardBorder = 'border-2 border-emerald-500/50';
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✅ Принято</span>`;
        btnHTML = `<a href="lab-workspace.html?id=${lab.id}" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center space-x-1 shadow-md"><span>Открыть</span></a>`;
    } else if (lab.status === 'REVISION') {
        cardBorder = 'border-2 border-amber-500/60';
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">⚠️ На доработку</span>`;
        btnHTML = `<a href="lab-workspace.html?id=${lab.id}" class="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center space-x-1 shadow-md"><span>Исправить</span></a>`;
    } else if (lab.status === 'REJECTED') {
        cardBorder = 'border-2 border-red-500/50';
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">❌ Отклонено</span>`;
        btnHTML = `<a href="lab-workspace.html?id=${lab.id}" class="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center space-x-1 shadow-md"><span>Исправить</span></a>`;
    } else if (lab.status === 'SUBMITTED') {
        cardBorder = 'border-2 border-blue-500/50';
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">🔎 На проверке</span>`;
        btnHTML = `<a href="lab-workspace.html?id=${lab.id}" class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center space-x-1 shadow-md"><span>Просмотр</span></a>`;
    } else if (lab.status === 'DRAFT') {
        cardBorder = 'border-2 border-gray-500/50';
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-gray-500/10 text-gray-400 border border-gray-500/20">📝 Черновик</span>`;
        btnHTML = `<a href="lab-workspace.html?id=${lab.id}" class="bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center space-x-1 shadow-md"><span>Продолжить</span></a>`;    
    } else {
        cardBorder = 'border-2 border-indigo-500/50';
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Доступна</span>`;
        btnHTML = `<a href="lab-workspace.html?id=${lab.id}" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center space-x-1 shadow-md"><span>Начать</span></a>`;
    }

    return `
        <div class="bg-[var(--bg-panel)] ${cardBorder} rounded-2xl p-5 flex flex-col justify-between transition shadow-lg group">
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    ${badgeHTML}
                    <span class="w-2 h-2 rounded-full ${lab.status === 'PASSED' ? 'bg-emerald-400' : lab.status === 'REVISION' ? 'bg-amber-400 animate-ping' : 
                        lab.status === 'REJECTED' ? 'bg-red-400 animate-ping' : lab.is_unlocked ? 'bg-indigo-400' : 'bg-gray-500'}"></span>
                </div>
                <h3 class="text-lg font-bold group-hover:text-indigo-400 transition">${lab.title}</h3>
                <p class="text-xs text-[var(--text-muted)] leading-relaxed">${lab.description}</p>
            </div>
            <div class="pt-6 mt-4 border-t border-[var(--border-color)] flex items-center justify-between">
                <span class="text-[11px] font-mono px-2 py-0.5 rounded border ${difficultyColor}">${lab.difficulty}</span>
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