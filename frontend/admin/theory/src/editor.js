document.addEventListener('DOMContentLoaded', () => {
    initQuillEditor();
    initEvents();
    loadLessonDetails();
});

const lessonId = new URLSearchParams(window.location.search).get('id');
const adminLessonDraftKey = `admin_ebook_lesson_${lessonId || 'new'}`;

const adminLessonGuard = window.DraftGuard
    ? window.DraftGuard.create({
          confirmTitle: 'Изменения в статье не сохранены',
          confirmText: 'Сохранить изменения в статье перед переходом?',
          onSave: () => saveLesson()
      })
    : null;

let quill = null;
let currentOrder = 1;
let widgetsState = [];
let isLessonLoaded = false;
let isSyncingQuill = false;

const WIDGET_PRESETS = {
    RAY_SPHERE_2D: { t: 130, angle: 0, origin: { x: 30, y: 110 }, sphere: { r: 35, x: 180, y: 110 } },
    LAMBERT_DIFFUSE_2D: { lightAngle: 45, normalAngle: 0, albedo: 0.8 },
    SPECULAR_REFLECTION_2D: { incidentAngle: 30, roughness: 0.1 }
};

function getWidgetsSnapshotFromDOM() {
    const cards = document.querySelectorAll('#widgets-list-container .widget-card');
    if (cards.length > 0) {
        return Array.from(cards).map((card, idx) => {
            const selectEl = card.querySelector('.widget-type-select');
            const textareaEl = card.querySelector('.widget-config-textarea');
            const widgetId = selectEl ? selectEl.value : (widgetsState[idx]?.widgetId || 'RAY_SPHERE_2D');
            const rawText = textareaEl ? textareaEl.value : '';

            try {
                return {
                    type: 'widget',
                    widgetId,
                    config: JSON.parse(rawText)
                };
            } catch {
                return {
                    type: 'widget',
                    widgetId,
                    rawConfig: rawText
                };
            }
        });
    }

    return widgetsState.map(w => {
        const widgetId = w.widgetId || 'RAY_SPHERE_2D';
        if (typeof w._rawConfig === 'string') {
            return { type: 'widget', widgetId, rawConfig: w._rawConfig };
        }
        return {
            type: 'widget',
            widgetId,
            config: w.config || WIDGET_PRESETS[widgetId] || {}
        };
    });
}

function getLessonSnapshot() {
    return {
        title: document.getElementById('lesson-title')?.value ?? '',
        content: quill ? quill.root.innerHTML : '',
        widgets: getWidgetsSnapshotFromDOM()
    };
}

function applyLessonSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;

    const titleInput = document.getElementById('lesson-title');
    if (titleInput) titleInput.value = snapshot.title || '';

    if (quill) {
        isSyncingQuill = true;
        quill.root.innerHTML = snapshot.content || '';
        setTimeout(() => {
            isSyncingQuill = false;
        }, 0);
    }

    widgetsState = Array.isArray(snapshot.widgets)
        ? snapshot.widgets.map(w => {
              const widgetId = w.widgetId || 'RAY_SPHERE_2D';
              if (typeof w.rawConfig === 'string') {
                  return { type: 'widget', widgetId, _rawConfig: w.rawConfig };
              }
              return {
                  type: 'widget',
                  widgetId,
                  config: w.config || WIDGET_PRESETS[widgetId] || {}
              };
          })
        : [];

    renderWidgets();
}

function trackLessonChanges() {
    if (!isLessonLoaded || !adminLessonGuard) return;
    adminLessonGuard.watch(adminLessonDraftKey, getLessonSnapshot());
}

function syncWidgetsLenientFromDOM() {
    document.querySelectorAll('#widgets-list-container .widget-card').forEach((card, idx) => {
        if (!widgetsState[idx]) return;
        const selectEl = card.querySelector('.widget-type-select');
        const textareaEl = card.querySelector('.widget-config-textarea');
        const widgetId = selectEl ? selectEl.value : 'RAY_SPHERE_2D';
        const rawText = textareaEl ? textareaEl.value : '';

        try {
            widgetsState[idx] = {
                type: 'widget',
                widgetId,
                config: JSON.parse(rawText)
            };
        } catch {
            widgetsState[idx] = {
                type: 'widget',
                widgetId,
                _rawConfig: rawText
            };
        }
    });
}

function initQuillEditor() {
    quill = new Quill('#quill-editor-container', {
        theme: 'snow',
        placeholder: 'Введите текст статьи, формулы и пояснения...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['blockquote', 'code-block'],
                ['link', 'image'],
                ['formula'],
                ['clean']
            ]
        }
    });

    quill.on('text-change', () => {
        if (isSyncingQuill) return;
        trackLessonChanges();
    });
}

function initEvents() {
    document.getElementById('btn-save-lesson')?.addEventListener('click', saveLesson);
    document.getElementById('btn-add-widget')?.addEventListener('click', addNewWidget);
    document.getElementById('lesson-title')?.addEventListener('input', trackLessonChanges);

    document.getElementById('widgets-list-container')?.addEventListener('input', (e) => {
        if (e.target.classList.contains('widget-config-textarea')) {
            trackLessonChanges();
        }
    });

    document.getElementById('widgets-list-container')?.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.btn-remove-widget');
        if (removeBtn) {
            syncWidgetsLenientFromDOM();
            const idx = parseInt(removeBtn.dataset.index);
            widgetsState.splice(idx, 1);
            renderWidgets();
            trackLessonChanges();
            window.Toast?.info('Виджет удален', 'Не забудьте сохранить страницу');
            return;
        }
    });

    document.getElementById('widgets-list-container')?.addEventListener('change', (e) => {
        if (e.target.classList.contains('widget-type-select')) {
            syncWidgetsLenientFromDOM();
            const card = e.target.closest('.widget-card');
            const idx = parseInt(card.dataset.index);
            const newWidgetId = e.target.value;

            if (widgetsState[idx]) {
                widgetsState[idx] = {
                    type: 'widget',
                    widgetId: newWidgetId,
                    config: WIDGET_PRESETS[newWidgetId] || {}
                };
                renderWidgets();
                trackLessonChanges();
            }
        }
    });
}

function setEditorLoadingState(isLoading) {
    const titleInput = document.getElementById('lesson-title');
    const saveBtn = document.getElementById('btn-save-lesson');
    const addWidgetBtn = document.getElementById('btn-add-widget');

    if (titleInput) titleInput.disabled = isLoading;
    if (saveBtn) saveBtn.disabled = isLoading;
    if (addWidgetBtn) addWidgetBtn.disabled = isLoading;
    if (quill) quill.enable(!isLoading);

    if (isLoading && window.Skeleton) {
        Skeleton.render('#widgets-list-container', Skeleton.widgetCards(1));
    }
}

async function loadLessonDetails() {
    if (!lessonId) {
        window.location.href = 'index.html';
        return;
    }

    setEditorLoadingState(true);
    const token = localStorage.getItem('authToken');

    try {
        const res = await fetch(`/api/v1/admin/ebook/lessons/${lessonId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok && data.status === 'success') {
            const art = data.lesson;
            document.getElementById('lesson-title').value = art.title || '';
            currentOrder = art.order || 1;

            if (quill) {
                isSyncingQuill = true;
                quill.root.innerHTML = art.content || '';
            }

            let wConfig = art.widgets_config;
            if (typeof wConfig === 'string') {
                try { wConfig = JSON.parse(wConfig); } catch (e) { wConfig = []; }
            }
            widgetsState = Array.isArray(wConfig) ? wConfig : [];

            setEditorLoadingState(false);
            renderWidgets();

            await new Promise(resolve => setTimeout(resolve, 0));
            isSyncingQuill = false;
            isLessonLoaded = true;

            const serverSnapshot = getLessonSnapshot();
            adminLessonGuard?.setBaseline(adminLessonDraftKey, serverSnapshot);

            if (adminLessonGuard?.hasDiffFromBaseline(adminLessonDraftKey, serverSnapshot)) {
                const savedDraft = adminLessonGuard.load(adminLessonDraftKey);
                const savedTime = savedDraft?.savedAt
                    ? new Date(savedDraft.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                const restoreRes = await Swal.fire({
                    title: 'Найден несохранённый черновик',
                    text: `Обнаружены локальные правки статьи${savedTime ? ` от ${savedTime}` : ''}, которые не были сохранены в БД. Восстановить их?`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Восстановить черновик',
                    cancelButtonText: 'Загрузить из БД',
                    confirmButtonColor: '#2563eb'
                });

                if (restoreRes.isConfirmed && savedDraft?.data) {
                    applyLessonSnapshot(savedDraft.data);
                    await new Promise(resolve => setTimeout(resolve, 0));
                    trackLessonChanges();
                    window.Toast?.info('Черновик восстановлен', 'Нажмите «Сохранить», чтобы записать изменения в БД');
                } else {
                    adminLessonGuard.clear(adminLessonDraftKey);
                }
            }
        } else {
            throw new Error(data.message || 'Не удалось загрузить статью');
        }
    } catch (error) {
        console.error('Ошибка загрузки статьи:', error);
        isSyncingQuill = false;
        setEditorLoadingState(false);
        const container = document.getElementById('widgets-list-container');
        if (container) container.innerHTML = '';
        window.Toast?.error('Ошибка загрузки', 'Не удалось загрузить содержимое статьи');
    }
}

function renderWidgets() {
    const container = document.getElementById('widgets-list-container');
    if (!container) return;

    if (widgetsState.length === 0) {
        container.innerHTML = `<div class="p-6 border border-dashed border-[var(--border-strong)] rounded-xl text-center text-[var(--text-muted)] text-xs">Виджеты не привязаны к этой странице</div>`;
        return;
    }

    container.innerHTML = widgetsState.map((w, idx) => {
        const widgetId = w.widgetId || 'RAY_SPHERE_2D';
        const configJson = typeof w._rawConfig === 'string'
            ? w._rawConfig
            : JSON.stringify(w.config || WIDGET_PRESETS[widgetId], null, 2);

        return `
            <div class="widget-card ui-subcard p-3.5 space-y-3" data-index="${idx}">
                <div class="flex justify-between items-center ui-divider-b pb-2">
                    <span class="text-xs font-bold font-mono text-blue-500">Виджет №${idx + 1}</span>
                    <button type="button" class="btn-remove-widget text-rose-500 text-xs hover:underline font-medium" data-index="${idx}">
                        <i class="fa-solid fa-trash mr-1"></i> Удалить
                    </button>
                </div>

                <div>
                    <label class="block text-[10px] uppercase font-semibold text-[var(--text-muted)] mb-1">Тип виджета</label>
                    <select class="widget-type-select ui-select w-full px-2.5 py-1.5 font-semibold">
                        <option value="RAY_SPHERE_2D" ${widgetId === 'RAY_SPHERE_2D' ? 'selected' : ''}>RAY_SPHERE_2D</option>
                        <option value="LAMBERT_DIFFUSE_2D" ${widgetId === 'LAMBERT_DIFFUSE_2D' ? 'selected' : ''}>LAMBERT_DIFFUSE_2D</option>
                        <option value="SPECULAR_REFLECTION_2D" ${widgetId === 'SPECULAR_REFLECTION_2D' ? 'selected' : ''}>SPECULAR_REFLECTION_2D</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] uppercase font-semibold text-[var(--text-muted)] mb-1">Параметры (JSON)</label>
                    <textarea rows="5" class="widget-config-textarea ui-textarea w-full font-mono text-[11px] px-2.5 py-1.5 text-blue-500 leading-relaxed">${configJson}</textarea>
                </div>
            </div>
        `;
    }).join('');
}

function addNewWidget() {
    if (!syncWidgetsFromDOM()) return;
    widgetsState.push({
        type: 'widget',
        widgetId: 'RAY_SPHERE_2D',
        config: WIDGET_PRESETS.RAY_SPHERE_2D
    });
    renderWidgets();
    trackLessonChanges();
}

function syncWidgetsFromDOM() {
    let isValid = true;

    document.querySelectorAll('.widget-card').forEach((card, idx) => {
        if (!widgetsState[idx]) return;

        const selectEl = card.querySelector('.widget-type-select');
        const textareaEl = card.querySelector('.widget-config-textarea');

        let parsedConfig = {};
        try {
            parsedConfig = JSON.parse(textareaEl.value);
            textareaEl.classList.remove('border-rose-500');
        } catch {
            isValid = false;
            textareaEl.classList.add('border-rose-500');
            window.Toast?.warning(`Ошибка JSON в виджете №${idx + 1}`, 'Проверьте синтаксис параметров перед сохранением');
        }

        if (isValid) {
            widgetsState[idx] = {
                type: 'widget',
                widgetId: selectEl ? selectEl.value : 'RAY_SPHERE_2D',
                config: parsedConfig
            };
        }
    });

    return isValid;
}

async function saveLesson() {
    if (!isLessonLoaded) return false;
    if (!syncWidgetsFromDOM()) return false;

    const saveBtn = document.getElementById('btn-save-lesson');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.classList.add('opacity-60', 'cursor-not-allowed');
    }

    const token = localStorage.getItem('authToken');
    const htmlContent = quill ? quill.root.innerHTML : '';

    const payload = {
        title: document.getElementById('lesson-title').value,
        content: htmlContent,
        widgetsConfig: widgetsState,
        order: currentOrder
    };

    try {
        const res = await fetch(`/api/v1/admin/ebook/lessons/${lessonId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            adminLessonGuard?.markClean(adminLessonDraftKey, getLessonSnapshot());
            Toast.success('Страница успешно сохранена');
            return true;
        } else {
            Toast.error(data.message || 'Не удалось сохранить страницу');
            return false;
        }
    } catch (error) {
        console.error(error);
        Toast.error('Ошибка подключения к серверу');
        return false;
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.classList.remove('opacity-60', 'cursor-not-allowed');
        }
    }
}