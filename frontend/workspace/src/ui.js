const themeBtn = document.getElementById('theme-toggle');
if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-theme');
    themeBtn.innerText = '☀️ Светлая';
}

themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    themeBtn.innerText = isLight ? '☀️ Светлая' : '🌙 Тёмная';
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
});

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('labs-grid');
    if (!grid) return;

    try {
        const response = await fetch('content/manifest.json');
        const labs = await response.json();

        grid.innerHTML = labs.map(lab => createLabCardHTML(lab)).join('');
    } catch (error) {
        console.error('Ошибка загрузки manifest.json:', error);
    }
});

function createLabCardHTML(lab) {
    // Настройка внешнего вида в зависимости от статуса
    let badgeHTML = '';
    let btnHTML = '';
    let cardBorder = 'border-[var(--border-color)]';

    if (lab.status === 'completed') {
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✓ Выполнено</span>`;
        btnHTML = `<a href="lab-workspace.html?id=${lab.id}" class="bg-[var(--bg-card)] hover:bg-gray-800 border border-[var(--border-color)] text-[var(--text-main)] text-xs font-bold px-4 py-2 rounded-xl transition">Открыть</a>`;
    } else if (lab.status === 'in_progress') {
        cardBorder = 'border-2 border-indigo-500/50';
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">В процессе</span>`;
        btnHTML = `<a href="lab-workspace.html?id=${lab.id}" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center space-x-1 shadow-md"><span>Продолжить</span> <span>→</span></a>`;
    } else {
        badgeHTML = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider bg-gray-500/10 text-gray-400 border border-gray-500/20">🔒 Заблокировано</span>`;
        btnHTML = `<button disabled class="bg-[var(--bg-card)] text-[var(--text-muted)] cursor-not-allowed text-xs font-bold px-4 py-2 rounded-xl border border-[var(--border-color)]">Заблокировано</button>`;
    }

    return `
        <div class="bg-[var(--bg-panel)] ${cardBorder} rounded-2xl p-5 flex flex-col justify-between hover:border-indigo-500/50 transition shadow-lg group">
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    ${badgeHTML}
                    <span class="w-2 h-2 rounded-full ${lab.status === 'completed' ? 'bg-emerald-400' : lab.status === 'in_progress' ? 'bg-indigo-400 animate-ping' : 'bg-gray-500'}"></span>
                </div>
                <h3 class="text-lg font-bold group-hover:text-indigo-400 transition">${lab.title}</h3>
                <p class="text-xs text-[var(--text-muted)] leading-relaxed">${lab.description}</p>
            </div>
            <div class="pt-6 mt-4 border-t border-[var(--border-color)] flex items-center justify-between">
                <span class="text-[11px] font-mono text-[var(--text-muted)]">${lab.category}</span>
                ${btnHTML}
            </div>
        </div>
    `;
}