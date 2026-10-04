document.addEventListener('DOMContentLoaded', () => {
    loadCourseManifest();
});

async function loadCourseManifest() {
    const menuContainer = document.getElementById('course-menu');
    
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
        const chapters = data.chapters || [];

        renderSidebarMenu(chapters, menuContainer);

        if (chapters[0]?.lessons[0]) {
            loadLesson(chapters[0].lessons[0].id);
        }
    } catch (error) {
        console.error('Ошибка загрузки меню:', error);
        if (menuContainer) {
            menuContainer.innerHTML = `<div class="text-red-400 p-2 text-xs">Ошибка загрузки меню</div>`;
        }
    }
}

function renderSidebarMenu(chapters, container) {
    if (!container) return;
    container.innerHTML = '';

    chapters.forEach(chapter => {
        const chapterTitle = document.createElement('div');
        chapterTitle.className = 'font-bold text-[var(--text-muted)] px-2 py-1 uppercase text-[10px] mt-3';
        chapterTitle.innerText = chapter.title;
        container.appendChild(chapterTitle);

        if (Array.isArray(chapter.lessons)) {
            chapter.lessons.forEach(lesson => {
                const lessonLink = document.createElement('a');
                lessonLink.href = '#';
                lessonLink.dataset.lessonId = lesson.id;
                lessonLink.className = 'lesson-link block p-2 rounded-xl hover:bg-[var(--bg-card)] text-[var(--text-muted)] transition text-xs';
                lessonLink.innerText = lesson.title;

                lessonLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    loadLesson(lesson.id);
                });

                container.appendChild(lessonLink);
            });
        }
    });
}

async function loadLesson(lessonId) {
    const contentContainer = document.getElementById('lesson-content');
    updateActiveMenuItem(lessonId);

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
            renderLessonContent(data.lesson, contentContainer);
        } else {
            throw new Error(data.message || 'Ошибка ответа API');
        }
    } catch (error) {
        console.error('Ошибка загрузки урока:', error);
        if (contentContainer) {
            contentContainer.innerHTML = `<div class="text-red-400 p-4 text-xs">Не удалось загрузить материал урока.</div>`;
        }
    }
}

async function renderLessonContent(lesson, container) {
    if (!container) return;
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'max-w-2xl mx-auto space-y-6';

    const header = document.createElement('div');
    header.className = 'border-b border-[var(--border-color)] pb-4';
    header.innerHTML = `
        <span class="text-xs font-mono text-indigo-400 font-bold uppercase">${lesson.chapterTitle || 'Урок'}</span>
        <h2 class="text-2xl font-extrabold mt-1">${lesson.title}</h2>
    `;
    wrapper.appendChild(header);

    const sidebarContainer = document.getElementById('widget-sidebar-container');
    if (sidebarContainer) {
        sidebarContainer.innerHTML = '';
    }

    if (lesson.html) {
        const htmlBlock = document.createElement('div');
        htmlBlock.className = 'html-content-block text-sm leading-relaxed space-y-4';
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

    container.appendChild(wrapper);
}

function updateActiveMenuItem(activeLessonId) {
    document.querySelectorAll('.lesson-link').forEach(link => {
        if (link.dataset.lessonId === activeLessonId) {
            link.className = 'lesson-link block p-2 rounded-xl bg-indigo-600/20 text-indigo-400 font-semibold border border-indigo-500/30 text-xs';
        } else {
            link.className = 'lesson-link block p-2 rounded-xl hover:bg-[var(--bg-card)] text-[var(--text-muted)] transition text-xs';
        }
    });
}