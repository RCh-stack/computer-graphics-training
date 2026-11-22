let cppPathTracer = null;
let cppPreviewPathTracer = null;

const canvas = document.getElementById('test-canvas');
const ctx = canvas.getContext('2d');
const fullImgData = ctx.createImageData(WIDTH, HEIGHT);

const previewCanvas = document.createElement('canvas');
const previewCtx = previewCanvas.getContext('2d');
let previewImgData = null;

let currentPreviewScale = DEFAULT_PREVIEW_SCALE;
let activePreviewScale = 0;
let activePreviewWidth = 0;
let activePreviewHeight = 0;

const fovInput = document.getElementById('param-fov');
const fovLabel = document.getElementById('val-fov');
const bgColorInput = document.getElementById('param-bg-color');
const bgColorLabel = document.getElementById('val-bg-color');
const sppInput = document.getElementById('param-spp');
const sppLabel = document.getElementById('val-spp');
const sppProgressBar = document.getElementById('spp-progress-bar');
const scenePresetSelect = document.getElementById('scene-preset-select');
const objFileInput = document.getElementById('input-obj-file');
const statusDiv = document.getElementById('wasm-status');
const timerDiv = document.getElementById('render-time');

let renderRafId = null;
let settleTimerId = null;
let progressiveRafId = null;
let pendingInteractive = false;
let hasPendingFull = false;
let activeJobId = 0;
let activeJobVectors = null;
let addedMeshCounter = 0;

function freeActiveJobVectors() {
    if (!activeJobVectors) return;
    activeJobVectors.spheresVector.delete();
    activeJobVectors.meshesVector.delete();
    activeJobVectors.lightsVector.delete();
    activeJobVectors = null;
}

function syncAllTracersWithTextures() {
    if (!window.TextureManager) return;
    if (cppPathTracer) window.TextureManager.syncTracer(cppPathTracer);
    if (cppPreviewPathTracer) window.TextureManager.syncTracer(cppPreviewPathTracer);
}

function syncAllTracersEnvParamsOnly() {
    if (!window.TextureManager) return;
    if (cppPathTracer) window.TextureManager.syncTracerEnvironmentParamsOnly(cppPathTracer);
    if (cppPreviewPathTracer) window.TextureManager.syncTracerEnvironmentParamsOnly(cppPreviewPathTracer);
}

function clampScale(scale) {
    return Math.min(MAX_PREVIEW_SCALE, Math.max(MIN_PREVIEW_SCALE, scale));
}

function quantizeScale(scale) {
    const clamped = clampScale(scale);
    const snapped = Math.round(clamped / PREVIEW_SCALE_STEP) * PREVIEW_SCALE_STEP;
    return Number(clampScale(snapped).toFixed(2));
}

function ensurePreviewResources(targetScale) {
    const quantized = quantizeScale(targetScale);
    const nextWidth = Math.max(1, Math.round(WIDTH * quantized));
    const nextHeight = Math.max(1, Math.round(HEIGHT * quantized));

    if (
        cppPreviewPathTracer &&
        nextWidth === activePreviewWidth &&
        nextHeight === activePreviewHeight
    ) {
        return {
            tracer: cppPreviewPathTracer,
            width: activePreviewWidth,
            height: activePreviewHeight,
            scale: activePreviewScale
        };
    }

    if (cppPreviewPathTracer) {
        cppPreviewPathTracer.delete();
        cppPreviewPathTracer = null;
    }

    cppPreviewPathTracer = new Module.PathTracer(nextWidth, nextHeight);
    previewCanvas.width = nextWidth;
    previewCanvas.height = nextHeight;
    previewImgData = previewCtx.createImageData(nextWidth, nextHeight);

    activePreviewScale = quantized;
    activePreviewWidth = nextWidth;
    activePreviewHeight = nextHeight;

    syncAllTracersWithTextures();

    return {
        tracer: cppPreviewPathTracer,
        width: nextWidth,
        height: nextHeight,
        scale: quantized
    };
}

function updateAdaptivePreviewScale(renderedScale, elapsedMs) {
    const safeMs = Math.max(1, elapsedMs);
    const idealScale = renderedScale * Math.sqrt(TARGET_PREVIEW_MS / safeMs);

    if (renderedScale === 1.0 || safeMs > TARGET_PREVIEW_MS * 1.15) {
        currentPreviewScale = clampScale(idealScale);
    } else if (safeMs < TARGET_PREVIEW_MS * 0.65) {
        currentPreviewScale = clampScale(currentPreviewScale * 0.75 + idealScale * 0.25);
    }
}

function stopProgressiveRender() {
    activeJobId++;
    if (progressiveRafId !== null) {
        cancelAnimationFrame(progressiveRafId);
        progressiveRafId = null;
    }
    freeActiveJobVectors();
}

function triggerRender(options = {}) {
    if (!cppPathTracer) return;

    const interactive = Boolean(options.interactive);
    if (interactive) {
        pendingInteractive = true;
        if (settleTimerId !== null) clearTimeout(settleTimerId);
        settleTimerId = setTimeout(() => {
            settleTimerId = null;
            triggerRender({ interactive: false });
        }, 160);
    } else {
        if (settleTimerId !== null) {
            clearTimeout(settleTimerId);
            settleTimerId = null;
        }
        hasPendingFull = true;
    }

    if (renderRafId !== null) return;

    renderRafId = requestAnimationFrame(() => {
        renderRafId = null;
        const usePreview = pendingInteractive && !hasPendingFull;
        pendingInteractive = false;
        hasPendingFull = false;

        if (usePreview) {
            executeInteractivePreview();
        } else {
            startProgressiveRender();
        }
    });
}

function executeInteractivePreview() {
    if (!cppPathTracer) return;
    stopProgressiveRender();

    const preview = ensurePreviewResources(currentPreviewScale);
    const fovValue = parseFloat(fovInput.value);
    fovLabel.innerText = fovValue.toFixed(2);
    if (bgColorLabel) bgColorLabel.innerText = bgColorInput.value;

    const backgroundColor = hexToVec3f(bgColorInput.value);
    const { spheresVector, meshesVector, lightsVector } = buildWasmSceneVectors();
    const previewStep = Math.min(currentStepIndex, 1);

    const t0 = performance.now();
    preview.tracer.reset();
    preview.tracer.setSeed(42);
    preview.tracer.renderPassWithMeshes(1, fovValue, backgroundColor, previewStep, spheresVector, meshesVector, lightsVector);

    spheresVector.delete();
    meshesVector.delete();
    lightsVector.delete();

    const bufferPtr = preview.tracer.getBufferPointer();
    const wasmMemory = Module.HEAPU8 ? Module.HEAPU8.buffer : Module.buffer;
    const memoryView = new Uint8ClampedArray(wasmMemory, bufferPtr, preview.width * preview.height * 4);

    previewImgData.data.set(memoryView);
    previewCtx.putImageData(previewImgData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(previewCanvas, 0, 0, WIDTH, HEIGHT);

    const elapsedMs = performance.now() - t0;
    updateAdaptivePreviewScale(preview.scale, elapsedMs);

    timerDiv.innerText = `Превью 1 SPP (${Math.round(preview.scale * 100)}%): ${elapsedMs.toFixed(1)} ms`;
    if (sppProgressBar) sppProgressBar.style.width = '0%';
}

function startProgressiveRender() {
    if (!cppPathTracer) return;
    stopProgressiveRender();

    const jobId = activeJobId;
    const fovValue = parseFloat(fovInput.value);
    fovLabel.innerText = fovValue.toFixed(2);
    if (bgColorLabel) bgColorLabel.innerText = bgColorInput.value;

    const desiredSpp = parseInt(sppInput.value, 10) || targetSpp;
    targetSpp = desiredSpp;
    sppLabel.innerText = desiredSpp;

    const effectiveGoalSpp = currentStepIndex === 0 ? Math.min(desiredSpp, 4) : desiredSpp;
    const backgroundColor = hexToVec3f(bgColorInput.value);

    cppPathTracer.reset();
    cppPathTracer.setSeed(42);

    activeJobVectors = buildWasmSceneVectors();
    let batchSize = 1;

    function runNextBatch() {
        if (jobId !== activeJobId || !cppPathTracer || !activeJobVectors) return;

        const currentSpp = cppPathTracer.getAccumulatedSamples();
        const remaining = effectiveGoalSpp - currentSpp;

        if (remaining <= 0) {
            progressiveRafId = null;
            freeActiveJobVectors();
            return;
        }

        const samplesThisPass = Math.min(remaining, batchSize);
        const { spheresVector, meshesVector, lightsVector } = activeJobVectors;

        const passStart = performance.now();
        cppPathTracer.renderPassWithMeshes(
            samplesThisPass,
            fovValue,
            backgroundColor,
            currentStepIndex,
            spheresVector,
            meshesVector,
            lightsVector
        );

        const passMs = performance.now() - passStart;
        const updatedSpp = cppPathTracer.getAccumulatedSamples();
        const metrics = cppPathTracer.getLastMetrics();
        window.lastPtMetrics = metrics;

        const bufferPtr = cppPathTracer.getBufferPointer();
        const wasmMemory = Module.HEAPU8 ? Module.HEAPU8.buffer : Module.buffer;
        const memoryView = new Uint8ClampedArray(wasmMemory, bufferPtr, WIDTH * HEIGHT * 4);

        fullImgData.data.set(memoryView);
        ctx.putImageData(fullImgData, 0, 0);

        const pct = Math.min(100, Math.round((updatedSpp / effectiveGoalSpp) * 100));
        if (sppProgressBar) sppProgressBar.style.width = `${pct}%`;

        timerDiv.innerText = `SPP: ${updatedSpp} / ${effectiveGoalSpp} | Время: ${metrics.renderTimeMs.toFixed(1)} ms | Лучей: ${metrics.totalRays.toLocaleString()}`;

        if (passMs < 14 && batchSize < 4) {
            batchSize++;
        } else if (passMs > 40 && batchSize > 1) {
            batchSize--;
        }

        if (updatedSpp < effectiveGoalSpp) {
            progressiveRafId = requestAnimationFrame(runNextBatch);
        } else {
            progressiveRafId = null;
            freeActiveJobVectors();
        }
    }

    runNextBatch();
}

scenePresetSelect?.addEventListener('change', (e) => {
    const presetKey = e.target.value;
    const preset = PT_SCENE_PRESETS[presetKey];
    if (!preset) return;

    clearPtWasmMeshCache();
    clearPtWasmSphereCache();
    ptSceneObjects = cloneSceneObjects(preset.objects);
    selectedObjectId = null;
    fovInput.value = preset.fov.toFixed(2);
    bgColorInput.value = preset.bgColor;

    renderOutliner();
    renderInspector();
    triggerRender();
});

document.getElementById('btn-add-sphere').addEventListener('click', () => {
    const newId = "pt_sp_" + Date.now();
    const defaultPreset = PT_MATERIAL_PRESETS.matte;
    ptSceneObjects.push({
        id: newId,
        name: `Сфера ${ptSceneObjects.filter(o => o.type === 'sphere').length + 1}`,
        type: "sphere",
        x: 0.0, y: -1.5, z: -11.0, r: 1.5,
        color: "#22c55e",
        presetKey: "matte",
        albedo: { ...defaultPreset.albedo },
        specularExponent: defaultPreset.specularExponent,
        refractiveIndex: defaultPreset.refractiveIndex,
        roughness: defaultPreset.roughness,
        emissionIntensity: defaultPreset.emissionIntensity
    });
    selectedObjectId = newId;
    renderOutliner();
    renderInspector();
    triggerRender();
});

document.getElementById('btn-add-light').addEventListener('click', () => {
    const newId = "pt_lt_" + Date.now();
    ptSceneObjects.push({
        id: newId,
        name: `Свет ${ptSceneObjects.filter(o => o.type === 'light').length + 1}`,
        type: "light",
        x: 3.5, y: 7.0, z: -9.0,
        intensity: 2.0,
        radius: 1.2,
        color: "#ffffff"
    });
    selectedObjectId = newId;
    renderOutliner();
    renderInspector();
    triggerRender();
});

document.getElementById('btn-add-mesh')?.addEventListener('click', () => {
    const keys = Object.keys(MeshLibrary.BUILTIN_GEOMETRIES);
    const meshKey = keys[addedMeshCounter % keys.length];
    addedMeshCounter++;

    const newId = "pt_mesh_" + Date.now();
    const glassPreset = PT_MATERIAL_PRESETS.glass;
    ptSceneObjects.push({
        id: newId,
        name: MeshLibrary.BUILTIN_GEOMETRIES[meshKey].label,
        type: "mesh",
        meshKey,
        x: 0.0, y: -1.2, z: -10.5,
        rotX: 0, rotY: -25, rotZ: 0,
        scale: 1.8,
        smoothShading: meshKey === 'duck',
        color: "#bae6fd",
        presetKey: "glass",
        albedo: { ...glassPreset.albedo },
        specularExponent: glassPreset.specularExponent,
        refractiveIndex: glassPreset.refractiveIndex,
        roughness: glassPreset.roughness,
        emissionIntensity: glassPreset.emissionIntensity
    });
    selectedObjectId = newId;
    renderOutliner();
    renderInspector();
    triggerRender();
});

document.getElementById('btn-upload-obj')?.addEventListener('click', () => {
    objFileInput?.click();
});

objFileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        const parsed = MeshLibrary.parseObjText(String(reader.result || ''), { normalize: true });
        if (parsed.triangleCount === 0) {
            window.Toast?.error('Ошибка .obj', 'Не удалось прочитать вершины или треугольники из файла');
            return;
        }

        const newId = "pt_mesh_obj_" + Date.now();
        const glassPreset = PT_MATERIAL_PRESETS.glass;
        ptSceneObjects.push({
            id: newId,
            name: file.name,
            type: "mesh",
            meshKey: "uploaded",
            geometry: parsed,
            x: 0.0, y: -1.2, z: -10.5,
            rotX: 0, rotY: 0, rotZ: 0,
            scale: 1.8,
            smoothShading: true,
            color: "#e0f2fe",
            presetKey: "glass",
            albedo: { ...glassPreset.albedo },
            specularExponent: glassPreset.specularExponent,
            refractiveIndex: glassPreset.refractiveIndex,
            roughness: glassPreset.roughness,
            emissionIntensity: glassPreset.emissionIntensity
        });
        selectedObjectId = newId;
        renderOutliner();
        renderInspector();
        triggerRender();
        window.Toast?.success('Модель загружена', `${file.name}: ${parsed.triangleCount} треугольников`);
    };
    reader.readAsText(file);
    e.target.value = '';
});

btnPrev.addEventListener('click', () => {
    if (currentStepIndex > 0) {
        currentStepIndex--;
        updateStepUI();
        triggerRender();
    }
});

btnNext.addEventListener('click', () => {
    if (currentStepIndex < PT_STEPS.length - 1) {
        currentStepIndex++;
        updateStepUI();
        triggerRender();
    }
});

document.getElementById('btn-force-render').addEventListener('click', () => triggerRender());

sppInput.addEventListener('input', () => {
    sppLabel.innerText = sppInput.value;
});
sppInput.addEventListener('change', () => triggerRender());

fovInput.addEventListener('input', () => triggerRender({ interactive: true }));
fovInput.addEventListener('change', () => triggerRender({ interactive: false }));
fovInput.addEventListener('pointerup', () => triggerRender({ interactive: false }));

bgColorInput.addEventListener('input', () => triggerRender({ interactive: true }));
bgColorInput.addEventListener('change', () => triggerRender({ interactive: false }));
bgColorInput.addEventListener('pointerup', () => triggerRender({ interactive: false }));

function bindEnvironmentControls() {
    const bgModeSelect = document.getElementById('param-bg-mode');
    const bgColorGroup = document.getElementById('bg-color-group');
    const bgEnvGroup = document.getElementById('bg-env-group');
    const btnUploadEnv = document.getElementById('btn-upload-env');
    const inputEnvFile = document.getElementById('input-env-file');
    const envPreviewImg = document.getElementById('env-preview-img');
    const envPreviewLabel = document.getElementById('env-preview-label');
    const envRotInput = document.getElementById('param-env-rot');
    const envRotLabel = document.getElementById('val-env-rot');
    const envIntInput = document.getElementById('param-env-int');
    const envIntLabel = document.getElementById('val-env-int');

    if (!bgModeSelect || !window.TextureManager) return;

    const refreshEnvPreview = () => {
        const st = window.TextureManager.getEnvironmentState();
        if (envPreviewImg && st.previewUrl) envPreviewImg.src = st.previewUrl;
        if (envPreviewLabel) envPreviewLabel.innerText = st.label;
    };

    bgModeSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'color') {
            window.TextureManager.setSolidBackground();
            bgColorGroup?.classList.remove('hidden');
            bgEnvGroup?.classList.add('hidden');
            syncAllTracersWithTextures();
            triggerRender();
        } else if (val.startsWith('preset:')) {
            const presetKey = val.split(':')[1];
            window.TextureManager.setPresetEnvironment(presetKey);
            bgColorGroup?.classList.add('hidden');
            bgEnvGroup?.classList.remove('hidden');
            refreshEnvPreview();
            syncAllTracersWithTextures();
            triggerRender();
        } else if (val === 'custom') {
            bgColorGroup?.classList.add('hidden');
            bgEnvGroup?.classList.remove('hidden');
            const st = window.TextureManager.getEnvironmentState();
            if (st.mode !== 'custom') {
                inputEnvFile?.click();
            } else {
                window.TextureManager.updateEnvironmentParams({});
                refreshEnvPreview();
                syncAllTracersWithTextures();
                triggerRender();
            }
        }
    });

    btnUploadEnv?.addEventListener('click', () => inputEnvFile?.click());

    inputEnvFile?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await window.TextureManager.loadCustomEnvironment(file);
        bgModeSelect.value = 'custom';
        bgColorGroup?.classList.add('hidden');
        bgEnvGroup?.classList.remove('hidden');
        refreshEnvPreview();
        syncAllTracersWithTextures();
        triggerRender();
        e.target.value = '';
    });

    const handleEnvSlider = (interactive) => {
        const rot = envRotInput ? parseFloat(envRotInput.value) : 0;
        const intensity = envIntInput ? parseFloat(envIntInput.value) : 1.0;
        if (envRotLabel) envRotLabel.innerText = `${Math.round(rot)}°`;
        if (envIntLabel) envIntLabel.innerText = intensity.toFixed(1);
        window.TextureManager.updateEnvironmentParams({ rotationDeg: rot, intensity });
        syncAllTracersEnvParamsOnly();
        triggerRender({ interactive });
    };

    envRotInput?.addEventListener('input', () => handleEnvSlider(true));
    envRotInput?.addEventListener('change', () => handleEnvSlider(false));
    envRotInput?.addEventListener('pointerup', () => handleEnvSlider(false));

    envIntInput?.addEventListener('input', () => handleEnvSlider(true));
    envIntInput?.addEventListener('change', () => handleEnvSlider(false));
    envIntInput?.addEventListener('pointerup', () => handleEnvSlider(false));
}

bindEnvironmentControls();

window.Module = {
    onRuntimeInitialized: function() {
        statusDiv.innerText = "✓ Wasm Готов";
        statusDiv.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";

        try {
            cppPathTracer = new Module.PathTracer(WIDTH, HEIGHT);
            ensurePreviewResources(DEFAULT_PREVIEW_SCALE);
            syncAllTracersWithTextures();
            renderOutliner();
            updateStepUI();
            triggerRender();
        } catch (error) {
            console.error(error);
            statusDiv.innerText = "Ошибка Wasm Build";
            statusDiv.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20";
        }
    }
};