function launchModule(url) {
    window.location.href = url;
}

window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        window.location.reload();
    }
});

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
});

async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('authToken');
    
    options.headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
    };

    const response = await fetch(url, options);

    if (response.status === 401) {
        const data = await response.clone().json().catch(() => ({}));
        if (data.status === 'ROLE_CHANGED' || data.status === 'ACCOUNT_DISABLED') {
            if (typeof forceLogout === 'function') {
                forceLogout(data.message);
            } else {
                localStorage.clear();
                window.location.href = '/frontend/authorization/index.html';
            }
            throw new Error(data.message);
        }
    }

    return response;
}