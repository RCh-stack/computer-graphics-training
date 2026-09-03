let cppRayTracer = null;

const canvas = document.getElementById('test-canvas');
const ctx = canvas.getContext('2d');
const imgData = ctx.createImageData(WIDTH, HEIGHT);

const fovInput = document.getElementById('param-fov');
const fovLabel = document.getElementById('val-fov');
const bgColorInput = document.getElementById('param-bg-color');
const bgColorLabel = document.getElementById('val-bg-color');
const statusDiv = document.getElementById('wasm-status');
const timerDiv = document.getElementById('render-time');

function triggerRender() {
    if (!cppRayTracer) return;

    const fovValue = parseFloat(fovInput.value);
    fovLabel.innerText = fovValue.toFixed(2);
    bgColorLabel.innerText = bgColorInput.value;

    const background_color = hexToVec3f(bgColorInput.value);

    const spheresVector = new Module.VectorSphere();
    const lightsVector = new Module.VectorLight();

    sceneObjects.forEach(obj => {
        if (obj.type === 'sphere') {
            const albedo = getStepAdaptedAlbedo(obj.albedo, currentStepIndex);
            const material = new Module.Material(
                albedo,
                hexToVec3f(obj.color),
                obj.specularExponent, 
                obj.refractiveIndex
            );

            const sphere = new Module.Sphere({ x: obj.x, y: obj.y, z: obj.z }, obj.r, material);
            spheresVector.push_back(sphere);
        } else if (obj.type === 'light') {
            const light = new Module.Light({ x: obj.x, y: obj.y, z: obj.z }, obj.intensity);
            lightsVector.push_back(light);
        }
    });

    const t0 = performance.now();

    cppRayTracer.renderScene(fovValue, background_color, currentStepIndex, spheresVector, lightsVector);

    spheresVector.delete();
    lightsVector.delete();

    const bufferPtr = cppRayTracer.getBufferPointer();
    const wasmMemory = Module.HEAPU8 ? Module.HEAPU8.buffer : Module.buffer;
    const memoryView = new Uint8ClampedArray(wasmMemory, bufferPtr, WIDTH * HEIGHT * 4);

    imgData.data.set(memoryView);
    ctx.putImageData(imgData, 0, 0);

    const t1 = performance.now();
    timerDiv.innerText = `Время рендера: ${(t1 - t0).toFixed(1)} ms`;
}

// Привязка глобальных кнопок
document.getElementById('btn-add-sphere').addEventListener('click', () => {
    const newId = "sp_" + Date.now();
    const defaultPreset = MATERIAL_PRESETS.matte;
    sceneObjects.push({
        id: newId,
        name: `Сфера ${sceneObjects.filter(o => o.type === 'sphere').length + 1}`,
        type: "sphere",
        x: 0.0, y: 0.0, z: -8.0, r: 1.5,
        color: "#ff8800",
        presetKey: "matte",
        albedo: defaultPreset.albedo,
        specularExponent: defaultPreset.specularExponent,
        refractiveIndex: defaultPreset.refractiveIndex
    });
    selectedObjectId = newId;
    renderOutliner();
    renderInspector();
    triggerRender();
});

document.getElementById('btn-add-light').addEventListener('click', () => {
    const newId = "lt_" + Date.now();
    sceneObjects.push({
        id: newId,
        name: `Свет ${sceneObjects.filter(o => o.type === 'light').length + 1}`,
        type: "light",
        x: 0.0, y: 10.0, z: 0.0,
        intensity: 1.5
    });
    selectedObjectId = newId;
    renderOutliner();
    renderInspector();
    triggerRender();
});

btnPrev.addEventListener('click', () => {
    if (currentStepIndex > 0) {
        currentStepIndex--;
        updateStepUI();
        triggerRender();
    }
});

btnNext.addEventListener('click', () => {
    if (currentStepIndex < STEPS.length - 1) {
        currentStepIndex++;
        updateStepUI();
        triggerRender();
    }
});

document.getElementById('btn-force-render').addEventListener('click', triggerRender);
fovInput.addEventListener('input', triggerRender);
bgColorInput.addEventListener('input', triggerRender);

// Инициализация модуля Emscripten
window.Module = {
    onRuntimeInitialized: function() {
        statusDiv.innerText = "✓ Wasm Готов";
        statusDiv.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20";
        
        try {
            cppRayTracer = new Module.RayTracer(WIDTH, HEIGHT);
            renderOutliner();
            updateStepUI();
            triggerRender();
        } catch (err) {
            console.error(err);
            statusDiv.innerText = "Ошибка Wasm Биндинга";
            statusDiv.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20";
        }
    }
};