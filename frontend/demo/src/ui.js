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

        const dotColor = obj.type === 'sphere'
            ? 'bg-pink-500'
            : obj.type === 'mesh'
                ? 'bg-cyan-500'
                : 'bg-amber-500';

        const triBadge = obj.type === 'mesh'
            ? `<span class="text-[10px] font-mono text-cyan-500/80 shrink-0">${(obj.geometry || MeshLibrary.getGeometry(obj.meshKey)).triangleCount}Δ</span>`
            : '';

        item.className = `p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition border ${
            isSelected
                ? 'bg-pink-500/10 border-pink-500/35 text-[var(--text-main)] font-semibold'
                : 'bg-[var(--bg-elevated)] border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
        }`;

        item.innerHTML = `
            <div class="flex items-center space-x-2 truncate">
                <span class="w-2 h-2 rounded-full shrink-0 ${dotColor}"></span>
                <span class="truncate">${obj.name}</span>
            </div>
            <div class="flex items-center space-x-1.5">
                ${triBadge}
                <button type="button" class="btn-delete text-[var(--text-muted)] hover:text-rose-500 px-1 transition">✕</button>
            </div>
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

function bindLiveSlider(id, obj, prop, labelId, decimals = 1, suffix = '') {
    const slider = document.getElementById(id);
    const label = document.getElementById(labelId);
    if (!slider) return;

    let isDragging = false;

    slider.addEventListener('input', (e) => {
        isDragging = true;
        obj[prop] = parseFloat(e.target.value);
        if (label) label.innerText = obj[prop].toFixed(decimals) + suffix;
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
            const preset = MATERIAL_PRESETS[e.target.value];
            if (preset) {
                obj.presetKey = e.target.value;
                obj.albedo = { ...preset.albedo };
                obj.specularExponent = preset.specularExponent;
                obj.refractiveIndex = preset.refractiveIndex;
                triggerRender();
            }
        });

        bindLiveSlider('insp-x', obj, 'x', 'insp-val-x', 1);
        bindLiveSlider('insp-y', obj, 'y', 'insp-val-y', 1);
        bindLiveSlider('insp-z', obj, 'z', 'insp-val-z', 1);
        bindLiveSlider('insp-r', obj, 'r', 'insp-val-r', 1);

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

    } else if (obj.type === 'mesh') {
        const geom = obj.geometry || MeshLibrary.getGeometry(obj.meshKey);
        const isCustomWall = obj.meshKey === 'custom_wall';

        inspectorContent.innerHTML = `
            <div class="space-y-3.5 text-xs">
                <div class="flex items-center justify-between">
                    <span class="font-bold text-cyan-500 truncate">${obj.name}</span>
                    <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                        ${geom.triangleCount} Δ
                    </span>
                </div>

                ${!isCustomWall ? `
                <div>
                    <label class="text-[var(--text-muted)] block mb-1 font-semibold">Геометрия (.obj):</label>
                    <select id="insp-mesh-geom" class="ui-select w-full px-3 py-1.5 text-cyan-500 font-semibold cursor-pointer">
                        ${Object.keys(MeshLibrary.BUILTIN_GEOMETRIES).map(k => `
                            <option value="${k}" ${obj.meshKey === k ? 'selected' : ''}>
                                ${MeshLibrary.BUILTIN_GEOMETRIES[k].label}
                            </option>
                        `).join('')}
                        ${obj.meshKey === 'uploaded' ? `<option value="uploaded" selected>Загруженный файл (.obj)</option>` : ''}
                    </select>
                </div>
                ` : ''}

                <div>
                    <label class="text-[var(--text-muted)] block mb-1 font-semibold">Тип материала:</label>
                    <select id="insp-material-preset" class="ui-select w-full px-3 py-1.5 text-pink-500 font-semibold cursor-pointer">
                        ${Object.keys(MATERIAL_PRESETS).map(key => `
                            <option value="${key}" ${obj.presetKey === key ? 'selected' : ''}>
                                ${MATERIAL_PRESETS[key].name}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <label class="ui-subcard p-2 flex items-center justify-between cursor-pointer">
                    <span class="text-[var(--text-main)] font-semibold">Сглаживание нормалей</span>
                    <input type="checkbox" id="insp-smooth" ${obj.smoothShading ? 'checked' : ''} class="accent-cyan-500 w-4 h-4 cursor-pointer">
                </label>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция X:</span><span id="insp-val-x" class="font-mono text-cyan-500 font-semibold">${obj.x.toFixed(1)}</span></div>
                    <input type="range" id="insp-x" min="-10" max="10" step="0.2" value="${obj.x}" class="w-full accent-cyan-500 cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция Y:</span><span id="insp-val-y" class="font-mono text-cyan-500 font-semibold">${obj.y.toFixed(1)}</span></div>
                    <input type="range" id="insp-y" min="-8" max="8" step="0.2" value="${obj.y}" class="w-full accent-cyan-500 cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция Z:</span><span id="insp-val-z" class="font-mono text-cyan-500 font-semibold">${obj.z.toFixed(1)}</span></div>
                    <input type="range" id="insp-z" min="-25" max="-3" step="0.5" value="${obj.z}" class="w-full accent-cyan-500 cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Поворот Y (Yaw):</span><span id="insp-val-roty" class="font-mono text-cyan-500 font-semibold">${Math.round(obj.rotY || 0)}°</span></div>
                    <input type="range" id="insp-roty" min="-180" max="180" step="5" value="${obj.rotY || 0}" class="w-full accent-cyan-500 cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Наклон X (Pitch):</span><span id="insp-val-rotx" class="font-mono text-cyan-500 font-semibold">${Math.round(obj.rotX || 0)}°</span></div>
                    <input type="range" id="insp-rotx" min="-90" max="90" step="5" value="${obj.rotX || 0}" class="w-full accent-cyan-500 cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Масштаб (Scale):</span><span id="insp-val-scale" class="font-mono text-cyan-500 font-semibold">${(obj.scale || 1).toFixed(1)}</span></div>
                    <input type="range" id="insp-scale" min="0.3" max="4.0" step="0.1" value="${obj.scale || 1}" class="w-full accent-cyan-500 cursor-pointer">
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

        const geomSelect = document.getElementById('insp-mesh-geom');
        if (geomSelect) {
            geomSelect.addEventListener('change', (e) => {
                if (e.target.value !== 'uploaded') {
                    obj.meshKey = e.target.value;
                    delete obj.geometry;
                    renderOutliner();
                    renderInspector();
                    triggerRender();
                }
            });
        }

        document.getElementById('insp-material-preset').addEventListener('change', (e) => {
            const preset = MATERIAL_PRESETS[e.target.value];
            if (preset) {
                obj.presetKey = e.target.value;
                obj.albedo = { ...preset.albedo };
                obj.specularExponent = preset.specularExponent;
                obj.refractiveIndex = preset.refractiveIndex;
                triggerRender();
            }
        });

        document.getElementById('insp-smooth').addEventListener('change', (e) => {
            obj.smoothShading = e.target.checked;
            triggerRender();
        });

        bindLiveSlider('insp-x', obj, 'x', 'insp-val-x', 1);
        bindLiveSlider('insp-y', obj, 'y', 'insp-val-y', 1);
        bindLiveSlider('insp-z', obj, 'z', 'insp-val-z', 1);
        bindLiveSlider('insp-roty', obj, 'rotY', 'insp-val-roty', 0, '°');
        bindLiveSlider('insp-rotx', obj, 'rotX', 'insp-val-rotx', 0, '°');
        bindLiveSlider('insp-scale', obj, 'scale', 'insp-val-scale', 1);

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

        bindLiveSlider('insp-x', obj, 'x', 'insp-val-x', 1);
        bindLiveSlider('insp-y', obj, 'y', 'insp-val-y', 1);
        bindLiveSlider('insp-z', obj, 'z', 'insp-val-z', 1);
        bindLiveSlider('insp-int', obj, 'intensity', 'insp-val-int', 1);
    }
}