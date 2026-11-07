document.addEventListener('DOMContentLoaded', () => {
    checkUserRoleAndSetupUI();
});

async function checkUserRoleAndSetupUI() {
    const token = localStorage.getItem('authToken');
    const userRaw = localStorage.getItem('user');

    if (!token || !userRaw) {
        window.location.href = '/frontend/authorization/index.html';
        return;
    }

    const localUser = JSON.parse(userRaw);

    try {
        const res = await fetch('/api/v1/users/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();

        if (res.status === 401) {
            const logoutStatuses = ['ROLE_CHANGED', 'ACCOUNT_DISABLED', 'TOKEN_EXPIRED', 'TOKEN_MISSING', 'INVALID_TOKEN'];
            if (logoutStatuses.includes(data.status)) {
                forceLogout(data.message || 'Ваша сессия завершена. Войдите заново.');
                return;
            }
        }

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

function forceLogout(reasonMessage = null) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');

    if (reasonMessage && typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Сессия завершена',
            text: reasonMessage,
            icon: 'info',
            confirmButtonText: 'Понятно',
            confirmButtonColor: '#ec4899'
        }).then(() => {
            window.location.href = '/frontend/authorization/index.html';
        });
    } else {
        window.location.href = '/frontend/authorization/index.html';
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