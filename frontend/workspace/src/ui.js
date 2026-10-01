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
        console.error('Ошибка загрузки manifest.json:', error);
    }
});

function createLabCardHTML(lab) {
    let badgeHTML = '';
    let btnHTML = '';
    let cardBorder = 'border-[var(--border-color)]';

    const difficultyColor = lab.difficulty === 'Легкая' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20';

    if (!lab.is_unlocked) {
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-gray-500/10 text-gray-400 border border-gray-500/20">🔒 Заблокировано</span>`;
        btnHTML = `<button disabled class="bg-[var(--bg-card)] text-[var(--text-muted)] cursor-not-allowed text-xs font-bold px-4 py-2 rounded-xl border border-[var(--border-color)]">Заблокировано</button>`;
    } else if (lab.completed) {
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✓ Выполнено</span>`;
        btnHTML = `<a href="lab-workspace.html?id=${lab.id}" class="bg-[var(--bg-card)] hover:bg-gray-200 border border-[var(--border-color)] text-[var(--text-main)] text-xs font-bold px-4 py-2 rounded-xl transition">Открыть</a>`;
    } else {
        cardBorder = 'border-2 border-indigo-500/50';
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Доступна</span>`;
        btnHTML = `<a href="lab-workspace.html?id=${lab.id}" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center space-x-1 shadow-md"><span>Продолжить</span> <span>→</span></a>`;
    }

    return `
        <div class="bg-[var(--bg-panel)] ${cardBorder} rounded-2xl p-5 flex flex-col justify-between hover:border-indigo-500/50 transition shadow-lg group">
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    ${badgeHTML}
                    <span class="w-2 h-2 rounded-full ${lab.completed ? 'bg-emerald-400' : lab.is_unlocked ? 'bg-indigo-400 animate-ping' : 'bg-gray-500'}"></span>
                </div>
                <h3 class="text-lg font-bold group-hover:text-indigo-400 transition">${lab.title}</h3>
                <p class="text-xs text-[var(--text-muted)] leading-relaxed">${lab.description}</p>
            </div>
            <! -->
            <div class="pt-6 mt-4 border-t border-[var(--border-color)] flex items-center justify-between">
                <span class="text-[11px] font-mono px-2 py-0.5 rounded border ${difficultyColor}">${lab.difficulty}</span>
                ${btnHTML}
            </div>
        </div>
    `;
}

function renderStats(labs) {
    const totalCount = labs.length;
    const completedLabs = labs.filter(l => l.completed);
    
    let avgScore = 0;
    if (completedLabs.length > 0) {
        const totalScoreSum = completedLabs.reduce((acc, lab) => acc + lab.grade, 0);
        avgScore = Math.round(totalScoreSum / completedLabs.length / totalCount);
    }

    document.getElementById('stat-passed-labs').textContent = `${completedLabs.length} / ${totalCount}`;
    document.getElementById('stat-avg-score').textContent = `${avgScore}%`;
}