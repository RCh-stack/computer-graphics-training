function launchModule(url) {
     window.location.href = url;
 }

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

document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.navigation-link');
    const pages = document.querySelectorAll('.page');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPageId = link.getAttribute('data-target');
                    
            // Скрываем все страницы
            pages.forEach(page => page.classList.remove('active'));
                    
            // Показываем целевую страницу
            const targetPage = document.getElementById(targetPageId);
            if (targetPage) {
                targetPage.classList.add('active');
                // Скролл к началу страницы
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            });
    });
            
    // Инициализация Canvas (просто зальем серым цветом для демонстрации)
    const canvas = document.getElementById('renderCanvas');
    if(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1e1e24';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px sans-serif';
        ctx.fillText('Ожидание запуска C++ Wasm модуля...', 180, 240);
    }
});