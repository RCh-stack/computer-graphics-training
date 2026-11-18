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
const statusDiv = document.getElementById('wasm-status');
const timerDiv = document.getElementById('render-time');

let renderRafId = null;
let progressiveRafId = null;
let pendingInteractive = false;
let hasPendingFull = false;
let activeJobId = 0;

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

    if (renderedScale === 1.0) {
        currentPreviewScale = clampScale(idealScale);
        return;
    }

    if (safeMs > TARGET_PREVIEW_MS * 1.15) {
        currentPreviewScale = clampScale(currentPreviewScale * 0.35 + idealScale * 0.65);
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
}

function triggerRender(options = {}) {
    if (!cppPathTracer) return;

    const interactive = Boolean(options.interactive);
    if (interactive) {
        pendingInteractive = true;
    } else {
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
    bgColorLabel.innerText = bgColorInput.value;

    const backgroundColor = hexToVec3f(bgColorInput.value);
    const { spheresVector, lightsVector } = buildWasmSceneVectors();

    const t0 = performance.now();
    preview.tracer.reset();
    preview.tracer.setSeed(42);
    preview.tracer.renderPass(1, fovValue, backgroundColor, currentStepIndex, spheresVector, lightsVector);

    spheresVector.delete();
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
    bgColorLabel.innerText = bgColorInput.value;

    const desiredSpp = parseInt(sppInput.value, 10) || targetSpp;
    targetSpp = desiredSpp;
    sppLabel.innerText = desiredSpp;

    const effectiveGoalSpp = currentStepIndex === 0 ? Math.min(desiredSpp, 4) : desiredSpp;
    const backgroundColor = hexToVec3f(bgColorInput.value);

    cppPathTracer.reset();
    cppPathTracer.setSeed(42);

    let batchSize = 1;

    function runNextBatch() {
        if (jobId !== activeJobId || !cppPathTracer) return;

        const currentSpp = cppPathTracer.getAccumulatedSamples();
        const remaining = effectiveGoalSpp - currentSpp;

        if (remaining <= 0) {
            progressiveRafId = null;
            return;
        }

        const samplesThisPass = Math.min(remaining, batchSize);
        const { spheresVector, lightsVector } = buildWasmSceneVectors();

        const passStart = performance.now();
        cppPathTracer.renderPass(
            samplesThisPass,
            fovValue,
            backgroundColor,
            currentStepIndex,
            spheresVector,
            lightsVector
        );

        spheresVector.delete();
        lightsVector.delete();

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
        }
    }

    runNextBatch();
}

scenePresetSelect?.addEventListener('change', (e) => {
    const presetKey = e.target.value;
    const preset = PT_SCENE_PRESETS[presetKey];
    if (!preset) return;

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

window.Module = {
    onRuntimeInitialized: function() {
        statusDiv.innerText = "✓ Wasm Готов";
        statusDiv.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";

        try {
            cppPathTracer = new Module.PathTracer(WIDTH, HEIGHT);
            ensurePreviewResources(DEFAULT_PREVIEW_SCALE);
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