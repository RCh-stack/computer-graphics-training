document.addEventListener('DOMContentLoaded', () => {
    loadCourseManifest();
});

async function loadCourseManifest() {
    const menuContainer = document.getElementById('course-menu');
    
    try {
        const response = await fetch('content/manifest.json');
        if (!response.ok) throw new Error('Не удалось загрузить оглавление курса.');
        
        const data = await response.json();
        renderSidebarMenu(data.chapters, menuContainer);

        if (data.chapters[0]?.lessons[0]) {
            loadLesson(data.chapters[0].lessons[0].file, data.chapters[0].lessons[0].id);
        }
    } catch (error) {
        console.error(error);
        menuContainer.innerHTML = `<div class="text-red-400 p-2">Ошибка загрузки меню</div>`;
    }
}

function renderSidebarMenu(chapters, container) {
    container.innerHTML = '';

    chapters.forEach(chapter => {
        // Заголовок главы
        const chapterTitle = document.createElement('div');
        chapterTitle.className = 'font-bold text-[var(--text-muted)] px-2 py-1 uppercase text-[10px] mt-3';
        chapterTitle.innerText = chapter.title;
        container.appendChild(chapterTitle);

        // Список уроков главы
        chapter.lessons.forEach(lesson => {
            const lessonLink = document.createElement('a');
            lessonLink.href = '#';
            lessonLink.dataset.lessonId = lesson.id;
            lessonLink.className = 'lesson-link block p-2 rounded-xl hover:bg-[var(--bg-card)] text-[var(--text-muted)] transition';
            lessonLink.innerText = lesson.title;

            lessonLink.addEventListener('click', (e) => {
                e.preventDefault();
                loadLesson(lesson.file, lesson.id);
            });

            container.appendChild(lessonLink);
        });
    });
}

async function loadLesson(filePath, lessonId) {
    const contentContainer = document.getElementById('lesson-content');
    updateActiveMenuItem(lessonId);

    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error('Ошибка загрузки данных урока');

        const lesson = await response.json();
        renderLessonContent(lesson, contentContainer);
    } catch (error) {
        console.error(error);
        contentContainer.innerHTML = `<div class="text-red-400 p-4">Не удалось загрузить материал урока.</div>`;
    }
}

// src/loader.js

async function renderLessonContent(lesson, container) {
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'max-w-2xl mx-auto space-y-6';

    // Очищаем сайдбар виджета перед рендером
    const sidebarContainer = document.getElementById('widget-sidebar-container');
    if (sidebarContainer) sidebarContainer.innerHTML = '';

    // Перебираем блоки последовательно
    for (const block of lesson.blocks) {
        
        // 1. ПОДГРУЗКА ВНЕШНЕЙ HTML-СТРАНИЦЫ
        if (block.type === 'html' || block.type === 'text') {
            const htmlBlock = document.createElement('div');
            htmlBlock.className = 'html-content-block';

            // Если в content указан путь к .html файлу
            if (typeof block.content === 'string' && block.content.endsWith('.html')) {
                try {
                    const response = await fetch(block.content);
                    if (response.ok) {
                        htmlBlock.innerHTML = await response.text();
                    } else {
                        htmlBlock.innerHTML = `<div class="text-red-400 text-xs">Не удалось загрузить блок: ${block.content}</div>`;
                    }
                } catch (err) {
                    htmlBlock.innerHTML = `<div class="text-red-400 text-xs">Ошибка сети при загрузке ${block.content}</div>`;
                }
            } else {
                // Запасной вариант для простой строки
                htmlBlock.innerHTML = `<p class="text-sm leading-relaxed">${block.content}</p>`;
            }

            wrapper.appendChild(htmlBlock);
        }

        // 2. ПОДГРУЗКА ВИДЖЕТА
        else if (block.type === 'widget') {
            const targetContainer = sidebarContainer || wrapper;
            if (window.WidgetRegistry) {
                window.WidgetRegistry.mount(block.widgetId, targetContainer, block.config || {});
            }
        }
    }

    container.appendChild(wrapper);
}

/*
function renderLessonContent(lesson, container) {
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'max-w-2xl mx-auto space-y-6';

    // Шапка урока
    const header = document.createElement('div');
    header.className = 'border-b border-[var(--border-color)] pb-4';
    header.innerHTML = `
        <span class="text-xs font-mono text-indigo-400 font-bold uppercase">Урок</span>
        <h2 class="text-2xl font-extrabold mt-1">${lesson.title}</h2>
    `;
    wrapper.appendChild(header);

    const sidebarContainer = document.getElementById('widget-sidebar-container');
    if (sidebarContainer) {
        sidebarContainer.innerHTML = ''; // Очистка старого виджета
    }

    // Парсинг блоков контента из JSON
    lesson.blocks.forEach(block => {
        if (block.type === 'text') {
            const p = document.createElement('p');
            p.className = 'text-sm leading-relaxed text-[var(--text-main)]';
            p.innerHTML = block.content; // Поддерживает теги <b>, <i> и т.д.
            wrapper.appendChild(p);

        } else if (block.type === 'formula') {
            const formulaBox = document.createElement('div');
            formulaBox.className = 'bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)] text-center font-mono text-sm text-indigo-300';
            formulaBox.innerText = block.latex;
            wrapper.appendChild(formulaBox);

        } else if (block.type === 'widget') {
            const targetContainer = sidebarContainer || wrapper;

            if (window.WidgetRegistry) {
                // Программный вызов монтирования с передачей конфига из JSON урока
                window.WidgetRegistry.mount(block.widgetId, targetContainer, block.config || {});
            }
        } 
        else if (block.type === 'hint') {
            const hintBox = document.createElement('div');
            hintBox.className = 'bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl text-xs space-y-2';
            hintBox.innerHTML = `
                <div class="font-bold text-indigo-400 flex items-center space-x-1">
                    <span>💡</span><span>${block.title || 'Подсказка'}</span>
                </div>
                <div class="text-[var(--text-muted)]">${block.text}</div>
            `;
            wrapper.appendChild(hintBox);
        }
    });

    container.appendChild(wrapper);
}
*/

// Подсветка активного пункта в меню
function updateActiveMenuItem(activeLessonId) {
    document.querySelectorAll('.lesson-link').forEach(link => {
        if (link.dataset.lessonId === activeLessonId) {
            link.className = 'lesson-link block p-2 rounded-xl bg-indigo-600/20 text-indigo-400 font-semibold border border-indigo-500/30';
        } else {
            link.className = 'lesson-link block p-2 rounded-xl hover:bg-[var(--bg-card)] text-[var(--text-muted)] transition';
        }
    });
}