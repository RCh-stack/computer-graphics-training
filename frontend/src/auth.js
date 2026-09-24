document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    const userRaw = localStorage.getItem('user');

    if (!token || !userRaw) {
        window.location.href = 'authorization/index.html';
        return;
    }

    const user = JSON.parse(userRaw);

    const userNameEl = document.getElementById('user-name');
    const userRoleEl = document.getElementById('user-role');
    const userEmailEl = document.getElementById('dropdown-user-email');
    const userAvatarEl = document.getElementById('user-avatar');

    const displayName = user.name || user.email.split('@')[0];
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
        window.location.href = 'authorization/index.html';
    });
});