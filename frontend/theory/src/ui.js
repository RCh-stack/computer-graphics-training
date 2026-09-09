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