document.addEventListener('DOMContentLoaded', () => {
    loadCourseManifest();
    initScrollTracker();
});

let currentLessonState = {
    id: null,
    isCompleted: false
};
let scrollTimer = null;

async function loadCourseManifest(silent = false) {
    const menuContainer = document.getElementById('course-menu');

    if (!silent && menuContainer && window.Skeleton) {
        Skeleton.render(menuContainer, Skeleton.courseMenu(2, 3));
    }

    try {
        const token = localStorage.getItem('authToken');

        const response = await fetch('/api/v1/ebook/lessons', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        if (!response.ok) throw new Error('Не удалось загрузить оглавление курса.');

        const data = await response.json();

        updateOverallProgressUI(data.overallProgress || 0);

        renderSidebarMenu(data.chapters || [], menuContainer);

        if (!currentLessonState.id && data.chapters?.[0]?.lessons?.[0]) {
            loadLesson(data.chapters[0].lessons[0].id);
        }
    } catch (error) {
        console.error('Ошибка загрузки меню:', error);
        if (!silent && menuContainer) {
            menuContainer.innerHTML = `<div class="text-rose-500 p-2 text-xs">Ошибка загрузки меню</div>`;
        }
    }
}

function updateOverallProgressUI(percent) {
    const bar = document.getElementById('overall-progress-bar');
    const text = document.getElementById('overall-progress-text');
    if (bar) bar.style.width = `${percent}%`;
    if (text) text.innerText = `${percent}% завершено`;
}

function renderSidebarMenu(chapters, container) {
    if (!container) return;
    container.innerHTML = '';

    chapters.forEach(chapter => {
        const chapterHeader = document.createElement('div');
        chapterHeader.className = 'mt-3 mb-1 px-2 flex justify-between items-center gap-2';
        chapterHeader.innerHTML = `
            <span class="font-bold text-[var(--text-muted)] uppercase text-[10px] tracking-wider truncate" title="${chapter.title}">${chapter.title}</span>
            <span class="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 border border-indigo-500/25 shrink-0">${chapter.completedCount}/${chapter.totalCount}</span>
        `;
        container.appendChild(chapterHeader);

        if (Array.isArray(chapter.lessons)) {
            chapter.lessons.forEach(lesson => {
                const lessonLink = document.createElement('a');
                lessonLink.href = '#';
                lessonLink.dataset.lessonId = lesson.id;

                const checkIcon = lesson.isCompleted
                    ? `<span class="text-emerald-500 font-bold ml-auto text-xs shrink-0">✓</span>`
                    : `<span class="text-[var(--text-muted)] opacity-50 ml-auto text-xs shrink-0">○</span>`;

                lessonLink.className = 'lesson-link flex items-center justify-between p-2 rounded-xl border border-transparent hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)] text-[var(--text-muted)] transition text-xs gap-2';
                lessonLink.innerHTML = `<span class="truncate">${lesson.title}</span>${checkIcon}`;

                lessonLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    loadLesson(lesson.id);
                });

                container.appendChild(lessonLink);
            });
        }
    });

    if (currentLessonState.id) {
        updateActiveMenuItem(currentLessonState.id);
    }
}

async function loadLesson(lessonId) {
    const contentContainer = document.getElementById('lesson-content');
    const sidebarContainer = document.getElementById('widget-sidebar-container');

    if (scrollTimer) {
        clearTimeout(scrollTimer);
        scrollTimer = null;
    }

    currentLessonState.id = lessonId;
    updateActiveMenuItem(lessonId);

    if (sidebarContainer) {
        sidebarContainer.innerHTML = '';
    }

    if (contentContainer && window.Skeleton) {
        Skeleton.render(contentContainer, Skeleton.lessonArticle());
    }

    try {
        const token = localStorage.getItem('authToken');

        const response = await fetch(`/api/v1/ebook/lessons/${lessonId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });

        if (!response.ok) throw new Error('Ошибка загрузки данных урока');

        const data = await response.json();

        if (data.status === 'success' && data.lesson) {
            currentLessonState.isCompleted = Boolean(data.lesson.isCompleted);

            renderLessonContent(data.lesson, contentContainer);

            if (!currentLessonState.isCompleted) {
                checkAutoCompletion();
            }
        } else {
            throw new Error(data.message || 'Ошибка ответа API');
        }
    } catch (error) {
        console.error('Ошибка загрузки урока:', error);
        if (contentContainer) {
            contentContainer.innerHTML = `<div class="text-rose-500 p-4 text-xs">Не удалось загрузить материал урока.</div>`;
        }
        window.Toast?.error('Ошибка загрузки', 'Не удалось открыть материал урока');
    }
}

function renderLessonContent(lesson, container) {
    if (!container) return;
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'max-w-2xl mx-auto space-y-6 pb-12';

    const header = document.createElement('div');
    header.className = 'border-b border-[var(--border-color)] pb-4 flex justify-between items-start gap-4';
    header.innerHTML = `
        <div>
            <span class="text-xs font-mono text-indigo-500 font-bold uppercase">${lesson.chapterTitle || 'Урок'}</span>
            <h2 class="text-2xl font-extrabold mt-1 text-[var(--text-main)]">${lesson.title}</h2>
        </div>
    `;
    wrapper.appendChild(header);

    const sidebarContainer = document.getElementById('widget-sidebar-container');
    if (sidebarContainer) sidebarContainer.innerHTML = '';

    if (lesson.html) {
        const htmlBlock = document.createElement('div');
        htmlBlock.className = 'html-content-block text-sm text-[var(--text-main)] leading-relaxed space-y-4';
        htmlBlock.innerHTML = lesson.html;
        wrapper.appendChild(htmlBlock);
    }

    const widgets = lesson.widgets || [];
    widgets.forEach(widgetBlock => {
        const targetContainer = sidebarContainer || wrapper;
        if (window.WidgetRegistry && widgetBlock.widgetId) {
            window.WidgetRegistry.mount(widgetBlock.widgetId, targetContainer, widgetBlock.config || {});
        }
    });

    const footerBlock = document.createElement('div');
    footerBlock.id = 'lesson-completion-footer';
    footerBlock.className = 'border-t border-[var(--border-color)] pt-6 mt-8 flex justify-center';

    renderCompletionButton(footerBlock, lesson.id, currentLessonState.isCompleted);
    wrapper.appendChild(footerBlock);

    container.appendChild(wrapper);
    container.scrollTop = 0;
}

function renderCompletionButton(container, lessonId, isCompleted) {
    if (!container) return;

    if (isCompleted) {
        container.innerHTML = `
            <button id="btn-toggle-completion" type="button" class="px-5 py-2.5 bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 rounded-xl font-semibold text-xs flex items-center gap-2 hover:bg-emerald-500/25 transition cursor-pointer">
                <span>✓ Изучено</span>
                <span class="text-[10px] text-[var(--text-muted)] underline ml-1">(отменить)</span>
            </button>
        `;
    } else {
        container.innerHTML = `
            <button id="btn-toggle-completion" type="button" class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-xs shadow-sm transition flex items-center gap-2 cursor-pointer">
                <span>Отметить как изученное</span>
            </button>
        `;
    }

    const btn = container.querySelector('#btn-toggle-completion');
    btn?.addEventListener('click', (e) => {
        e.preventDefault();
        updateLessonCompletion(lessonId, !isCompleted);
    });
}

async function updateLessonCompletion(lessonId, targetStatus) {
    if (scrollTimer) {
        clearTimeout(scrollTimer);
        scrollTimer = null;
    }

    const btn = document.getElementById('btn-toggle-completion');
    if (btn) btn.disabled = true;

    const token = localStorage.getItem('authToken');
    try {
        const res = await fetch(`/api/v1/ebook/lessons/${lessonId}/progress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ completed: targetStatus })
        });

        if (res.ok) {
            currentLessonState.isCompleted = targetStatus;

            await loadCourseManifest(true);

            const footer = document.getElementById('lesson-completion-footer');
            if (footer) renderCompletionButton(footer, lessonId, targetStatus);

            if (targetStatus) {
                window.Toast?.success('Урок отмечен как изученный');
            } else {
                window.Toast?.info('Отметка об изучении снята');
            }
        } else {
            window.Toast?.error('Не удалось обновить статус урока');
        }
    } catch (err) {
        console.error('Ошибка сохранения статуса урока:', err);
        window.Toast?.error('Ошибка соединения при сохранении прогресса');
    } finally {
        const currentBtn = document.getElementById('btn-toggle-completion');
        if (currentBtn) currentBtn.disabled = false;
    }
}

function checkAutoCompletion() {
    const contentBox = document.getElementById('lesson-content');

    if (!contentBox || !currentLessonState.id || currentLessonState.isCompleted) return;

    const scrollPosition = contentBox.scrollTop + contentBox.clientHeight;
    const totalHeight = contentBox.scrollHeight;

    const isShortPage = totalHeight <= contentBox.clientHeight + 50;
    const isScrolledToBottom = (scrollPosition / totalHeight) >= 0.85;

    if (isShortPage || isScrolledToBottom) {
        if (!scrollTimer) {
            scrollTimer = setTimeout(() => {
                updateLessonCompletion(currentLessonState.id, true);
                scrollTimer = null;
            }, 3000);
        }
    } else {
        if (scrollTimer) {
            clearTimeout(scrollTimer);
            scrollTimer = null;
        }
    }
}

function initScrollTracker() {
    const contentBox = document.getElementById('lesson-content');
    if (!contentBox) return;

    contentBox.addEventListener('scroll', () => {
        checkAutoCompletion();
    });
}

function updateActiveMenuItem(activeLessonId) {
    document.querySelectorAll('.lesson-link').forEach(link => {
        if (link.dataset.lessonId === activeLessonId) {
            link.classList.add('bg-indigo-500/10', 'text-indigo-500', 'font-semibold', 'border-indigo-500/30');
            link.classList.remove('text-[var(--text-muted)]', 'border-transparent');
        } else {
            link.classList.remove('bg-indigo-500/10', 'text-indigo-500', 'font-semibold', 'border-indigo-500/30');
            link.classList.add('text-[var(--text-muted)]', 'border-transparent');
        }
    });
}