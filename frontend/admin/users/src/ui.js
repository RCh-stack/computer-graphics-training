document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    loadPendingStudents();
    loadGroups();
});

let cachedGroups = [];

function initEvents() {
    
    document.getElementById('tab-btn-pending')?.addEventListener('click', () => switchAdminTab('pending'));
    document.getElementById('tab-btn-groups')?.addEventListener('click', () => switchAdminTab('groups'));
    document.getElementById('tab-btn-teachers')?.addEventListener('click', () => switchAdminTab('teachers'));

    document.getElementById('btn-create-group')?.addEventListener('click', openCreateGroupModal);

    document.getElementById('group-select')?.addEventListener('change', (e) => {
        loadGroupStudents(e.target.value);
    });

    document.getElementById('pending-table-body')?.addEventListener('click', (e) => {
        const approveBtn = e.target.closest('.btn-approve-student');
        if (approveBtn) {
            const userId = approveBtn.dataset.userId;
            approveStudent(userId);
        }
    });

    document.getElementById('students-table-body')?.addEventListener('click', (e) => {
        const roleBtn = e.target.closest('.btn-change-role');
        if (roleBtn) {
            const { userId, userRole, userName } = roleBtn.dataset;
            changeUserRole(userId, userRole, userName);
        }
    });

    document.getElementById('teachers-table-body')?.addEventListener('click', (e) => {
        const demoteBtn = e.target.closest('.btn-demote-teacher');
        if (demoteBtn) {
            const { userId, userName } = demoteBtn.dataset;
            changeUserRole(userId, 'TEACHER', userName);
        }
    });
}

function switchAdminTab(tabName) {

    document.getElementById('tab-pending').classList.add('hidden');
    document.getElementById('tab-groups').classList.add('hidden');
    document.getElementById('tab-teachers').classList.add('hidden');

    document.getElementById('tab-btn-pending').className = 'py-3 font-medium text-[var(--text-main)] hover:text-white transition flex items-center gap-2';
    document.getElementById('tab-btn-groups').className = 'py-3 font-medium text-[var(--text-main)] hover:text-white transition flex items-center gap-2';
    document.getElementById('tab-btn-teachers').className = 'py-3 font-medium text-[var(--text-main)] hover:text-white transition flex items-center gap-2';

    if (tabName === 'pending') {
        document.getElementById('tab-pending').classList.remove('hidden');
        document.getElementById('tab-btn-pending').className = 'py-3 font-semibold text-pink-400 border-b-2 border-pink-500 transition flex items-center gap-2';
        loadPendingStudents();
    } else if (tabName === 'groups') {
        document.getElementById('tab-groups').classList.remove('hidden');
        document.getElementById('tab-btn-groups').className = 'py-3 font-semibold text-pink-400 border-b-2 border-pink-500 transition flex items-center gap-2';
        loadGroupStudents();
    } else if (tabName === 'teachers') {
        document.getElementById('tab-teachers').classList.remove('hidden');
        document.getElementById('tab-btn-teachers').className = 'py-3 font-semibold text-pink-400 border-b-2 border-pink-500 transition flex items-center gap-2';
        loadTeachers();
    }
}

async function loadPendingStudents() {

    const token = localStorage.getItem('authToken');

    const response = await fetch(`/api/v1/admin/users/pending-students`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        }
    });

    if (!response.ok) throw new Error('Не удалось загрузить список неподтвержденных заявок');

    const data = await response.json();
    if (data.status !== 'success') return;

    cachedGroups = data.groups || [];
    const tbody = document.getElementById('pending-table-body');
    const badge = document.getElementById('pending-badge');
    
    if (badge) badge.innerText = data.students.length;

    if (data.students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center text-[var(--text-main)]">
                    <i class="fa-solid fa-circle-check text-emerald-400 text-xl mb-2"></i>
                    <p>Нет новых заявок на регистрацию</p>
                </td>
            </tr>`;
        return;
    }

    const groupOptionsHtml = cachedGroups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

    tbody.innerHTML = data.students.map(student => {
        const regDate = new Date(student.created_at).toLocaleDateString('ru-RU');

        return `
            <tr class="hover:bg-gray-800/30 transition">
                <td class="py-3.5 px-4 font-semibold text-gray-200">
                    ${student.first_name || ''} ${student.last_name || ''}
                </td>
                <td class="py-3.5 px-4 text-[var(--text-main)] font-mono text-xs">${student.email}</td>
                <td class="py-3.5 px-4 text-[var(--text-main)]">${regDate}</td>
                <td class="py-3.5 px-4 text-center">
                    <select id="group-select-${student.id}" class="bg-[var(--bg-panel)] border border-gray-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-pink-500">
                        <option value="">Без группы</option>
                        ${groupOptionsHtml}
                    </select>
                </td>
                <td class="py-3.5 px-4 text-right">
                    <button onclick="approveStudent('${student.id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition">
                        Одобрить
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function approveStudent(userId) {

    const select = document.getElementById(`group-select-${userId}`);
    const groupId = select ? select.value : null;

    const token = localStorage.getItem('authToken');

    const response = await fetch(`/api/v1/admin/users/approve`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ userId, groupId })
    });

    if (response.ok) {
        Swal.fire({ title: 'Успешно', text: 'Доступ студенту предоставлен', icon: 'success', confirmButtonColor: '#10b981', timer: 1500 });
        loadPendingStudents();
    }
}

async function openCreateGroupModal() {
    
    const { value: groupName } = await Swal.fire({
        title: 'Новая академическая группа',
        input: 'text',
        inputLabel: 'Название группы (например, ВТ-21)',
        placeholder: 'Введите название...',
        showCancelButton: true,
        confirmButtonText: 'Создать',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#ec4899',
        inputValidator: (value) => {
            if (!value) return 'Название группы не может быть пустым!';
        }
    });

    if (groupName) {
        const token = localStorage.getItem('authToken');

        const response = await fetch(`/api/v1/admin/users/groups`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ name: groupName })
        });

        if (response.ok) {
            Swal.fire('Успешно!', `Группа "${groupName}" создана`, 'success');
            loadGroups();
        }
    }
}

async function loadGroups() {

    const token = localStorage.getItem('authToken');

    const response = await fetch(`/api/v1/admin/users/groups`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        }
    });

    if (!response.ok) throw new Error('Не удалось загрузить список групп');

    const data = await response.json();
    if (data.status === 'success') {
        const select = document.getElementById('group-select');
        if (!select) return;

        select.innerHTML = `<option value="all">Все группы</option><option value="unassigned">Без группы</option>` +
            data.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    }
}

async function loadGroupStudents(groupId = 'all') {

    const token = localStorage.getItem('authToken');

    const response = await fetch(`/api/v1/admin/users/students?groupId=${groupId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        }
    });

    if (!response.ok) throw new Error('Не удалось загрузить список студентов');

    const data = await response.json();
    const tbody = document.getElementById('students-table-body');

    if (!data.students || data.students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-[var(--text-main)]">Студенты не найдены</td></tr>`;
        return;
    }

    tbody.innerHTML = data.students.map(s => {
        const fullName = `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Без имени';
        const isTeacher = s.role === 'TEACHER';

        const roleBadge = isTeacher 
            ? `<span class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-pink-500/10 text-pink-400 border border-pink-500/20"><i class="fa-solid fa-user-shield mr-1"></i> Преподаватель</span>`
            : `<span class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-800 text-gray-400 border border-gray-700"><i class="fa-solid fa-user-graduate mr-1"></i> Студент</span>`;

        return `
            <tr class="hover:bg-gray-800/30 transition">
                <td class="py-3.5 px-4 font-semibold text-[var(--text-main)]">${fullName}</td>
                <td class="py-3.5 px-4"><span class="px-2 py-0.5 rounded bg-gray-400 border border-gray-400 text-xs">${s.group_name || '—'}</span></td>
                <td class="py-3.5 px-4 text-[var(--text-main)] font-mono text-xs">${s.email}</td>
                <td class="py-3.5 px-4 text-center">${roleBadge}</td>
                <td class="py-3.5 px-4 text-right">
                    <button data-user-id="${s.id}" data-user-role="${s.role}" data-user-name="${fullName}" 
                            class="btn-change-role text-xs text-pink-400 hover:text-pink-300 hover:underline transition font-medium">
                        Изменить роль
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadTeachers() {
    
    const token = localStorage.getItem('authToken');

    const response = await fetch(`/api/v1/admin/users/teachers`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        }
    });

    if (!response.ok) throw new Error('Не удалось загрузить список преподавателей');

    const data = await response.json();
    const tbody = document.getElementById('teachers-table-body');

    if (!data.teachers || data.teachers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-[var(--text-main)]">Преподаватели не найдены</td></tr>`;
        return;
    }

    tbody.innerHTML = data.teachers.map(t => {
        const fullName = `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Без имени';
        const regDate = new Date(t.created_at).toLocaleDateString('ru-RU');

        return `
            <tr class="hover:bg-gray-800/30 transition">
                <td class="py-3.5 px-4 font-semibold text-[var(--text-main)] flex items-center gap-2">
                    <div class="w-7 h-7 rounded-lg bg-pink-500/20 text-pink-400 text-xs font-bold flex items-center justify-center border border-pink-500/30">
                        ${fullName.charAt(0).toUpperCase()}
                    </div>
                    <span>${fullName}</span>
                </td>
                <td class="py-3.5 px-4 text-[var(--text-main)] font-mono text-xs">${t.email}</td>
                <td class="py-3.5 px-4 text-[var(--text-main)]">${regDate}</td>
                <td class="py-3.5 px-4 text-right">
                    <button data-user-id="${t.id}" data-user-name="${fullName}" 
                            class="btn-demote-teacher px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium transition">
                        Снять права
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function changeUserRole(userId, currentRole, userName) {

    const newRole = currentRole === 'TEACHER' ? 'STUDENT' : 'TEACHER';
    const roleTitle = newRole === 'TEACHER' ? 'Преподаватель' : 'Студент';

    const result = await Swal.fire({
        title: 'Изменение роли',
        html: `Вы уверены, что хотите назначить пользователю <b>${userName}</b> роль <b class="text-pink-400">${roleTitle}</b>?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Да, изменить',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#ec4899'
    });

    if (result.isConfirmed) {
        const token = localStorage.getItem('authToken');

        const response = await fetch(`/api/v1/admin/users/role`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ userId: userId, role: newRole })
        });

        if (response.ok) {
            Swal.fire({ title: 'Успешно!', text: 'Роль пользователя обновлена', icon: 'success', confirmButtonColor: '#10b981', timer: 1500 });
            
            const currentGroup = document.getElementById('group-select')?.value || 'all';
            loadGroupStudents(currentGroup);
            loadTeachers();
        }
    }
}