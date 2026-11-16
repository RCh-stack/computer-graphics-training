document.addEventListener('DOMContentLoaded', () => {
    initGradebookTabs();
    initGroupsFilter();
    loadGradebookData();
    initExportToExcel();
    initLiveSearch();
});

window.reloadGradebookData = function() {
    loadGradebookData();
};

window.currentSubmissionsMap = new Map();
window.currentTestSubmissionsMap = new Map();

function initGradebookTabs() {
    const btnTheory = document.getElementById('tab-btn-theory');
    const btnLabs = document.getElementById('tab-btn-labs');
    const btnTests = document.getElementById('tab-btn-tests');

    const secTheory = document.getElementById('section-theory-gradebook');
    const secLabs = document.getElementById('section-labs-gradebook');
    const secTests = document.getElementById('section-tests-gradebook');

    const activeClass = 'px-4 py-2.5 text-xs font-bold border-b-2 text-emerald-400 border-emerald-500 flex items-center gap-2';
    const activeTestClass = 'px-4 py-2.5 text-xs font-bold border-b-2 text-amber-500 border-amber-500 flex items-center gap-2';
    const activeTheoryClass = 'px-4 py-2.5 text-xs font-bold border-b-2 text-blue-400 border-blue-500 flex items-center gap-2';
    const inactiveClass = 'px-4 py-2.5 text-xs font-semibold border-b-2 border-transparent text-[var(--text-main)] hover:text-[var(--text-main)] flex items-center gap-2';

    btnLabs?.addEventListener('click', () => {
        btnLabs.className = activeClass;
        btnTests.className = inactiveClass;
        btnTheory.className = inactiveClass;

        secLabs?.classList.remove('hidden');
        secTests?.classList.add('hidden');
        secTheory?.classList.add('hidden');
        applyLiveSearchFilter();
    });

    btnTests?.addEventListener('click', () => {
        btnTests.className = activeTestClass;
        btnLabs.className = inactiveClass;
        btnTheory.className = inactiveClass;

        secTests?.classList.remove('hidden');
        secLabs?.classList.add('hidden');
        secTheory?.classList.add('hidden');
        applyLiveSearchFilter();
    });

    btnTheory?.addEventListener('click', () => {
        btnTheory.className = activeTheoryClass;
        btnLabs.className = inactiveClass;
        btnTests.className = inactiveClass;

        secTheory?.classList.remove('hidden');
        secLabs?.classList.add('hidden');
        secTests?.classList.add('hidden');
        applyLiveSearchFilter();
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
        window.Toast?.error('Не удалось загрузить список учебных групп');
    }
}

function renderGradebookSkeletons() {
    if (!window.Skeleton) return;

    const pairs = [
        { thead: 'theory-thead', tbody: 'theory-tbody' },
        { thead: 'labs-thead', tbody: 'labs-tbody' },
        { thead: 'tests-thead', tbody: 'tests-tbody' }
    ];

    pairs.forEach(({ thead, tbody }) => {
        const theadEl = document.getElementById(thead);
        const existingCols = theadEl ? theadEl.querySelectorAll('th').length : 0;
        const dynamicCols = existingCols > 2 ? existingCols - 2 : 4;

        if (theadEl && existingCols === 0) {
            theadEl.innerHTML = `
                <tr>
                    <th class="p-3 border-b border-[var(--border-color)]">Студент</th>
                    <th class="p-3 border-b border-[var(--border-color)]">Группа</th>
                    ${Array.from({ length: dynamicCols }, () => `
                        <th class="p-3 border-b border-[var(--border-color)] text-center">
                            <span aria-hidden="true" class="inline-block h-3.5 w-14 rounded bg-gray-500/20 animate-pulse"></span>
                        </th>
                    `).join('')}
                </tr>
            `;
        }

        Skeleton.render(`#${tbody}`, Skeleton.gradebookRows(5, dynamicCols));
    });
}

async function loadGradebookData() {
    const token = localStorage.getItem('authToken');
    const groupSelect = document.getElementById('gradebook-group-select');
    const groupId = groupSelect?.value || '';

    if (groupSelect) groupSelect.disabled = true;
    renderGradebookSkeletons();

    try {
        const [labsRes, labSubsRes, testsRes, testSubsRes, theoryRes] = await Promise.all([
            fetch('/api/v1/admin/labs', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`/api/v1/admin/submissions/labs?groupId=${groupId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/api/v1/admin/tests', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`/api/v1/admin/submissions/tests?groupId=${groupId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`/api/v1/admin/submissions/ebook?groupId=${groupId}`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (!labsRes.ok || !labSubsRes.ok || !testsRes.ok || !testSubsRes.ok || !theoryRes.ok) {
            throw new Error('Ошибка получения данных ведомости с сервера');
        }

        const labsData = await labsRes.json();
        const labSubsData = await labSubsRes.json();
        const testsData = await testsRes.json();
        const testSubsData = await testSubsRes.json();
        const theoryData = await theoryRes.json();

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

        renderTheoryGradebook(theoryData.chapters || [], theoryData.rows || []);
        renderLabsGradebook(students, labs);
        renderTestsGradebook(students, tests);
        applyLiveSearchFilter();

    } catch (error) {
        console.error('Ошибка загрузки данных ведомости:', error);

        ['theory-tbody', 'labs-tbody', 'tests-tbody'].forEach(tbodyId => {
            const tbody = document.getElementById(tbodyId);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-rose-400 text-xs">Не удалось загрузить данные ведомости. Проверьте соединение с сервером.</td></tr>`;
            }
        });

        window.Toast?.error('Ошибка загрузки', 'Не удалось обновить данные ведомости');
    } finally {
        if (groupSelect) groupSelect.disabled = false;
    }
}

function renderTheoryGradebook(chapters, rows) {
    const thead = document.getElementById('theory-thead');
    const tbody = document.getElementById('theory-tbody');

    if (!thead || !tbody) return;

    thead.innerHTML = `
        <tr>
            <th class="p-3 border-b border-[var(--border-color)]">Студент</th>
            <th class="p-3 border-b border-[var(--border-color)]">Группа</th>
            ${chapters.map(ch => `<th class="p-3 border-b border-[var(--border-color)] text-center" title="${ch.title}">Глава №${ch.order || ch.id}</th>`).join('')}
        </tr>
    `;

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${chapters.length + 2}" class="p-8 text-center text-[var(--text-main)]">Данные освоения теории отсутствуют</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(r => {
        const chapterCells = chapters.map(ch => {
            const chData = r.chapters[ch.id] || { percent: 0, completed: 0, total: 0 };
            const percent = chData.percent;

            let badgeStyle = 'bg-[var(--bg-panel)] text-[var(--text-main)] border-[var(--border-color)]';
            if (percent === 100) {
                badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
            } else if (percent > 0) {
                badgeStyle = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
            }

            return `
                <td class="p-3 text-center">
                    <span class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${badgeStyle} inline-block" title="Пройдено ${chData.completed} из ${chData.total} уроков">
                        ${percent}%
                    </span>
                </td>
            `;
        }).join('');

        return `
            <tr class="border-b border-[var(--border-color)] hover:bg-[var(--bg-panel)] transition">
                <td class="p-3 font-semibold text-[var(--text-main)]">
                    ${r.name}
                    <div class="text-[10px] font-normal text-[var(--text-main)]">${r.email}</div>
                </td>
                <td class="p-3 text-[var(--text-main)] font-medium">${r.groupName}</td>
                ${chapterCells}
            </tr>
        `;
    }).join('');
}

function renderLabsGradebook(students, labs) {
    const thead = document.getElementById('labs-thead');
    const tbody = document.getElementById('labs-tbody');

    if (!thead || !tbody) return;

    thead.innerHTML = `
        <tr>
            <th class="p-3 border-b border-[var(--border-color)]">Студент</th>
            <th class="p-3 border-b border-[var(--border-color)]">Группа</th>
            ${labs.map(l => `<th class="p-3 border-b border-[var(--border-color)] text-center" title="${l.title}">Лаб №${l.order || l.id}</th>`).join('')}
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

            let badgeStyle = '';

            if (sub.status === 'PASSED') {
                badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20';
            } else if (sub.status === 'REVISION') {
                badgeStyle = 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20';
            } else if (sub.status === 'REJECTED') {
                badgeStyle = 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20';
            } else if (sub.status === 'SUBMITTED') {
                badgeStyle = 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20';
            } else {
                badgeStyle = 'bg-[var(--bg-panel)] text-[var(--text-main)] border-[var(--border-color)] hover:bg-[var(--bg-panel)]';
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
            <tr class="border-b border-[var(--border-color)] hover:bg-[var(--bg-panel)] transition">
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
            <th class="p-3 border-b border-[var(--border-color)]">Студент</th>
            <th class="p-3 border-b border-[var(--border-color)]">Группа</th>
            ${tests.map(t => `<th class="p-3 border-b border-[var(--border-color)] text-center" title="${t.title}">Тест №${t.order || t.id}</th>`).join('')}
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
                badgeStyle = 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20';
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
            <tr class="border-b border-[var(--border-color)] hover:bg-[var(--bg-panel)] transition">
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

function applyLiveSearchFilter() {
    const searchInput = document.getElementById('gradebook-search-input');
    const query = (searchInput?.value || '').toLowerCase().trim();
    const activeTbody = document.querySelector(
        '#section-theory-gradebook:not(.hidden) tbody, #section-labs-gradebook:not(.hidden) tbody, #section-tests-gradebook:not(.hidden) tbody'
    );
    if (!activeTbody) return;

    activeTbody.querySelectorAll('tr').forEach(row => {
        if (row.getAttribute('aria-hidden') === 'true') return;

        const cells = row.querySelectorAll('td');
        if (cells.length <= 1) return;

        const studentText = cells[0]?.innerText.toLowerCase() || '';
        if (!query || studentText.includes(query)) {
            row.classList.remove('hidden');
        } else {
            row.classList.add('hidden');
        }
    });
}

function initLiveSearch() {
    const searchInput = document.getElementById('gradebook-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', applyLiveSearchFilter);
}

function initExportToExcel() {
    const btnExport = document.getElementById('btn-export-excel');
    if (!btnExport) return;

    btnExport.addEventListener('click', () => {
        const isTheoryActive = !document.getElementById('section-theory-gradebook')?.classList.contains('hidden');
        const isLabsActive = !document.getElementById('section-labs-gradebook')?.classList.contains('hidden');

        let targetTableId = '';
        let tbodyId = '';
        let sheetName = '';

        if (isTheoryActive) {
            targetTableId = 'theory-thead';
            tbodyId = 'theory-tbody';
            sheetName = 'Теория';
        } else if (isLabsActive) {
            targetTableId = 'labs-thead';
            tbodyId = 'labs-tbody';
            sheetName = 'Лабораторные работы';
        } else {
            targetTableId = 'tests-thead';
            tbodyId = 'tests-tbody';
            sheetName = 'Тестирование';
        }

        const thead = document.getElementById(targetTableId);
        const tbody = document.getElementById(tbodyId);

        if (!thead || !tbody) return;

        const headers = [];
        thead.querySelectorAll('th').forEach(th => {
            headers.push(th.innerText.trim());
        });

        const rowsData = [];
        tbody.querySelectorAll('tr').forEach(tr => {
            if (tr.classList.contains('hidden') || tr.getAttribute('aria-hidden') === 'true') return;

            const cells = tr.querySelectorAll('td');
            if (cells.length <= 1) return;

            const row = [];
            cells.forEach(td => {
                row.push(td.innerText.replace(/\s+/g, ' ').trim());
            });
            if (row.length > 0) rowsData.push(row);
        });

        if (rowsData.length === 0) {
            Toast.info('Нет данных для экспорта');
            return;
        }

        const worksheetData = [headers, ...rowsData];
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

        const colWidths = headers.map(h => ({ wch: Math.max(h.length + 5, 15) }));
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        const groupName = document.getElementById('gradebook-group-select')?.selectedOptions[0]?.text || 'Все группы';
        const dateStr = new Date().toISOString().slice(0, 10);
        const fileName = `Ведомость_${sheetName}_${groupName}_${dateStr}.xlsx`;

        XLSX.writeFile(workbook, fileName);
        Toast.success('Ведомость выгружена', fileName);
    });
}