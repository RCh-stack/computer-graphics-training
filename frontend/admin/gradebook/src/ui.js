document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    initGradebook();
});

function initEvents() {
    const groupSelect = document.getElementById('gradebook-group-select');
    if (groupSelect) {
        groupSelect.addEventListener('change', (e) => {
            loadGradebook(e.target.value);
        });
    }
}

async function initGradebook() {

    const token = localStorage.getItem('authToken');
    
    const groupsRes = await fetch('/api/v1/admin/users/groups', {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const groupsData = await groupsRes.json();

    const select = document.getElementById('gradebook-group-select');
    if (groupsData.status === 'success' && select) {
        select.innerHTML = `<option value="all">Все студенты</option>` + 
            groupsData.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    }

    loadGradebook('all');
}


async function loadGradebook(groupId) {

    const token = localStorage.getItem('authToken');

    const res = await fetch(`/api/v1/admin/users/gradebook?groupId=${groupId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const result = await res.json();
    if (result.status !== 'success') return;

    const { labs, tests, rows } = result.data;
    const thead = document.getElementById('gradebook-thead');
    const tbody = document.getElementById('gradebook-tbody');

    let headerHtml = `
        <tr>
            <th class="py-3.5 px-4">Студент</th>
            <th class="py-3.5 px-4">Группа</th>
    `;

    labs.forEach(l => {
        headerHtml += `<th class="py-3.5 px-3 text-center text-emerald-600" title="${l.title}">Лаб: ${l.id}</th>`;
    });

    tests.forEach(t => {
        headerHtml += `<th class="py-3.5 px-3 text-center text-amber-400" title="${t.title}">Тест: ${t.id}</th>`;
    });

    headerHtml += `<th class="py-3.5 px-4 text-center text-red-600">Ср. балл</th></tr>`;
    thead.innerHTML = headerHtml;

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${3 + labs.length + tests.length}" class="py-8 text-center text-gray-400">Журнал пуст</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(r => {
        let rowHtml = `
            <tr class="hover:bg-gray-800/30 transition">
                <td class="py-3 px-4 font-semibold">${r.student_name}</td>
                <td class="py-3 px-4 text-[var(--text-main)] text-[11px]">${r.group_name || '—'}</td>
        `;

        labs.forEach(l => {
            const grade = r.labs[l.id];
            const badge = grade !== undefined 
                ? `<span class="px-2 py-1 rounded bg-emerald-600/10 text-emerald-600 font-mono font-bold">${grade}</span>`
                : `<span class="text-gray-600">—</span>`;
            rowHtml += `<td class="py-3 px-3 text-center">${badge}</td>`;
        });

        tests.forEach(t => {
            const score = r.tests[t.id];
            const badge = score !== undefined 
                ? `<span class="px-2 py-1 rounded bg-amber-500/10 text-amber-400 font-mono font-bold">${score}%</span>`
                : `<span class="text-gray-600">—</span>`;
            rowHtml += `<td class="py-3 px-3 text-center">${badge}</td>`;
        });

        rowHtml += `<td class="py-3 px-4 text-center font-bold font-mono text-red-600">${r.avg_grade}%</td></tr>`;
        return rowHtml;
    }).join('');
}