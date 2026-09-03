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

const themeBtn = document.getElementById('theme-toggle');
if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-theme');
    themeBtn.innerText = '☀️ Светлая';
}

themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    themeBtn.innerText = isLight ? '☀️ Светлая' : '🌙 Тёмная';
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
});

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
                ? 'bg-pink-200/20 border-indigo-500/50 text-[var(--text-main)] font-semibold' 
                : 'bg-white-950/60 border-gray-800/80 text-[var(--text-main)] hover:bg-gray-300/50'
        }`;

        item.innerHTML = `
            <div class="flex items-center space-x-2 truncate">
                <span class="w-2 h-2 rounded-full ${obj.type === 'sphere' ? 'bg-pink-500' : 'bg-amber-500'}"></span>
                <span class="truncate">${obj.name}</span>
            </div>
            <button class="btn-delete text-gray-500 hover:text-red-400 px-1">✕</button>
        `;

        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-delete')) {
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

function renderInspector() {
    const obj = sceneObjects.find(o => o.id === selectedObjectId);
    if (!obj) {
        inspectorContent.innerHTML = `<div class="text-xs text-[var(--text-main)] text-center py-8">Выберите объект на сцене для настройки его параметров.</div>`;
        return;
    }

    if (obj.type === 'sphere') {
        inspectorContent.innerHTML = `
            <div class="space-y-4 text-xs">
                <div class="font-bold text-pink-400">${obj.name} (Сфера)</div>
                
                <div>
                    <label class="text-[var(--text-main)] block mb-1 font-semibold">Тип материала:</label>
                    <select id="insp-material-preset" class="w-full bg-gray-950 p-2 rounded-xl border border-gray-800 text-pink-500 font-semibold cursor-pointer focus:outline-none focus:border-indigo-500">
                        ${Object.keys(MATERIAL_PRESETS).map(key => `
                            <option value="${key}" ${obj.presetKey === key ? 'selected' : ''}>
                                ${MATERIAL_PRESETS[key].name}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция X:</span><span id="insp-val-x" class="font-mono text-pink-500">${obj.x.toFixed(1)}</span></div>
                    <input type="range" id="insp-x" min="-10" max="10" step="0.2" value="${obj.x}" class="w-full accent-pink-500 cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция Y:</span><span id="insp-val-y" class="font-mono text-pink-500">${obj.y.toFixed(1)}</span></div>
                    <input type="range" id="insp-y" min="-10" max="10" step="0.2" value="${obj.y}" class="w-full accent-pink-500 cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция Z (Глубина):</span><span id="insp-val-z" class="font-mono text-pink-500">${obj.z.toFixed(1)}</span></div>
                    <input type="range" id="insp-z" min="-30" max="-2" step="0.5" value="${obj.z}" class="w-full accent-pink-500 cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Радиус:</span><span id="insp-val-r" class="font-mono text-pink-500">${obj.r.toFixed(1)}</span></div>
                    <input type="range" id="insp-r" min="0.5" max="8" step="0.2" value="${obj.r}" class="w-full accent-pink-500 cursor-pointer">
                </div>

                <div>
                    <label class="text-[var(--text-main)] block mb-1">Цвет:</label>
                    <input type="color" id="insp-color" value="${obj.color}" class="w-full h-8 bg-transparent border-0 cursor-pointer rounded">
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

        const bindSlider = (id, prop, labelId) => {
            document.getElementById(id).addEventListener('input', (e) => {
                obj[prop] = parseFloat(e.target.value);
                document.getElementById(labelId).innerText = obj[prop].toFixed(1);
                triggerRender();
            });
        };

        bindSlider('insp-x', 'x', 'insp-val-x');
        bindSlider('insp-y', 'y', 'insp-val-y');
        bindSlider('insp-z', 'z', 'insp-val-z');
        bindSlider('insp-r', 'r', 'insp-val-r');
        
        document.getElementById('insp-color').addEventListener('change', (e) => {
            obj.color = e.target.value;
            triggerRender();
        });

    } else if (obj.type === 'light') {
        inspectorContent.innerHTML = `
            <div class="space-y-4 text-xs">
                <div class="font-bold text-amber-400">${obj.name} (Источник света)</div>
                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция X:</span><span id="insp-val-x" class="font-mono text-amber-700">${obj.x.toFixed(1)}</span></div>
                    <input type="range" id="insp-x" min="-40" max="40" step="1" value="${obj.x}" class="w-full accent-amber-700 cursor-pointer">
                </div>
                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция Y:</span><span id="insp-val-y" class="font-mono text-amber-700">${obj.y.toFixed(1)}</span></div>
                    <input type="range" id="insp-y" min="-40" max="40" step="1" value="${obj.y}" class="w-full accent-amber-700 cursor-pointer">
                </div>
                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Позиция Z:</span><span id="insp-val-z" class="font-mono text-amber-700">${obj.z.toFixed(1)}</span></div>
                    <input type="range" id="insp-z" min="-40" max="40" step="1" value="${obj.z}" class="w-full accent-amber-700 cursor-pointer">
                </div>
                <div>
                    <div class="flex justify-between text-[var(--text-main)] mb-1"><span>Интенсивность:</span><span id="insp-val-int" class="font-mono text-amber-700">${obj.intensity.toFixed(1)}</span></div>
                    <input type="range" id="insp-int" min="0.1" max="5.0" step="0.1" value="${obj.intensity}" class="w-full accent-amber-700 cursor-pointer">
                </div>
            </div>
        `;

        const bindSlider = (id, prop, labelId) => {
            document.getElementById(id).addEventListener('input', (e) => {
                obj[prop] = parseFloat(e.target.value);
                document.getElementById(labelId).innerText = obj[prop].toFixed(1);
                triggerRender();
            });
        };

        bindSlider('insp-x', 'x', 'insp-val-x');
        bindSlider('insp-y', 'y', 'insp-val-y');
        bindSlider('insp-z', 'z', 'insp-val-z');
        bindSlider('insp-int', 'intensity', 'insp-val-int');
    }
}