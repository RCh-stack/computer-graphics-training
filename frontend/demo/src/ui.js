const outlinerList = document.getElementById('outliner-list');
const outlinerCount = document.getElementById('outliner-count');
const inspectorContent = document.getElementById('inspector-content');

const stepBadge = document.getElementById('step-badge');
const stepTitle = document.getElementById('step-title');
const stepDesc = document.getElementById('step-desc');
const btnPrev = document.getElementById('btn-prev-step');
const btnNext = document.getElementById('btn-next-step');

function launchModule(url) {
    window.location.href = url;
}

function updateStepUI() {
    const step = STEPS[currentStepIndex];
    stepBadge.innerText = `Шаг ${step.id} из ${STEPS.length - 1}`;
    stepTitle.innerText = step.title;
    stepDesc.innerText = step.desc;

    btnPrev.disabled = currentStepIndex === 0;
    btnNext.disabled = currentStepIndex === STEPS.length - 1;
}

function renderOutliner() {
    outlinerList.innerHTML = '';
    outlinerCount.innerText = sceneObjects.length;

    sceneObjects.forEach(obj => {
        const item = document.createElement('div');
        const isSelected = obj.id === selectedObjectId;
        
        item.className = `p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition border ${
            isSelected 
                ? 'bg-pink-500/10 border-pink-500/35 text-[var(--text-main)] font-semibold' 
                : 'bg-[var(--bg-elevated)] border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
        }`;

        item.innerHTML = `
            <div class="flex items-center space-x-2 truncate">
                <span class="w-2 h-2 rounded-full shrink-0 ${obj.type === 'sphere' ? 'bg-pink-500' : 'bg-amber-500'}"></span>
                <span class="truncate">${obj.name}</span>
            </div>
            <button type="button" class="btn-delete text-[var(--text-muted)] hover:text-rose-500 px-1 transition">✕</button>
        `;

        item.addEventListener('click', (e) => {
            if (e.target.closest('.btn-delete')) {
                e.stopPropagation();
                sceneObjects = sceneObjects.filter(o => o.id !== obj.id);
                if (selectedObjectId === obj.id) selectedObjectId = null;
                renderOutliner();
                renderInspector();
                triggerRender();
            } else {
                selectedObjectId = obj.id;
                renderOutliner();
                renderInspector();
            }
        });

        outlinerList.appendChild(item);
    });
}

function bindLiveSlider(id, obj, prop, labelId) {
    const slider = document.getElementById(id);
    const label = document.getElementById(labelId);
    if (!slider) return;

    let isDragging = false;

    slider.addEventListener('input', (e) => {
        isDragging = true;
        obj[prop] = parseFloat(e.target.value);
        if (label) label.innerText = obj[prop].toFixed(1);
        triggerRender({ interactive: true });
    });

    const commitFinalRender = () => {
        if (!isDragging) return;
        isDragging = false;
        triggerRender({ interactive: false });
    };

    slider.addEventListener('change', commitFinalRender);
    slider.addEventListener('pointerup', commitFinalRender);
    slider.addEventListener('keyup', commitFinalRender);
}

function renderInspector() {
    const obj = sceneObjects.find(o => o.id === selectedObjectId);
    if (!obj) {
        inspectorContent.innerHTML = `<div class="text-xs text-[var(--text-muted)] text-center py-8">Выберите объект в списке слева для настройки его параметров.</div>`;
        return;
    }

    if (obj.type === 'sphere') {
        inspectorContent.innerHTML = `
            <div class="space-y-4 text-xs">
                <div class="font-bold text-pink-500">${obj.name} (Сфера)</div>
                
                <div>
                    <label class="text-[var(--text-muted)] block mb-1 font-semibold">Тип материала:</label>
                    <select id="insp-material-preset" class="ui-select w-full px-3 py-2 text-pink-500 font-semibold cursor-pointer">
                        ${Object.keys(MATERIAL_PRESETS).map(key => `
                            <option value="${key}" ${obj.presetKey === key ? 'selected' : ''}>
                                ${MATERIAL_PRESETS[key].name}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция X:</span><span id="insp-val-x" class="font-mono text-pink-500 font-semibold">${obj.x.toFixed(1)}</span></div>
                    <input type="range" id="insp-x" min="-10" max="10" step="0.2" value="${obj.x}" class="w-full accent-pink-500 cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция Y:</span><span id="insp-val-y" class="font-mono text-pink-500 font-semibold">${obj.y.toFixed(1)}</span></div>
                    <input type="range" id="insp-y" min="-10" max="10" step="0.2" value="${obj.y}" class="w-full accent-pink-500 cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция Z (Глубина):</span><span id="insp-val-z" class="font-mono text-pink-500 font-semibold">${obj.z.toFixed(1)}</span></div>
                    <input type="range" id="insp-z" min="-30" max="-2" step="0.5" value="${obj.z}" class="w-full accent-pink-500 cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Радиус:</span><span id="insp-val-r" class="font-mono text-pink-500 font-semibold">${obj.r.toFixed(1)}</span></div>
                    <input type="range" id="insp-r" min="0.5" max="8" step="0.2" value="${obj.r}" class="w-full accent-pink-500 cursor-pointer">
                </div>

                <div>
                    <label class="text-[var(--text-muted)] block mb-1 font-semibold">Цвет:</label>
                    <div class="ui-subcard flex items-center space-x-3 p-1.5">
                        <input type="color" id="insp-color" value="${obj.color}" class="w-7 h-7 bg-transparent border-0 cursor-pointer rounded">
                        <span id="insp-val-color" class="text-xs font-mono text-[var(--text-main)] uppercase">${obj.color}</span>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('insp-material-preset').addEventListener('change', (e) => {
            const selectedKey = e.target.value;
            const preset = MATERIAL_PRESETS[selectedKey];

            if (preset) {
                obj.presetKey = selectedKey;
                obj.albedo = preset.albedo;
                obj.specularExponent = preset.specularExponent;
                obj.refractiveIndex = preset.refractiveIndex;

                triggerRender();
            }
        });

        bindLiveSlider('insp-x', obj, 'x', 'insp-val-x');
        bindLiveSlider('insp-y', obj, 'y', 'insp-val-y');
        bindLiveSlider('insp-z', obj, 'z', 'insp-val-z');
        bindLiveSlider('insp-r', obj, 'r', 'insp-val-r');

        const colorInput = document.getElementById('insp-color');
        const colorLabel = document.getElementById('insp-val-color');
        colorInput.addEventListener('input', (e) => {
            obj.color = e.target.value;
            if (colorLabel) colorLabel.innerText = obj.color;
            triggerRender({ interactive: true });
        });
        colorInput.addEventListener('change', (e) => {
            obj.color = e.target.value;
            if (colorLabel) colorLabel.innerText = obj.color;
            triggerRender({ interactive: false });
        });

    } else if (obj.type === 'light') {
        inspectorContent.innerHTML = `
            <div class="space-y-4 text-xs">
                <div class="font-bold text-amber-500">${obj.name} (Источник света)</div>
                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция X:</span><span id="insp-val-x" class="font-mono text-amber-500 font-semibold">${obj.x.toFixed(1)}</span></div>
                    <input type="range" id="insp-x" min="-40" max="40" step="1" value="${obj.x}" class="w-full accent-amber-500 cursor-pointer">
                </div>
                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция Y:</span><span id="insp-val-y" class="font-mono text-amber-500 font-semibold">${obj.y.toFixed(1)}</span></div>
                    <input type="range" id="insp-y" min="-40" max="40" step="1" value="${obj.y}" class="w-full accent-amber-500 cursor-pointer">
                </div>
                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция Z:</span><span id="insp-val-z" class="font-mono text-amber-500 font-semibold">${obj.z.toFixed(1)}</span></div>
                    <input type="range" id="insp-z" min="-40" max="40" step="1" value="${obj.z}" class="w-full accent-amber-500 cursor-pointer">
                </div>
                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Интенсивность:</span><span id="insp-val-int" class="font-mono text-amber-500 font-semibold">${obj.intensity.toFixed(1)}</span></div>
                    <input type="range" id="insp-int" min="0.1" max="5.0" step="0.1" value="${obj.intensity}" class="w-full accent-amber-500 cursor-pointer">
                </div>
            </div>
        `;

        bindLiveSlider('insp-x', obj, 'x', 'insp-val-x');
        bindLiveSlider('insp-y', obj, 'y', 'insp-val-y');
        bindLiveSlider('insp-z', obj, 'z', 'insp-val-z');
        bindLiveSlider('insp-int', obj, 'intensity', 'insp-val-int');
    }
}