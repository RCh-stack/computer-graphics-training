let cppDistributionTracer = null;
let cppPreviewDistributionTracer = null;

const drtCanvas = document.getElementById('test-canvas');
const drtCtx = drtCanvas.getContext('2d');
const drtFullImgData = drtCtx.createImageData(DRT_WIDTH, DRT_HEIGHT);

const drtPreviewCanvas = document.createElement('canvas');
const drtPreviewCtx = drtPreviewCanvas.getContext('2d');
let drtPreviewImgData = null;

let drtCurrentPreviewScale = DRT_DEFAULT_PREVIEW_SCALE;
let drtActivePreviewScale = 0;
let drtActivePreviewWidth = 0;
let drtActivePreviewHeight = 0;

const drtFovInput = document.getElementById('param-fov');
const drtFovLabel = document.getElementById('val-fov');
const drtApertureInput = document.getElementById('param-aperture');
const drtApertureLabel = document.getElementById('val-aperture');
const drtFocusInput = document.getElementById('param-focus');
const drtFocusLabel = document.getElementById('val-focus');
const drtBgColorInput = document.getElementById('param-bg-color');
const drtBgColorLabel = document.getElementById('val-bg-color');
const drtSppInput = document.getElementById('param-spp');
const drtSppLabel = document.getElementById('val-spp');
const drtSppProgressBar = document.getElementById('spp-progress-bar');
const drtScenePresetSelect = document.getElementById('scene-preset-select');
const drtObjFileInput = document.getElementById('input-obj-file');
const drtStatusDiv = document.getElementById('wasm-status');
const drtTimerDiv = document.getElementById('render-time');

let drtRenderRafId = null;
let drtSettleTimerId = null;
let drtProgressiveRafId = null;
let drtPendingInteractive = false;
let drtHasPendingFull = false;
let drtActiveJobId = 0;
let drtActiveJobVectors = null;
let drtAddedMeshCounter = 0;

function freeDrtActiveJobVectors() {
    if (!drtActiveJobVectors) return;
    drtActiveJobVectors.spheresVector.delete();
    drtActiveJobVectors.meshesVector.delete();
    drtActiveJobVectors.lightsVector.delete();
    drtActiveJobVectors = null;
}

function syncDrtTracersWithTextures() {
    if (!window.TextureManager) return;
    if (cppDistributionTracer) window.TextureManager.syncTracer(cppDistributionTracer);
    if (cppPreviewDistributionTracer) window.TextureManager.syncTracer(cppPreviewDistributionTracer);
}

function syncDrtTracersEnvParamsOnly() {
    if (!window.TextureManager) return;
    if (cppDistributionTracer) window.TextureManager.syncTracerEnvironmentParamsOnly(cppDistributionTracer);
    if (cppPreviewDistributionTracer) window.TextureManager.syncTracerEnvironmentParamsOnly(cppPreviewDistributionTracer);
}

function clampDrtScale(scale) {
    return Math.min(DRT_MAX_PREVIEW_SCALE, Math.max(DRT_MIN_PREVIEW_SCALE, scale));
}

function quantizeDrtScale(scale) {
    const clamped = clampDrtScale(scale);
    const snapped = Math.round(clamped / DRT_PREVIEW_SCALE_STEP) * DRT_PREVIEW_SCALE_STEP;
    return Number(clampDrtScale(snapped).toFixed(2));
}

function ensureDrtPreviewResources(targetScale) {
    const quantized = quantizeDrtScale(targetScale);
    const nextWidth = Math.max(1, Math.round(DRT_WIDTH * quantized));
    const nextHeight = Math.max(1, Math.round(DRT_HEIGHT * quantized));

    if (
        cppPreviewDistributionTracer &&
        nextWidth === drtActivePreviewWidth &&
        nextHeight === drtActivePreviewHeight
    ) {
        return {
            tracer: cppPreviewDistributionTracer,
            width: drtActivePreviewWidth,
            height: drtActivePreviewHeight,
            scale: drtActivePreviewScale
        };
    }

    if (cppPreviewDistributionTracer) {
        cppPreviewDistributionTracer.delete();
        cppPreviewDistributionTracer = null;
    }

    cppPreviewDistributionTracer = new Module.DistributionRayTracer(nextWidth, nextHeight);
    drtPreviewCanvas.width = nextWidth;
    drtPreviewCanvas.height = nextHeight;
    drtPreviewImgData = drtPreviewCtx.createImageData(nextWidth, nextHeight);

    drtActivePreviewScale = quantized;
    drtActivePreviewWidth = nextWidth;
    drtActivePreviewHeight = nextHeight;

    syncDrtTracersWithTextures();

    return {
        tracer: cppPreviewDistributionTracer,
        width: nextWidth,
        height: nextHeight,
        scale: quantized
    };
}

function updateDrtAdaptivePreviewScale(renderedScale, elapsedMs) {
    const safeMs = Math.max(1, elapsedMs);
    const idealScale = renderedScale * Math.sqrt(DRT_TARGET_PREVIEW_MS / safeMs);

    if (renderedScale === 1.0 || safeMs > DRT_TARGET_PREVIEW_MS * 1.15) {
        drtCurrentPreviewScale = clampDrtScale(idealScale);
    } else if (safeMs < DRT_TARGET_PREVIEW_MS * 0.65) {
        drtCurrentPreviewScale = clampDrtScale(drtCurrentPreviewScale * 0.75 + idealScale * 0.25);
    }
}

function stopDrtProgressiveRender() {
    drtActiveJobId++;
    if (drtProgressiveRafId !== null) {
        cancelAnimationFrame(drtProgressiveRafId);
        drtProgressiveRafId = null;
    }
    freeDrtActiveJobVectors();
}

function triggerDrtRender(options = {}) {
    if (!cppDistributionTracer) return;

    const interactive = Boolean(options.interactive);
    if (interactive) {
        drtPendingInteractive = true;
        if (drtSettleTimerId !== null) clearTimeout(drtSettleTimerId);
        drtSettleTimerId = setTimeout(() => {
            drtSettleTimerId = null;
            triggerDrtRender({ interactive: false });
        }, 160);
    } else {
        if (drtSettleTimerId !== null) {
            clearTimeout(drtSettleTimerId);
            drtSettleTimerId = null;
        }
        drtHasPendingFull = true;
    }

    if (drtRenderRafId !== null) return;

    drtRenderRafId = requestAnimationFrame(() => {
        drtRenderRafId = null;
        const usePreview = drtPendingInteractive && !drtHasPendingFull;
        drtPendingInteractive = false;
        drtHasPendingFull = false;

        if (usePreview) {
            executeDrtInteractivePreview();
        } else {
            startDrtProgressiveRender();
        }
    });
}

function executeDrtInteractivePreview() {
    if (!cppDistributionTracer) return;
    stopDrtProgressiveRender();

    const preview = ensureDrtPreviewResources(drtCurrentPreviewScale);
    const fovValue = parseFloat(drtFovInput.value);
    drtFovLabel.innerText = fovValue.toFixed(2);
    if (drtBgColorLabel) drtBgColorLabel.innerText = drtBgColorInput.value;

    const backgroundColor = drtHexToVec3f(drtBgColorInput.value);
    const { spheresVector, meshesVector, lightsVector } = buildDrtWasmSceneVectors();
    const previewStep = Math.min(drtCurrentStepIndex, 1);

    const t0 = performance.now();
    preview.tracer.reset();
    preview.tracer.setSeed(42);
    preview.tracer.setCameraLens(drtAperture, drtFocalDistance);
    preview.tracer.renderPassWithMeshes(1, fovValue, backgroundColor, previewStep, spheresVector, meshesVector, lightsVector);

    spheresVector.delete();
    meshesVector.delete();
    lightsVector.delete();

    const wasmMemory = Module.HEAPU8?.buffer || Module.buffer;
    if (!wasmMemory) return;

    const bufferPtr = preview.tracer.getBufferPointer();
    const memoryView = new Uint8ClampedArray(wasmMemory, bufferPtr, preview.width * preview.height * 4);

    drtPreviewImgData.data.set(memoryView);
    drtPreviewCtx.putImageData(drtPreviewImgData, 0, 0);
    drtCtx.imageSmoothingEnabled = true;
    drtCtx.drawImage(drtPreviewCanvas, 0, 0, DRT_WIDTH, DRT_HEIGHT);

    const elapsedMs = performance.now() - t0;
    updateDrtAdaptivePreviewScale(preview.scale, elapsedMs);

    drtTimerDiv.innerText = `Превью 1 SPP (${Math.round(preview.scale * 100)}%): ${elapsedMs.toFixed(1)} ms`;
    if (drtSppProgressBar) drtSppProgressBar.style.width = '0%';
}

function startDrtProgressiveRender() {
    if (!cppDistributionTracer) return;
    stopDrtProgressiveRender();

    const jobId = drtActiveJobId;
    const fovValue = parseFloat(drtFovInput.value);
    drtFovLabel.innerText = fovValue.toFixed(2);
    if (drtBgColorLabel) drtBgColorLabel.innerText = drtBgColorInput.value;

    const desiredSpp = parseInt(drtSppInput.value, 10) || drtTargetSpp;
    drtTargetSpp = desiredSpp;
    drtSppLabel.innerText = desiredSpp;

    const effectiveGoalSpp = desiredSpp;
    const backgroundColor = drtHexToVec3f(drtBgColorInput.value);

    cppDistributionTracer.reset();
    cppDistributionTracer.setSeed(42);
    cppDistributionTracer.setCameraLens(drtAperture, drtFocalDistance);

    drtActiveJobVectors = buildDrtWasmSceneVectors();
    let batchSize = 1;

    function runNextBatch() {
        if (jobId !== drtActiveJobId || !cppDistributionTracer || !drtActiveJobVectors) return;

        const currentSpp = cppDistributionTracer.getAccumulatedSamples();
        const remaining = effectiveGoalSpp - currentSpp;

        if (remaining <= 0) {
            drtProgressiveRafId = null;
            freeDrtActiveJobVectors();
            return;
        }

        const samplesThisPass = Math.min(remaining, batchSize);
        const { spheresVector, meshesVector, lightsVector } = drtActiveJobVectors;

        const passStart = performance.now();
        cppDistributionTracer.renderPassWithMeshes(
            samplesThisPass,
            fovValue,
            backgroundColor,
            drtCurrentStepIndex,
            spheresVector,
            meshesVector,
            lightsVector
        );

        const passMs = performance.now() - passStart;
        const updatedSpp = cppDistributionTracer.getAccumulatedSamples();
        const metrics = cppDistributionTracer.getLastMetrics();
        window.lastDrtMetrics = metrics;

        const wasmMemory = Module.HEAPU8?.buffer || Module.buffer;
        if (!wasmMemory) return;

        const bufferPtr = cppDistributionTracer.getBufferPointer();
        const memoryView = new Uint8ClampedArray(wasmMemory, bufferPtr, DRT_WIDTH * DRT_HEIGHT * 4);

        drtFullImgData.data.set(memoryView);
        drtCtx.putImageData(drtFullImgData, 0, 0);

        const pct = Math.min(100, Math.round((updatedSpp / effectiveGoalSpp) * 100));
        if (drtSppProgressBar) drtSppProgressBar.style.width = `${pct}%`;

        drtTimerDiv.innerText = `SPP: ${updatedSpp} / ${effectiveGoalSpp} | Время: ${metrics.renderTimeMs.toFixed(1)} ms | Лучей: ${metrics.totalRays.toLocaleString()}`;

        if (passMs < 14 && batchSize < 4) {
            batchSize++;
        } else if (passMs > 40 && batchSize > 1) {
            batchSize--;
        }

        if (updatedSpp < effectiveGoalSpp) {
            drtProgressiveRafId = requestAnimationFrame(runNextBatch);
        } else {
            drtProgressiveRafId = null;
            freeDrtActiveJobVectors();
        }
    }

    runNextBatch();
}

drtScenePresetSelect?.addEventListener('change', (e) => {
    const presetKey = e.target.value;
    const preset = DRT_SCENE_PRESETS[presetKey];
    if (!preset) return;

    clearDrtWasmMeshCache();
    clearDrtWasmSphereCache();
    drtSceneObjects = cloneDrtSceneObjects(preset.objects);
    drtSelectedObjectId = null;

    drtFovInput.value = preset.fov.toFixed(2);
    drtBgColorInput.value = preset.bgColor;

    drtAperture = preset.aperture !== undefined ? preset.aperture : 0.18;
    drtFocalDistance = preset.focalDistance !== undefined ? preset.focalDistance : 11.0;

    if (drtApertureInput) drtApertureInput.value = drtAperture.toFixed(2);
    if (drtApertureLabel) drtApertureLabel.innerText = drtAperture.toFixed(2);
    if (drtFocusInput) drtFocusInput.value = drtFocalDistance.toFixed(1);
    if (drtFocusLabel) drtFocusLabel.innerText = drtFocalDistance.toFixed(1);

    renderDrtOutliner();
    renderDrtInspector();
    triggerDrtRender();
});

document.getElementById('btn-add-sphere').addEventListener('click', () => {
    const newId = "drt_sp_" + Date.now();
    const defaultPreset = DRT_MATERIAL_PRESETS.satin_metal;
    drtSceneObjects.push({
        id: newId,
        name: `Сфера ${drtSceneObjects.filter(o => o.type === 'sphere').length + 1}`,
        type: "sphere",
        x: 0.0, y: -1.5, z: -11.5, r: 1.6,
        color: "#a855f7",
        presetKey: "satin_metal",
        albedo: { ...defaultPreset.albedo },
        specularExponent: defaultPreset.specularExponent,
        refractiveIndex: defaultPreset.refractiveIndex,
        roughness: defaultPreset.roughness,
        emissionIntensity: defaultPreset.emissionIntensity
    });
    drtSelectedObjectId = newId;
    renderDrtOutliner();
    renderDrtInspector();
    triggerDrtRender();
});

document.getElementById('btn-add-light').addEventListener('click', () => {
    const newId = "drt_lt_" + Date.now();
    drtSceneObjects.push({
        id: newId,
        name: `Свет ${drtSceneObjects.filter(o => o.type === 'light').length + 1}`,
        type: "light",
        x: 3.5, y: 7.5, z: -9.0,
        intensity: 1.8,
        radius: 1.4,
        color: "#ffffff"
    });
    drtSelectedObjectId = newId;
    renderDrtOutliner();
    renderDrtInspector();
    triggerDrtRender();
});

document.getElementById('btn-add-mesh')?.addEventListener('click', () => {
    const keys = Object.keys(MeshLibrary.BUILTIN_GEOMETRIES);
    const meshKey = keys[drtAddedMeshCounter % keys.length];
    drtAddedMeshCounter++;

    const newId = "drt_mesh_" + Date.now();
    const glassPreset = DRT_MATERIAL_PRESETS.crystal_glass;
    drtSceneObjects.push({
        id: newId,
        name: MeshLibrary.BUILTIN_GEOMETRIES[meshKey].label,
        type: "mesh",
        meshKey,
        x: 0.0, y: -1.2, z: -11.5,
        rotX: 0, rotY: -25, rotZ: 0,
        scale: 1.8,
        smoothShading: meshKey === 'duck',
        color: "#bae6fd",
        presetKey: "crystal_glass",
        albedo: { ...glassPreset.albedo },
        specularExponent: glassPreset.specularExponent,
        refractiveIndex: glassPreset.refractiveIndex,
        roughness: glassPreset.roughness,
        emissionIntensity: glassPreset.emissionIntensity
    });
    drtSelectedObjectId = newId;
    renderDrtOutliner();
    renderDrtInspector();
    triggerDrtRender();
});

document.getElementById('btn-upload-obj')?.addEventListener('click', () => {
    drtObjFileInput?.click();
});

drtObjFileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        const parsed = MeshLibrary.parseObjText(String(reader.result || ''), { normalize: true });
        if (parsed.triangleCount === 0) {
            window.Toast?.error('Ошибка .obj', 'Не удалось прочитать вершины или треугольники из файла');
            return;
        }

        const newId = "drt_mesh_obj_" + Date.now();
        const glassPreset = DRT_MATERIAL_PRESETS.crystal_glass;
        drtSceneObjects.push({
            id: newId,
            name: file.name,
            type: "mesh",
            meshKey: "uploaded",
            geometry: parsed,
            x: 0.0, y: -1.2, z: -11.5,
            rotX: 0, rotY: 0, rotZ: 0,
            scale: 1.8,
            smoothShading: true,
            color: "#e0f2fe",
            presetKey: "crystal_glass",
            albedo: { ...glassPreset.albedo },
            specularExponent: glassPreset.specularExponent,
            refractiveIndex: glassPreset.refractiveIndex,
            roughness: glassPreset.roughness,
            emissionIntensity: glassPreset.emissionIntensity
        });
        drtSelectedObjectId = newId;
        renderDrtOutliner();
        renderDrtInspector();
        triggerDrtRender();
        window.Toast?.success('Модель загружена', `${file.name}: ${parsed.triangleCount} треугольников`);
    };
    reader.readAsText(file);
    e.target.value = '';
});

drtBtnPrev.addEventListener('click', () => {
    if (drtCurrentStepIndex > 0) {
        drtCurrentStepIndex--;
        updateDrtStepUI();
        triggerDrtRender();
    }
});

drtBtnNext.addEventListener('click', () => {
    if (drtCurrentStepIndex < DRT_STEPS.length - 1) {
        drtCurrentStepIndex++;
        updateDrtStepUI();
        triggerDrtRender();
    }
});

document.getElementById('btn-force-render').addEventListener('click', () => triggerDrtRender());

drtSppInput.addEventListener('input', () => {
    drtSppLabel.innerText = drtSppInput.value;
});
drtSppInput.addEventListener('change', () => triggerDrtRender());

drtFovInput.addEventListener('input', () => triggerDrtRender({ interactive: true }));
drtFovInput.addEventListener('change', () => triggerDrtRender({ interactive: false }));
drtFovInput.addEventListener('pointerup', () => triggerDrtRender({ interactive: false }));

drtApertureInput?.addEventListener('input', () => {
    drtAperture = parseFloat(drtApertureInput.value);
    if (drtApertureLabel) drtApertureLabel.innerText = drtAperture.toFixed(2);
    triggerDrtRender({ interactive: true });
});
drtApertureInput?.addEventListener('change', () => triggerDrtRender({ interactive: false }));
drtApertureInput?.addEventListener('pointerup', () => triggerDrtRender({ interactive: false }));

drtFocusInput?.addEventListener('input', () => {
    drtFocalDistance = parseFloat(drtFocusInput.value);
    if (drtFocusLabel) drtFocusLabel.innerText = drtFocalDistance.toFixed(1);
    triggerDrtRender({ interactive: true });
});
drtFocusInput?.addEventListener('change', () => triggerDrtRender({ interactive: false }));
drtFocusInput?.addEventListener('pointerup', () => triggerDrtRender({ interactive: false }));

drtBgColorInput.addEventListener('input', () => triggerDrtRender({ interactive: true }));
drtBgColorInput.addEventListener('change', () => triggerDrtRender({ interactive: false }));
drtBgColorInput.addEventListener('pointerup', () => triggerDrtRender({ interactive: false }));

function bindDrtEnvironmentControls() {
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
            syncDrtTracersWithTextures();
            triggerDrtRender();
        } else if (val.startsWith('preset:')) {
            const presetKey = val.split(':')[1];
            window.TextureManager.setPresetEnvironment(presetKey);
            bgColorGroup?.classList.add('hidden');
            bgEnvGroup?.classList.remove('hidden');
            refreshEnvPreview();
            syncDrtTracersWithTextures();
            triggerDrtRender();
        } else if (val === 'custom') {
            bgColorGroup?.classList.add('hidden');
            bgEnvGroup?.classList.remove('hidden');
            const st = window.TextureManager.getEnvironmentState();
            if (st.mode !== 'custom') {
                inputEnvFile?.click();
            } else {
                window.TextureManager.updateEnvironmentParams({});
                refreshEnvPreview();
                syncDrtTracersWithTextures();
                triggerDrtRender();
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
        syncDrtTracersWithTextures();
        triggerDrtRender();
        e.target.value = '';
    });

    const handleEnvSlider = (interactive) => {
        const rot = envRotInput ? parseFloat(envRotInput.value) : 0;
        const intensity = envIntInput ? parseFloat(envIntInput.value) : 1.0;
        if (envRotLabel) envRotLabel.innerText = `${Math.round(rot)}°`;
        if (envIntLabel) envIntLabel.innerText = intensity.toFixed(1);
        window.TextureManager.updateEnvironmentParams({ rotationDeg: rot, intensity });
        syncDrtTracersEnvParamsOnly();
        triggerDrtRender({ interactive });
    };

    envRotInput?.addEventListener('input', () => handleEnvSlider(true));
    envRotInput?.addEventListener('change', () => handleEnvSlider(false));
    envRotInput?.addEventListener('pointerup', () => handleEnvSlider(false));

    envIntInput?.addEventListener('input', () => handleEnvSlider(true));
    envIntInput?.addEventListener('change', () => handleEnvSlider(false));
    envIntInput?.addEventListener('pointerup', () => handleEnvSlider(false));
}

bindDrtEnvironmentControls();

window.Module = {
    onRuntimeInitialized: function() {
        drtStatusDiv.innerText = "✓ Wasm Готов";
        drtStatusDiv.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";

        try {
            cppDistributionTracer = new Module.DistributionRayTracer(DRT_WIDTH, DRT_HEIGHT);
            ensureDrtPreviewResources(DRT_DEFAULT_PREVIEW_SCALE);
            syncDrtTracersWithTextures();
            renderDrtOutliner();
            updateDrtStepUI();
            triggerDrtRender();
        } catch (error) {
            console.error(error);
            drtStatusDiv.innerText = "Ошибка Wasm Build";
            drtStatusDiv.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20";
        }
    }
};