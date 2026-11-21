const outlinerList = document.getElementById('outliner-list');
const outlinerCount = document.getElementById('outliner-count');
const inspectorContent = document.getElementById('inspector-content');

const stepBadge = document.getElementById('step-badge');
const stepTitle = document.getElementById('step-title');
const stepDesc = document.getElementById('step-desc');
const btnPrev = document.getElementById('btn-prev-step');
const btnNext = document.getElementById('btn-next-step');

let nextMaterialTexSlot = 0;

function renderTextureInspectorSection(obj, accentClass = 'amber-500') {
    const texType = Number(obj.textureType) || 0;
    const secColor = obj.secondaryColor || '#1e293b';
    const texScale = obj.texScale !== undefined ? Number(obj.texScale) : 2.0;
    const slotInfo = (texType === 4 && obj.textureId >= 0)
        ? window.TextureManager?.getTextureSlot(obj.textureId)
        : null;

    return `
        <div class="pt-2.5 ui-divider-t space-y-2.5">
            <div>
                <label class="text-[var(--text-muted)] block mb-1 font-semibold">Текстура поверхности:</label>
                <select id="insp-tex-type" class="ui-select w-full px-3 py-1.5 text-${accentClass} font-semibold cursor-pointer">
                    <option value="0" ${texType === 0 ? 'selected' : ''}>Сплошной цвет</option>
                    <option value="1" ${texType === 1 ? 'selected' : ''}>Процедурная: Шахматная доска</option>
                    <option value="2" ${texType === 2 ? 'selected' : ''}>Процедурная: Полосы / Волны</option>
                    <option value="3" ${texType === 3 ? 'selected' : ''}>Процедурная: Мрамор (3D-шум)</option>
                    <option value="4" ${texType === 4 ? 'selected' : ''}>Растровая картинка (UV)</option>
                </select>
            </div>

            ${texType >= 1 && texType <= 3 ? `
                <div>
                    <label class="text-[var(--text-muted)] block mb-1 font-semibold">Второй цвет узора:</label>
                    <div class="ui-subcard flex items-center space-x-3 p-1.5">
                        <input type="color" id="insp-tex-color2" value="${secColor}" class="w-7 h-7 bg-transparent border-0 cursor-pointer rounded">
                        <span id="insp-val-tex-color2" class="text-xs font-mono text-[var(--text-main)] uppercase">${secColor}</span>
                    </div>
                </div>
            ` : ''}

            ${texType === 4 ? `
                <div class="space-y-1.5">
                    <button id="btn-insp-upload-tex" type="button" class="ui-btn ui-btn-secondary w-full py-1.5 px-2.5 text-xs text-cyan-500">
                        <i class="fa-solid fa-upload"></i>
                        <span>${slotInfo ? 'Заменить картинку' : 'Выбрать изображение'}</span>
                    </button>
                    <input type="file" id="input-insp-tex-file" accept="image/*" class="hidden">
                    ${slotInfo ? `
                        <div class="ui-subcard p-1.5 flex items-center space-x-2">
                            <img src="${slotInfo.previewUrl}" alt="Текстура" class="w-8 h-8 object-cover rounded">
                            <span class="text-[10px] font-mono text-[var(--text-muted)] truncate">${slotInfo.label}</span>
                        </div>
                    ` : ''}
                </div>
            ` : ''}

            ${texType > 0 ? `
                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1">
                        <span>Масштаб / Частота:</span>
                        <span id="insp-val-tex-scale" class="font-mono text-${accentClass} font-semibold">${texScale.toFixed(1)}</span>
                    </div>
                    <input type="range" id="insp-tex-scale" min="0.2" max="12.0" step="0.2" value="${texScale}" class="w-full accent-${accentClass} cursor-pointer">
                </div>
            ` : ''}
        </div>
    `;
}

function bindTextureInspectorEvents(obj) {
    const texTypeSelect = document.getElementById('insp-tex-type');
    if (texTypeSelect) {
        texTypeSelect.addEventListener('change', (e) => {
            obj.textureType = parseInt(e.target.value, 10) || 0;
            if (!obj.secondaryColor) obj.secondaryColor = '#1e293b';
            if (obj.texScale === undefined) obj.texScale = 2.0;
            renderInspector();
            triggerRender();
        });
    }

    const color2Input = document.getElementById('insp-tex-color2');
    const color2Label = document.getElementById('insp-val-tex-color2');
    if (color2Input) {
        color2Input.addEventListener('input', (e) => {
            obj.secondaryColor = e.target.value;
            if (color2Label) color2Label.innerText = obj.secondaryColor;
            triggerRender({ interactive: true });
        });
        color2Input.addEventListener('change', (e) => {
            obj.secondaryColor = e.target.value;
            if (color2Label) color2Label.innerText = obj.secondaryColor;
            triggerRender({ interactive: false });
        });
    }

    bindLiveSlider('insp-tex-scale', obj, 'texScale', 'insp-val-tex-scale', 1);

    const uploadBtn = document.getElementById('btn-insp-upload-tex');
    const fileInput = document.getElementById('input-insp-tex-file');
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file || !window.TextureManager) return;

            if (obj.textureId === undefined || obj.textureId < 0) {
                obj.textureId = nextMaterialTexSlot;
                nextMaterialTexSlot = (nextMaterialTexSlot + 1) % 64;
            }
            await window.TextureManager.loadMaterialTexture(obj.textureId, file);
            if (typeof syncAllTracersWithTextures === 'function') {
                syncAllTracersWithTextures();
            }
            e.target.value = '';
            renderInspector();
            triggerRender();
        });
    }
}

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

        const dotColor = obj.type === 'sphere'
            ? 'bg-amber-500'
            : obj.type === 'mesh'
                ? 'bg-cyan-500'
                : 'bg-emerald-500';

        const triBadge = obj.type === 'mesh'
            ? `<span class="text-[10px] font-mono text-cyan-500/80 shrink-0">${(obj.geometry || MeshLibrary.getGeometry(obj.meshKey)).triangleCount}Δ</span>`
            : '';

        item.className = `p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition border ${
            isSelected
                ? 'bg-amber-500/10 border-amber-500/35 text-[var(--text-main)] font-semibold'
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

                ${renderTextureInspectorSection(obj, 'amber-500')}
            </div>
        `;

        document.getElementById('insp-material-preset').addEventListener('change', (e) => {
            const preset = PT_MATERIAL_PRESETS[e.target.value];
            if (preset) {
                obj.presetKey = e.target.value;
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

        bindTextureInspectorEvents(obj);

    } else if (obj.type === 'mesh') {
        const geom = obj.geometry || MeshLibrary.getGeometry(obj.meshKey);
        const isCustomWall = obj.meshKey === 'custom_wall';
        const roughnessVal = obj.roughness !== undefined ? obj.roughness : 1.0;
        const emissionVal = obj.emissionIntensity !== undefined ? obj.emissionIntensity : 0.0;

        inspectorContent.innerHTML = `
            <div class="space-y-3 text-xs">
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
                    <select id="insp-material-preset" class="ui-select w-full px-3 py-1.5 text-amber-500 font-semibold cursor-pointer">
                        ${Object.keys(PT_MATERIAL_PRESETS).map(key => `
                            <option value="${key}" ${obj.presetKey === key ? 'selected' : ''}>
                                ${PT_MATERIAL_PRESETS[key].name}
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
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Масштаб (Scale):</span><span id="insp-val-scale" class="font-mono text-cyan-500 font-semibold">${(obj.scale || 1).toFixed(1)}</span></div>
                    <input type="range" id="insp-scale" min="0.3" max="4.0" step="0.1" value="${obj.scale || 1}" class="w-full accent-cyan-500 cursor-pointer">
                </div>

                <div class="pt-2 ui-divider-t space-y-2.5">
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

                ${renderTextureInspectorSection(obj, 'amber-500')}
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
            const preset = PT_MATERIAL_PRESETS[e.target.value];
            if (preset) {
                obj.presetKey = e.target.value;
                obj.albedo = { ...preset.albedo };
                obj.specularExponent = preset.specularExponent;
                obj.refractiveIndex = preset.refractiveIndex;
                obj.roughness = preset.roughness;
                obj.emissionIntensity = preset.emissionIntensity;

                renderInspector();
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
        bindLiveSlider('insp-scale', obj, 'scale', 'insp-val-scale', 1);
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

        bindTextureInspectorEvents(obj);

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