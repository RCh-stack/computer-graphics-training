(function initTheme() {
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark-theme');
        document.body?.classList.add('dark-theme');
    } else {
        document.documentElement.classList.remove('dark-theme');
        document.body?.classList.remove('dark-theme');
    }
})();

function updateThemeUI(isDark) {
    const themeBtns = document.querySelectorAll('#theme-toggle');

    themeBtns.forEach((btn) => {
        const themeText = btn.querySelector('#theme-text');
        const themeIcon = btn.querySelector('#theme-icon');

        if (themeText) {
            themeText.textContent = isDark ? 'Тёмная тема' : 'Светлая тема';
        } else if (!themeIcon) {
            btn.textContent = isDark ? 'Тёмная' : 'Светлая';
        }

        if (themeIcon) {
            themeIcon.className = isDark
                ? 'fa-solid fa-moon text-sm text-indigo-400'
                : 'fa-solid fa-sun text-sm text-amber-400';
        }

        btn.title = isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему';
    });

    if (window.monaco && window.monaco.editor) {
        window.monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs-light');
    }
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    document.documentElement.classList.toggle('dark-theme', isDark);

    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeUI(isDark);
}

document.addEventListener('DOMContentLoaded', () => {
    const isDark = localStorage.getItem('theme') === 'dark';

    if (isDark) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }

    updateThemeUI(isDark);

    const themeBtns = document.querySelectorAll('#theme-toggle');
    themeBtns.forEach((btn) => {
        btn.removeEventListener('click', toggleTheme);
        btn.addEventListener('click', toggleTheme);
    });
});