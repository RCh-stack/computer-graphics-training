const AUTH_PAGE_URL = '/frontend/authorization/index.html';

const AUTH_ERROR_CODES = new Set([
    'TOKEN_EXPIRED',
    'INVALID_TOKEN',
    'TOKEN_MISSING',
    'ACCOUNT_DISABLED',
    'ROLE_CHANGED',
    'TWO_FACTOR_REQUIRED',
]);

let isLoggingOut = false;

function isAuthPage() {
    const path = window.location.pathname.toLowerCase();
    return path.includes('/authorization/') || path.includes('/auth/');
}

function isJwtExpired(token) {
    try {
        const payloadPart = token.split('.')[1];
        if (!payloadPart) return true;
        const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
        const payload = JSON.parse(atob(padded));
        return !payload.exp || Date.now() >= payload.exp * 1000;
    } catch {
        return true;
    }
}

function forceLogout(reasonMessage = null) {
    if (isLoggingOut) return;
    isLoggingOut = true;

    localStorage.removeItem('authToken');
    localStorage.removeItem('user');

    if (isAuthPage()) return;

    if (reasonMessage && typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Сессия завершена',
            text: reasonMessage,
            icon: 'info',
            confirmButtonText: 'Войти заново',
            confirmButtonColor: '#ec4899',
            allowOutsideClick: false,
        }).then(() => {
            window.location.href = AUTH_PAGE_URL;
        });
    } else {
        window.location.href = AUTH_PAGE_URL;
    }
}

// 1. Мгновенная проверка при открытии защищённой страницы
(function enforceAuthOnPageLoad() {
    if (isAuthPage()) return;

    const token = localStorage.getItem('authToken');
    const userRaw = localStorage.getItem('user');

    if (!token || !userRaw || isJwtExpired(token)) {
        forceLogout();
    }
})();

// 2. Глобальный перехват ответов 401 от API
const nativeFetch = window.fetch;
window.fetch = async (...args) => {
    const response = await nativeFetch(...args);

    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const isPublicAuthRequest =
        url.includes('/api/v1/auth/login') ||
        url.includes('/api/v1/auth/2fa/verify') ||
        url.includes('/api/v1/auth/register') ||
        url.includes('/api/v1/auth/request-reset') ||
        url.includes('/api/v1/auth/reset-password');

    if (response.status === 401 && !isPublicAuthRequest) {
        let message = 'Срок действия сессии истек. Войдите заново.';
        try {
            const data = await response.clone().json();
            const errorCode = data.code || data.status;
            if (data.message) message = data.message;

            if (AUTH_ERROR_CODES.has(errorCode)) {
                forceLogout(message);
                return response;
            }
        } catch {
            // Если тело ответа не JSON, всё равно сбрасываем сессию
        }

        forceLogout(message);
    }

    return response;
};

document.addEventListener('DOMContentLoaded', () => {
    if (!isAuthPage()) {
        checkUserRoleAndSetupUI();
    }
});

async function checkUserRoleAndSetupUI() {
    const token = localStorage.getItem('authToken');
    const userRaw = localStorage.getItem('user');

    if (!token || !userRaw) {
        forceLogout();
        return;
    }

    const localUser = JSON.parse(userRaw);

    try {
        const res = await fetch('/api/v1/users/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401) {
            return; // Обработается глобальным перехватчиком fetch
        }

        const data = await res.json();

        if (res.ok && data.user) {
            if (data.user.role !== localUser.role) {
                forceLogout('Ваш уровень доступа был изменен администратором. Выполните повторный вход.');
                return;
            }

            localUser.firstName = data.user.first_name;
            localUser.lastName = data.user.last_name;
            localStorage.setItem('user', JSON.stringify(localUser));
        }
    } catch (error) {
        console.error('Ошибка верификации пользователя:', error);
    }

    const userNameEl = document.getElementById('user-name');
    const userRoleEl = document.getElementById('user-role');
    const userEmailEl = document.getElementById('dropdown-user-email');
    const userAvatarEl = document.getElementById('user-avatar');

    const displayName = localUser.firstName || localUser.email.split('@')[0];
    if (userNameEl) userNameEl.textContent = displayName;
    if (userRoleEl) userRoleEl.textContent = localUser.role || 'Студент';
    if (userEmailEl) userEmailEl.textContent = localUser.email;
    if (userAvatarEl) userAvatarEl.textContent = displayName.charAt(0).toUpperCase();

    const profileBtn = document.getElementById('profile-menu-btn');
    const profileDropdown = document.getElementById('profile-dropdown');

    profileBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown?.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
        profileDropdown?.classList.add('hidden');
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => {
        forceLogout();
    });

    if (localUser.role === 'TEACHER' || localUser.role === 'ADMIN') {
        setupAdminModeToggle();
    }
}

function setupAdminModeToggle() {
    const selector = document.getElementById('view-mode-selector');
    const btnStudent = document.getElementById('btn-mode-student');
    const btnAdmin = document.getElementById('btn-mode-admin');

    const studentGrid = document.getElementById('student-modules-grid');
    const adminGrid = document.getElementById('admin-modules-grid');

    if (!selector || !btnStudent || !btnAdmin || !studentGrid || !adminGrid) return;

    selector.classList.remove('hidden');

    const activeBtnClass = 'px-4 py-1.5 rounded-lg text-xs font-semibold transition bg-pink-600 text-white shadow-md';
    const inactiveBtnClass = 'px-4 py-1.5 rounded-lg text-xs font-semibold transition text-gray-400 hover:text-[var(--text-main)]';

    btnStudent.addEventListener('click', () => {
        btnStudent.className = activeBtnClass;
        btnAdmin.className = inactiveBtnClass;

        studentGrid.classList.remove('hidden');
        adminGrid.classList.add('hidden');
    });

    btnAdmin.addEventListener('click', () => {
        btnAdmin.className = activeBtnClass;
        btnStudent.className = inactiveBtnClass;

        adminGrid.classList.remove('hidden');
        studentGrid.classList.add('hidden');
    });
}