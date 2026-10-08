document.addEventListener('DOMContentLoaded', checkTeacherAccess);

function checkTeacherAccess() {
    const rawUser = localStorage.getItem('user');
    if (!rawUser) return;

    try {
        const user = JSON.parse(rawUser);
        if (user.role === 'TEACHER' || user.role === 'ADMIN') {
            const adminMenuLink = document.getElementById('admin-menu-link');
            if (adminMenuLink) 
                adminMenuLink.classList.remove('hidden');

            const teacherCard = document.getElementById('admin-panel');
            if (teacherCard) {
                teacherCard.classList.remove('hidden');
                
                const grid = document.getElementById('modules-grid');
                if (grid) {
                    grid.classList.remove('lg:grid-cols-4');
                    grid.classList.add('lg:grid-cols-5');
                }
            }
        }
    } catch (error) {
        console.error('Ошибка проверки роли:', error);
    }
}