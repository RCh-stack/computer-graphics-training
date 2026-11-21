window.TextureManager = (() => {
    const MAX_ENV_WIDTH = 2048;
    const MAX_TEX_SIZE = 1024;

    const envState = {
        mode: 'color',
        presetKey: 'studio',
        enabled: false,
        intensity: 1.0,
        rotationDeg: 0,
        width: 0,
        height: 0,
        pixels: null,
        label: 'Сплошной цвет',
        previewUrl: ''
    };

    const textureSlots = new Map();
    const presetCache = new Map();

    function createCanvas(w, h) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        return canvas;
    }

    async function decodeFileToRgba(file, maxDimension) {
        let source = null;
        let objectUrl = null;
        let srcW = 0;
        let srcH = 0;

        try {
            if (typeof createImageBitmap === 'function') {
                source = await createImageBitmap(file);
                srcW = source.width;
                srcH = source.height;
            } else {
                objectUrl = URL.createObjectURL(file);
                source = await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = objectUrl;
                });
                srcW = source.naturalWidth || source.width;
                srcH = source.naturalHeight || source.height;
            }

            let targetW = srcW;
            let targetH = srcH;
            if (targetW > maxDimension || targetH > maxDimension) {
                const scale = maxDimension / Math.max(targetW, targetH);
                targetW = Math.max(1, Math.round(targetW * scale));
                targetH = Math.max(1, Math.round(targetH * scale));
            }

            const canvas = createCanvas(targetW, targetH);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(source, 0, 0, targetW, targetH);

            const imgData = ctx.getImageData(0, 0, targetW, targetH);
            const pixels = new Uint8Array(
                imgData.data.buffer,
                imgData.data.byteOffset,
                imgData.data.byteLength
            );

            const prevW = Math.min(240, targetW);
            const prevH = Math.max(1, Math.round((prevW / targetW) * targetH));
            const prevCanvas = createCanvas(prevW, prevH);
            prevCanvas.getContext('2d').drawImage(canvas, 0, 0, prevW, prevH);

            return {
                width: targetW,
                height: targetH,
                pixels,
                previewUrl: prevCanvas.toDataURL('image/jpeg', 0.8)
            };
        } finally {
            if (source && typeof source.close === 'function') {
                source.close();
            }
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        }
    }

    function buildPresetPanorama(presetKey, width = 1024, height = 512) {
        const cacheKey = `${presetKey}_${width}x${height}`;
        if (presetCache.has(cacheKey)) {
            return presetCache.get(cacheKey);
        }

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        if (presetKey === 'horizon') {
            const grad = ctx.createLinearGradient(0, 0, 0, height);
            grad.addColorStop(0.0, '#0c4a6e');
            grad.addColorStop(0.42, '#38bdf8');
            grad.addColorStop(0.50, '#fef3c7');
            grad.addColorStop(0.52, '#78716c');
            grad.addColorStop(1.0, '#292524');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);

            const sunX = width * 0.62;
            const sunY = height * 0.34;
            const sunGrad = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, height * 0.22);
            sunGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
            sunGrad.addColorStop(0.18, 'rgba(254, 240, 138, 0.95)');
            sunGrad.addColorStop(0.5, 'rgba(253, 186, 116, 0.35)');
            sunGrad.addColorStop(1.0, 'rgba(253, 186, 116, 0.0)');
            ctx.fillStyle = sunGrad;
            ctx.fillRect(0, 0, width, height);
        } else if (presetKey === 'grid') {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, width, height);

            const cols = 24;
            const rows = 12;
            const cellW = width / cols;
            const cellH = height / rows;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if ((r + c) % 2 === 0) {
                        ctx.fillStyle = r < rows / 2 ? '#1e293b' : '#172554';
                        ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
                    }
                }
            }

            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            for (let c = 0; c <= cols; c++) {
                ctx.beginPath();
                ctx.moveTo(c * cellW, 0);
                ctx.lineTo(c * cellW, height);
                ctx.stroke();
            }
            for (let r = 0; r <= rows; r++) {
                ctx.beginPath();
                ctx.moveTo(0, r * cellH);
                ctx.lineTo(width, r * cellH);
                ctx.stroke();
            }

            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, height * 0.5);
            ctx.lineTo(width, height * 0.5);
            ctx.stroke();
        } else {
            const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
            bgGrad.addColorStop(0.0, '#1e293b');
            bgGrad.addColorStop(0.55, '#0f172a');
            bgGrad.addColorStop(1.0, '#020617');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, width, height);

            const panels = [
                { x: 0.14, y: 0.16, w: 0.18, h: 0.16, color: '#ffffff' },
                { x: 0.44, y: 0.08, w: 0.24, h: 0.14, color: '#f8fafc' },
                { x: 0.76, y: 0.20, w: 0.16, h: 0.20, color: '#bae6fd' },
                { x: 0.28, y: 0.34, w: 0.10, h: 0.12, color: '#fde68a' }
            ];

            panels.forEach(p => {
                ctx.save();
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 28;
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x * width, p.y * height, p.w * width, p.h * height);
                ctx.restore();
            });
        }

        const imgData = ctx.getImageData(0, 0, width, height);
        const pixels = new Uint8Array(
            imgData.data.buffer,
            imgData.data.byteOffset,
            imgData.data.byteLength
        );

        const result = {
            width,
            height,
            pixels,
            previewUrl: canvas.toDataURL('image/jpeg', 0.82)
        };
        presetCache.set(cacheKey, result);
        return result;
    }

    function setSolidBackground() {
        envState.mode = 'color';
        envState.enabled = false;
        envState.label = 'Сплошной цвет';
    }

    function setPresetEnvironment(presetKey) {
        const names = {
            studio: 'Студийный софтбокс',
            horizon: 'Солнечный горизонт',
            grid: 'Координатная сфера 360°'
        };
        const data = buildPresetPanorama(presetKey);
        envState.mode = 'preset';
        envState.presetKey = presetKey;
        envState.enabled = true;
        envState.width = data.width;
        envState.height = data.height;
        envState.pixels = data.pixels;
        envState.previewUrl = data.previewUrl;
        envState.label = names[presetKey] || presetKey;
        return envState;
    }

    async function loadCustomEnvironment(file) {
        const decoded = await decodeFileToRgba(file, MAX_ENV_WIDTH);
        envState.mode = 'custom';
        envState.enabled = true;
        envState.width = decoded.width;
        envState.height = decoded.height;
        envState.pixels = decoded.pixels;
        envState.previewUrl = decoded.previewUrl;
        envState.label = file.name;
        return envState;
    }

    function updateEnvironmentParams({ intensity, rotationDeg } = {}) {
        if (typeof intensity === 'number' && !Number.isNaN(intensity)) {
            envState.intensity = Math.max(0.05, Math.min(5.0, intensity));
        }
        if (typeof rotationDeg === 'number' && !Number.isNaN(rotationDeg)) {
            envState.rotationDeg = rotationDeg;
        }
    }

    async function loadMaterialTexture(slotId, file) {
        const decoded = await decodeFileToRgba(file, MAX_TEX_SIZE);
        const entry = {
            slotId,
            width: decoded.width,
            height: decoded.height,
            pixels: decoded.pixels,
            previewUrl: decoded.previewUrl,
            label: file.name
        };
        textureSlots.set(slotId, entry);
        return entry;
    }

    function syncTracer(tracer) {
        if (!tracer) return;

        if (envState.enabled && envState.pixels && envState.width > 0 && envState.height > 0) {
            tracer.setEnvironmentMap(envState.width, envState.height, envState.pixels);
            tracer.setEnvironmentParams(true, envState.intensity, envState.rotationDeg);
        } else {
            tracer.clearEnvironmentMap();
        }

        textureSlots.forEach((tex, slotId) => {
            if (tex && tex.pixels) {
                tracer.uploadTexture(slotId, tex.width, tex.height, tex.pixels);
            }
        });
    }

    function applyMaterialTexture(wasmMaterial, objConfig, hexToVec3fFn) {
        if (!wasmMaterial || !objConfig) return;
        const texType = Number(objConfig.textureType) || 0;
        wasmMaterial.texture_type = texType;
        wasmMaterial.tex_scale = objConfig.texScale !== undefined ? Number(objConfig.texScale) : 2.0;
        wasmMaterial.texture_id = objConfig.textureId !== undefined ? Number(objConfig.textureId) : -1;

        if (objConfig.secondaryColor && typeof hexToVec3fFn === 'function') {
            wasmMaterial.secondary_color = hexToVec3fFn(objConfig.secondaryColor);
        }
    }

    function getEnvironmentState() {
        return { ...envState };
    }

    function getTextureSlot(slotId) {
        return textureSlots.get(slotId) || null;
    }

    return {
        setSolidBackground,
        setPresetEnvironment,
        loadCustomEnvironment,
        updateEnvironmentParams,
        loadMaterialTexture,
        syncTracer,
        applyMaterialTexture,
        getEnvironmentState,
        getTextureSlot
    };
})();