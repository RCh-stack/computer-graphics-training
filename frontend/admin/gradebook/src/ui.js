document.addEventListener('DOMContentLoaded', () => {
    initGradebookTabs();
    initGroupsFilter();
    loadGradebookData();
});

window.reloadGradebookData = function() {
    loadGradebookData();
};

window.currentSubmissionsMap = new Map();
window.currentTestSubmissionsMap = new Map();

function initGradebookTabs() {
    const btnLabs = document.getElementById('tab-btn-labs');
    const btnTests = document.getElementById('tab-btn-tests');
    const secLabs = document.getElementById('section-labs-gradebook');
    const secTests = document.getElementById('section-tests-gradebook');

    btnLabs?.addEventListener('click', () => {
        btnLabs.className = 'px-4 py-2.5 text-xs font-bold border-b-2 border-emerald-500 text-emerald-400 flex items-center gap-2';
        btnTests.className = 'px-4 py-2.5 text-xs font-semibold border-b-2 border-transparent text-[var(--text-main)] hover:text-[var(--text-main)] flex items-center gap-2';
        secLabs?.classList.remove('hidden');
        secTests?.classList.add('hidden');
    });

    btnTests?.addEventListener('click', () => {
        btnTests.className = 'px-4 py-2.5 text-xs font-bold border-b-2 border-amber-500 text-amber-400 flex items-center gap-2';
        btnLabs.className = 'px-4 py-2.5 text-xs font-semibold border-b-2 border-transparent text-[var(--text-main)] hover:text-[var(--text-main)] flex items-center gap-2';
        secTests?.classList.remove('hidden');
        secLabs?.classList.add('hidden');
    });
}

async function initGroupsFilter() {
    const token = localStorage.getItem('authToken');
    const select = document.getElementById('gradebook-group-select');
    if (!select) return;

    try {
        const res = await fetch('/api/v1/admin/users/groups', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.status === 'success' && Array.isArray(data.groups)) {
            select.innerHTML = `<option value="">Все группы</option>` + 
                data.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

            select.addEventListener('change', () => loadGradebookData());
        }
    } catch (err) {
        console.error('Ошибка загрузки групп:', err);
    }
}

async function loadGradebookData() {
    const token = localStorage.getItem('authToken');
    const groupId = document.getElementById('gradebook-group-select')?.value || '';

    try {
        const [labsRes, labSubsRes, testsRes, testSubsRes] = await Promise.all([
            fetch('/api/v1/admin/labs', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`/api/v1/admin/submissions/labs?groupId=${groupId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/api/v1/admin/tests', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`/api/v1/admin/submissions/tests?groupId=${groupId}`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        const labsData = await labsRes.json();
        const labSubsData = await labSubsRes.json();
        const testsData = await testsRes.json();
        const testSubsData = await testSubsRes.json();

        const labs = labsData.labs || [];
        const labSubmissions = labSubsData.submissions || [];
        const tests = testsData.tests || [];
        const testSubmissions = testSubsData.submissions || [];

        window.currentSubmissionsMap.clear();
        labSubmissions.forEach(sub => {
            window.currentSubmissionsMap.set(`${sub.user_id}_${sub.lab_id}`, sub);
        });

        window.currentTestSubmissionsMap.clear();
        testSubmissions.forEach(sub => {
            window.currentTestSubmissionsMap.set(`${sub.user_id}_${sub.test_id}`, sub);
        });

        const studentsMap = new Map();
        [...labSubmissions, ...testSubmissions].forEach(sub => {
            if (!studentsMap.has(sub.user_id)) {
                studentsMap.set(sub.user_id, {
                    id: sub.user_id,
                    name: `${sub.first_name || ''} ${sub.last_name || ''}`.trim() || sub.email,
                    email: sub.email,
                    groupName: sub.group_name || '—'
                });
            }
        });

        const students = Array.from(studentsMap.values());

        renderLabsGradebook(students, labs);
        renderTestsGradebook(students, tests);

    } catch (error) {
        console.error('Ошибка загрузки данных ведомости:', error);
    }
}

function renderLabsGradebook(students, labs) {
    const thead = document.getElementById('labs-thead');
    const tbody = document.getElementById('labs-tbody');

    if (!thead || !tbody) return;

    thead.innerHTML = `
        <tr>
            <th class="p-3 border-b border-gray-500">Студент</th>
            <th class="p-3 border-b border-gray-500">Группа</th>
            ${labs.map(l => `<th class="p-3 border-b border-gray-500 text-center" title="${l.title}">Лаб №${l.order || l.id}</th>`).join('')}
        </tr>
    `;

    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${labs.length + 2}" class="p-8 text-center text-[var(--text-main)]">Отправленные лабораторные работы отсутствуют</td></tr>`;
        return;
    }

    tbody.innerHTML = students.map(st => {
        const labCells = labs.map(l => {
            const key = `${st.id}_${l.id}`;
            const sub = window.currentSubmissionsMap.get(key);

            if (!sub) {
                return `<td class="p-3 text-center text-[var(--text-main)]">—</td>`;
            }

            let badgeStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20';

            if (sub.status === 'PASSED') {
                badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20';
            } else if (sub.status === 'REVISION') {
                badgeStyle = 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20';
            } else if (sub.status === 'REJECTED') {
                badgeStyle = 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20';
            }

            return `
                <td class="p-3 text-center">
                    <button type="button" 
                        data-submission-id="${sub.id}" 
                        class="btn-open-review px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${badgeStyle} transition shadow-sm inline-flex items-center gap-1 cursor-pointer">
                        <span>${sub.status}</span>
                        <i class="fa-solid fa-pen text-[9px] opacity-70"></i>
                    </button>
                </td>
            `;
        }).join('');

        return `
            <tr class="border-b border-gray-300/30 hover:bg-gray-300/30 transition">
                <td class="p-3 font-semibold text-[var(--text-main)]">
                    ${st.name}
                    <div class="text-[10px] font-normal text-[var(--text-main)]">${st.email}</div>
                </td>
                <td class="p-3 text-[var(--text-main)] font-medium">${st.groupName}</td>
                ${labCells}
            </tr>
        `;
    }).join('');
}

function renderTestsGradebook(students, tests) {
    const thead = document.getElementById('tests-thead');
    const tbody = document.getElementById('tests-tbody');
    if (!thead || !tbody) return;

    thead.innerHTML = `
        <tr>
            <th class="p-3 border-b border-gray-500">Студент</th>
            <th class="p-3 border-b border-gray-500">Группа</th>
            ${tests.map(t => `<th class="p-3 border-b border-gray-500 text-center" title="${t.title}">Тест №${t.order || t.id}</th>`).join('')}
        </tr>
    `;

    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${tests.length + 2}" class="p-8 text-center text-[var(--text-main)]">Пройденные тесты отсутствуют</td></tr>`;
        return;
    }

    tbody.innerHTML = students.map(st => {
        const testCells = tests.map(t => {
            const key = `${st.id}_${t.id}`;
            const sub = window.currentTestSubmissionsMap.get(key);

            if (!sub) {
                return `<td class="p-3 text-center text-[var(--text-main)]">—</td>`;
            }

            const score = sub.score_percent || 0;
            let badgeStyle = 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20';

            if (score >= 80) {
                badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20';
            } else if (score >= 50) {
                badgeStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20';
            }

            return `
                <td class="p-3 text-center">
                    <button type="button" 
                        data-test-submission-id="${sub.id}" 
                        class="btn-open-test-review px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${badgeStyle} transition shadow-sm inline-flex items-center gap-1 cursor-pointer">
                        <span>${score}%</span>
                        <i class="fa-solid fa-eye text-[9px] opacity-70"></i>
                    </button>
                </td>
            `;
        }).join('');

        return `
            <tr class="border-b border-gray-300/30 hover:bg-gray-300/30 transition">
                <td class="p-3 font-semibold text-[var(--text-main)]">
                    ${st.name}
                    <div class="text-[10px] font-normal text-[var(--text-main)]">${st.email}</div>
                </td>
                <td class="p-3 text-[var(--text-main)] font-medium">${st.groupName}</td>
                ${testCells}
            </tr>
        `;
    }).join('');
}