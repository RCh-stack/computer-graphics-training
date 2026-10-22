document.addEventListener('DOMContentLoaded', () => {
    initReviewModalEvents();
    initReviewClickDelegation();
    initTestReviewClickDelegation();
});

let activeSubmissionId = null;

function initReviewClickDelegation() {
    const labsTbody = document.getElementById('labs-tbody');
    if (!labsTbody) return;

    labsTbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-open-review');
        if (!btn) return;

        const subId = btn.dataset.submissionId;
        
        let targetSubmission = null;
        if (window.currentSubmissionsMap) {
            for (const sub of window.currentSubmissionsMap.values()) {
                if (sub.id === subId) {
                    targetSubmission = sub;
                    break;
                }
            }
        }

        if (targetSubmission) {
            openReviewModal(targetSubmission);
        }
    });
}

function openReviewModal(sub) {
    activeSubmissionId = sub.id;

    document.getElementById('review-student-name').innerText = `${sub.first_name || ''} ${sub.last_name || ''}`;
    document.getElementById('review-student-group').innerText = sub.group_name || 'БЕЗ ГРУППЫ';
    document.getElementById('review-lab-title').innerText = sub.lab_title || 'Лабораторная работа';
    document.getElementById('review-code-container').innerText = sub.submitted_code || '// Код отсутствует';
    document.getElementById('review-submitted-at').innerText = new Date(sub.submitted_at).toLocaleString('ru-RU');
    document.getElementById('review-tests-badge').innerText = sub.unit_tests_passed || '0/0';

    document.getElementById('review-status-select').value = sub.status || 'PASSED';
    document.getElementById('review-comment-input').value = sub.teacher_comment || '';

    let testDetails = sub.unit_tests_details;
    if (typeof testDetails === 'string') {
        try { testDetails = JSON.parse(testDetails); } catch { testDetails = []; }
    }
    renderTestDetailsList(Array.isArray(testDetails) ? testDetails : []);

    document.getElementById('review-modal')?.classList.remove('hidden');
}

function renderTestDetailsList(tests) {
    const container = document.getElementById('review-tests-list');
    if (!container) return;

    if (tests.length === 0) {
        container.innerHTML = `<div class="p-3 text-center text-[11px] text-[var(--text-main)] bg-gray-400 rounded-xl">Детализация юнит-тестов отсутствует</div>`;
        return;
    }

    container.innerHTML = tests.map((t, idx) => {
        const isPassed = t.passed || t.success;
        const icon = isPassed ? '✓' : '✕';
        const colorClass = isPassed ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 'text-red-400 border-red-500/20 bg-red-500/5';

        return `
            <div class="p-2 rounded-xl border ${colorClass} text-xs flex justify-between items-center">
                <span>${idx + 1}: ${t.name || 'Проверка условий'}</span>
                <span class="font-mono font-bold">${icon}</span>
            </div>
        `;
    }).join('');
}

function initReviewModalEvents() {
    const modal = document.getElementById('review-modal');
    const closeModal = () => modal?.classList.add('hidden');

    document.getElementById('btn-close-review-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-review')?.addEventListener('click', closeModal);

    document.getElementById('btn-save-review')?.addEventListener('click', async () => {
        if (!activeSubmissionId) return;

        const token = localStorage.getItem('authToken');
        const status = document.getElementById('review-status-select').value;
        const teacherComment = document.getElementById('review-comment-input').value;

        try {
            const res = await fetch(`/api/v1/admin/submissions/labs/${activeSubmissionId}/review`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status, teacherComment })
            });

            if (res.ok) {
                closeModal();
                
                if (typeof window.reloadGradebookData === 'function') {
                    window.reloadGradebookData();
                }

                Swal.fire({
                    title: 'Сохранено!',
                    text: 'Результат проверки сохранен и доступен студенту',
                    icon: 'success',
                    confirmButtonText: 'ОК',
                    confirmButtonColor: '#10b981'
                });
            }
        } catch (error) {
            console.error('Ошибка сохранения вердикта:', error);
        }
    });
}

function initTestReviewClickDelegation() {
    const testsTbody = document.getElementById('tests-tbody');
    if (!testsTbody) return;

    testsTbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-open-test-review');
        if (!btn) return;

        const subId = btn.dataset.testSubmissionId;
        
        let targetSubmission = null;
        if (window.currentTestSubmissionsMap) {
            for (const sub of window.currentTestSubmissionsMap.values()) {
                if (sub.id === subId) {
                    targetSubmission = sub;
                    break;
                }
            }
        }

        if (targetSubmission) {
            openTestReviewModal(targetSubmission);
        }
    });
}

function openTestReviewModal(sub) {
    document.getElementById('test-review-student-name').innerText = `${sub.first_name || ''} ${sub.last_name || ''}`;
    document.getElementById('test-review-group').innerText = sub.group_name || 'БЕЗ ГРУППЫ';
    document.getElementById('test-review-title').innerText = sub.test_title || 'Тест';
    document.getElementById('test-review-score').innerText = `${sub.score_percent || 0}%`;
    document.getElementById('test-review-date').innerText = new Date(sub.completed_at).toLocaleString('ru-RU');

    let userAnswersMeta = sub.user_answers;
    if (typeof userAnswersMeta === 'string') {
        try { userAnswersMeta = JSON.parse(userAnswersMeta); } catch { userAnswersMeta = {}; }
    }
    const durationSec = userAnswersMeta.timeSpentSeconds || userAnswersMeta.duration || 0;
    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    document.getElementById('test-review-duration').innerText = `${mins}м ${secs}с`;

    const questionsList = sub.questionsBreakdown || [];
    renderQuestionsBreakdown(questionsList);

    document.getElementById('test-review-modal')?.classList.remove('hidden');
}

function renderQuestionsBreakdown(questions) {
    const container = document.getElementById('test-questions-breakdown');
    if (!container) return;

    if (questions.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-xs text-[var(--text-main)] bg-gray-400 rounded-xl">Детализация вопросов недоступна</div>`;
        return;
    }

    container.innerHTML = questions.map((q, idx) => {
        const isCorrect = q.isCorrect;
        const statusBadge = isCorrect 
            ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Верно</span>`
            : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">Ошибка</span>`;

        return `
            <div class="p-3.5 bg-gray-400/40 border border-gray-400 rounded-xl space-y-2 text-xs">
                <div class="flex justify-between items-start gap-2">
                    <span class="font-bold text-[var(--text-main)]">№${idx + 1}. ${q.questionText || 'Вопрос'}</span>
                    ${statusBadge}
                </div>

                <div class="space-y-1 pt-1 border-t border-gray-400/40 text-[11px]">
                    <div class="${isCorrect ? 'text-emerald-600' : 'text-red-600'} font-medium">
                        <span class="text-[var(--text-main)]">Ответ студента:</span> ${q.userAnswer}
                    </div>
                    ${!isCorrect ? `
                        <div class="text-emerald-600 font-medium">
                            <span class="text-[var(--text-main)]">Правильный ответ:</span> ${q.correctAnswer}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

document.getElementById('btn-close-test-modal')?.addEventListener('click', () => {
    document.getElementById('test-review-modal')?.classList.add('hidden');
});
document.getElementById('btn-cancel-test-review')?.addEventListener('click', () => {
    document.getElementById('test-review-modal')?.classList.add('hidden');
});