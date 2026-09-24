function launchModule(url) {
     window.location.href = url;
 }

document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.navigation-link');
    const pages = document.querySelectorAll('.page');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPageId = link.getAttribute('data-target');
                    
            pages.forEach(page => page.classList.remove('active'));
                    
            const targetPage = document.getElementById(targetPageId);
            if (targetPage) {
                targetPage.classList.add('active');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            });
    });
            
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