let cppRayTracer = null;
let cppPreviewTracer = null;

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
const statusDiv = document.getElementById('wasm-status');
const timerDiv = document.getElementById('render-time');

let renderRafId = null;
let pendingInteractive = false;
let hasPendingFull = false;

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
        cppPreviewTracer &&
        nextWidth === activePreviewWidth &&
        nextHeight === activePreviewHeight
    ) {
        return {
            tracer: cppPreviewTracer,
            width: activePreviewWidth,
            height: activePreviewHeight,
            scale: activePreviewScale
        };
    }

    if (cppPreviewTracer) {
        cppPreviewTracer.delete();
        cppPreviewTracer = null;
    }

    cppPreviewTracer = new Module.RayTracer(nextWidth, nextHeight);
    previewCanvas.width = nextWidth;
    previewCanvas.height = nextHeight;
    previewImgData = previewCtx.createImageData(nextWidth, nextHeight);

    activePreviewScale = quantized;
    activePreviewWidth = nextWidth;
    activePreviewHeight = nextHeight;

    return {
        tracer: cppPreviewTracer,
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

function triggerRender(options = {}) {
    if (!cppRayTracer) return;

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
        executeRender(usePreview);
    });
}

function executeRender(usePreview = false) {
    if (!cppRayTracer) return;

    const preview = usePreview ? ensurePreviewResources(currentPreviewScale) : null;
    const tracer = preview ? preview.tracer : cppRayTracer;
    const targetWidth = preview ? preview.width : WIDTH;
    const targetHeight = preview ? preview.height : HEIGHT;
    const usedScale = preview ? preview.scale : 1.0;

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

    tracer.renderScene(fovValue, background_color, currentStepIndex, spheresVector, lightsVector);

    const metrics = tracer.getLastMetrics();

    spheresVector.delete();
    lightsVector.delete();

    const bufferPtr = tracer.getBufferPointer();
    const wasmMemory = Module.HEAPU8 ? Module.HEAPU8.buffer : Module.buffer;
    const memoryView = new Uint8ClampedArray(wasmMemory, bufferPtr, targetWidth * targetHeight * 4);

    if (preview) {
        previewImgData.data.set(memoryView);
        previewCtx.putImageData(previewImgData, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(previewCanvas, 0, 0, WIDTH, HEIGHT);
    } else {
        fullImgData.data.set(memoryView);
        ctx.putImageData(fullImgData, 0, 0);
    }

    const elapsedMs = performance.now() - t0;
    updateAdaptivePreviewScale(usedScale, elapsedMs);

    if (preview) {
        timerDiv.innerText = `Превью ${Math.round(usedScale * 100)}% (${targetWidth}×${targetHeight}): ${elapsedMs.toFixed(1)} ms`;
    } else {
        window.lastRtMetrics = metrics;
        timerDiv.innerText = `Время рендера: ${elapsedMs.toFixed(1)} ms (Wasm: ${metrics.renderTimeMs.toFixed(1)} ms | Лучей: ${metrics.totalRays.toLocaleString()})`;
        console.log('RT Metrics:', metrics);
    }
}

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

document.getElementById('btn-force-render').addEventListener('click', () => triggerRender());

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
            cppRayTracer = new Module.RayTracer(WIDTH, HEIGHT);
            ensurePreviewResources(DEFAULT_PREVIEW_SCALE);
            renderOutliner();
            updateStepUI();
            triggerRender();
        } catch (err) {
            console.error(err);
            statusDiv.innerText = "Ошибка Wasm Build";
            statusDiv.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20";
        }
    }
};