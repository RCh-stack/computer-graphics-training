document.addEventListener('DOMContentLoaded', () => {
    checkUserRoleAndSetupUI();
});

function checkUserRoleAndSetupUI() {
    const token = localStorage.getItem('authToken');
    const userRaw = localStorage.getItem('user');

    if (!token || !userRaw) {
        window.location.href = '/frontend/authorization/index.html';
        return;
    }

    const user = JSON.parse(userRaw);

    const userNameEl = document.getElementById('user-name');
    const userRoleEl = document.getElementById('user-role');
    const userEmailEl = document.getElementById('dropdown-user-email');
    const userAvatarEl = document.getElementById('user-avatar');

    const displayName = user.firstName || user.email.split('@')[0];
    userNameEl.textContent = displayName;
    userRoleEl.textContent = user.role || 'Студент';
    userEmailEl.textContent = user.email;
    userAvatarEl.textContent = displayName.charAt(0).toUpperCase();

    const profileBtn = document.getElementById('profile-menu-btn');
    const profileDropdown = document.getElementById('profile-dropdown');

    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
        profileDropdown.classList.add('hidden');
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/frontend/authorization/index.html';
    });

    if (user.role === 'TEACHER' || user.role === 'ADMIN')
        setupAdminModeToggle();
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