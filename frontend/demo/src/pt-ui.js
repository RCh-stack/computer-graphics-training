const outlinerList = document.getElementById('outliner-list');
const outlinerCount = document.getElementById('outliner-count');
const inspectorContent = document.getElementById('inspector-content');

const stepBadge = document.getElementById('step-badge');
const stepTitle = document.getElementById('step-title');
const stepDesc = document.getElementById('step-desc');
const btnPrev = document.getElementById('btn-prev-step');
const btnNext = document.getElementById('btn-next-step');

function updateStepUI() {
    const step = PT_STEPS[currentStepIndex];
    stepBadge.innerText = `Шаг ${step.id} из ${PT_STEPS.length - 1}`;
    stepTitle.innerText = step.title;
    stepDesc.innerText = step.desc;

    btnPrev.disabled = currentStepIndex === 0;
    btnNext.disabled = currentStepIndex === PT_STEPS.length - 1;
}

function renderOutliner() {
    outlinerList.innerHTML = '';
    outlinerCount.innerText = ptSceneObjects.length;

    ptSceneObjects.forEach(obj => {
        const item = document.createElement('div');
        const isSelected = obj.id === selectedObjectId;

        item.className = `p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition border ${
            isSelected
                ? 'bg-amber-500/10 border-amber-500/35 text-[var(--text-main)] font-semibold'
                : 'bg-[var(--bg-elevated)] border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
        }`;

        item.innerHTML = `
            <div class="flex items-center space-x-2 truncate">
                <span class="w-2 h-2 rounded-full shrink-0 ${obj.type === 'sphere' ? 'bg-amber-500' : 'bg-emerald-500'}"></span>
                <span class="truncate">${obj.name}</span>
            </div>
            <button type="button" class="btn-delete text-[var(--text-muted)] hover:text-rose-500 px-1 transition">✕</button>
        `;

        item.addEventListener('click', (e) => {
            if (e.target.closest('.btn-delete')) {
                e.stopPropagation();
                ptSceneObjects = ptSceneObjects.filter(o => o.id !== obj.id);
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

function bindLiveSlider(id, obj, prop, labelId, decimals = 1) {
    const slider = document.getElementById(id);
    const label = document.getElementById(labelId);
    if (!slider) return;

    let isDragging = false;

    slider.addEventListener('input', (e) => {
        isDragging = true;
        obj[prop] = parseFloat(e.target.value);
        if (label) label.innerText = obj[prop].toFixed(decimals);
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
    const obj = ptSceneObjects.find(o => o.id === selectedObjectId);
    if (!obj) {
        inspectorContent.innerHTML = `<div class="text-xs text-[var(--text-muted)] text-center py-8">Выберите объект в списке слева для настройки его параметров.</div>`;
        return;
    }

    if (obj.type === 'sphere') {
        const roughnessVal = obj.roughness !== undefined ? obj.roughness : 1.0;
        const emissionVal = obj.emissionIntensity !== undefined ? obj.emissionIntensity : 0.0;

        inspectorContent.innerHTML = `
            <div class="space-y-3.5 text-xs">
                <div class="font-bold text-amber-500">${obj.name} (Сфера)</div>

                <div>
                    <label class="text-[var(--text-muted)] block mb-1 font-semibold">Тип материала:</label>
                    <select id="insp-material-preset" class="ui-select w-full px-3 py-2 text-amber-500 font-semibold cursor-pointer">
                        ${Object.keys(PT_MATERIAL_PRESETS).map(key => `
                            <option value="${key}" ${obj.presetKey === key ? 'selected' : ''}>
                                ${PT_MATERIAL_PRESETS[key].name}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция X:</span><span id="insp-val-x" class="font-mono text-amber-500 font-semibold">${obj.x.toFixed(1)}</span></div>
                    <input type="range" id="insp-x" min="-12" max="12" step="0.2" value="${obj.x}" class="w-full accent-amber-500 cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция Y:</span><span id="insp-val-y" class="font-mono text-amber-500 font-semibold">${obj.y.toFixed(1)}</span></div>
                    <input type="range" id="insp-y" min="-10" max="10" step="0.2" value="${obj.y}" class="w-full accent-amber-500 cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция Z (Глубина):</span><span id="insp-val-z" class="font-mono text-amber-500 font-semibold">${obj.z.toFixed(1)}</span></div>
                    <input type="range" id="insp-z" min="-30" max="-2" step="0.5" value="${obj.z}" class="w-full accent-amber-500 cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Радиус:</span><span id="insp-val-r" class="font-mono text-amber-500 font-semibold">${obj.r.toFixed(1)}</span></div>
                    <input type="range" id="insp-r" min="0.5" max="8" step="0.2" value="${obj.r}" class="w-full accent-amber-500 cursor-pointer">
                </div>

                <div class="pt-2 ui-divider-t space-y-3">
                    <div>
                        <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Шероховатость (Roughness):</span><span id="insp-val-rough" class="font-mono text-amber-500 font-semibold">${roughnessVal.toFixed(2)}</span></div>
                        <input type="range" id="insp-rough" min="0.0" max="1.0" step="0.02" value="${roughnessVal}" class="w-full accent-amber-500 cursor-pointer">
                    </div>

                    <div>
                        <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Свечение (Emission):</span><span id="insp-val-em" class="font-mono text-amber-500 font-semibold">${emissionVal.toFixed(1)}</span></div>
                        <input type="range" id="insp-em" min="0.0" max="8.0" step="0.2" value="${emissionVal}" class="w-full accent-amber-500 cursor-pointer">
                    </div>
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
            const preset = PT_MATERIAL_PRESETS[selectedKey];

            if (preset) {
                obj.presetKey = selectedKey;
                obj.albedo = { ...preset.albedo };
                obj.specularExponent = preset.specularExponent;
                obj.refractiveIndex = preset.refractiveIndex;
                obj.roughness = preset.roughness;
                obj.emissionIntensity = preset.emissionIntensity;

                renderInspector();
                triggerRender();
            }
        });

        bindLiveSlider('insp-x', obj, 'x', 'insp-val-x', 1);
        bindLiveSlider('insp-y', obj, 'y', 'insp-val-y', 1);
        bindLiveSlider('insp-z', obj, 'z', 'insp-val-z', 1);
        bindLiveSlider('insp-r', obj, 'r', 'insp-val-r', 1);
        bindLiveSlider('insp-rough', obj, 'roughness', 'insp-val-rough', 2);
        bindLiveSlider('insp-em', obj, 'emissionIntensity', 'insp-val-em', 1);

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
        const radiusVal = obj.radius !== undefined ? obj.radius : 1.0;
        const lightColorVal = obj.color || '#ffffff';

        inspectorContent.innerHTML = `
            <div class="space-y-3.5 text-xs">
                <div class="font-bold text-emerald-500">${obj.name} (Площадной свет)</div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция X:</span><span id="insp-val-x" class="font-mono text-emerald-500 font-semibold">${obj.x.toFixed(1)}</span></div>
                    <input type="range" id="insp-x" min="-35" max="35" step="0.5" value="${obj.x}" class="w-full accent-emerald-500 cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция Y:</span><span id="insp-val-y" class="font-mono text-emerald-500 font-semibold">${obj.y.toFixed(1)}</span></div>
                    <input type="range" id="insp-y" min="-35" max="35" step="0.5" value="${obj.y}" class="w-full accent-emerald-500 cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция Z:</span><span id="insp-val-z" class="font-mono text-emerald-500 font-semibold">${obj.z.toFixed(1)}</span></div>
                    <input type="range" id="insp-z" min="-35" max="25" step="0.5" value="${obj.z}" class="w-full accent-emerald-500 cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Интенсивность:</span><span id="insp-val-int" class="font-mono text-emerald-500 font-semibold">${obj.intensity.toFixed(1)}</span></div>
                    <input type="range" id="insp-int" min="0.1" max="8.0" step="0.1" value="${obj.intensity}" class="w-full accent-emerald-500 cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Радиус (Мягкость теней):</span><span id="insp-val-lrad" class="font-mono text-emerald-500 font-semibold">${radiusVal.toFixed(2)}</span></div>
                    <input type="range" id="insp-lrad" min="0.0" max="4.0" step="0.1" value="${radiusVal}" class="w-full accent-emerald-500 cursor-pointer">
                </div>

                <div>
                    <label class="text-[var(--text-muted)] block mb-1 font-semibold">Цвет света:</label>
                    <div class="ui-subcard flex items-center space-x-3 p-1.5">
                        <input type="color" id="insp-light-color" value="${lightColorVal}" class="w-7 h-7 bg-transparent border-0 cursor-pointer rounded">
                        <span id="insp-val-lcolor" class="text-xs font-mono text-[var(--text-main)] uppercase">${lightColorVal}</span>
                    </div>
                </div>
            </div>
        `;

        bindLiveSlider('insp-x', obj, 'x', 'insp-val-x', 1);
        bindLiveSlider('insp-y', obj, 'y', 'insp-val-y', 1);
        bindLiveSlider('insp-z', obj, 'z', 'insp-val-z', 1);
        bindLiveSlider('insp-int', obj, 'intensity', 'insp-val-int', 1);
        bindLiveSlider('insp-lrad', obj, 'radius', 'insp-val-lrad', 2);

        const lColorInput = document.getElementById('insp-light-color');
        const lColorLabel = document.getElementById('insp-val-lcolor');
        lColorInput.addEventListener('input', (e) => {
            obj.color = e.target.value;
            if (lColorLabel) lColorLabel.innerText = obj.color;
            triggerRender({ interactive: true });
        });
        lColorInput.addEventListener('change', (e) => {
            obj.color = e.target.value;
            if (lColorLabel) lColorLabel.innerText = obj.color;
            triggerRender({ interactive: false });
        });
    }
}