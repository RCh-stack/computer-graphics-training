let benchRtTracer = null;
let benchPtTracer = null;
let activeWidth = 640;
let activeHeight = 360;

let isRunning = false;
let cancelRequested = false;

let lastRtMetrics = null;
let lastPtMetrics = null;
let lastQualityStats = null;
let convergenceHistory = [];

const statusDiv = document.getElementById('wasm-status');
const modeSelect = document.getElementById('bench-mode');
const modeHint = document.getElementById('bench-mode-hint');
const sceneSelect = document.getElementById('bench-scene');
const sceneSummary = document.getElementById('scene-summary');
const resSelect = document.getElementById('bench-resolution');
const sppSlider = document.getElementById('bench-spp');
const sppLabel = document.getElementById('val-bench-spp');
const timeBudgetSelect = document.getElementById('bench-time-budget');
const gtSppSelect = document.getElementById('bench-gt-spp');

const btnRun = document.getElementById('btn-run-benchmark');
const btnStop = document.getElementById('btn-stop-benchmark');
const btnExportCsv = document.getElementById('btn-export-csv');
const progressText = document.getElementById('bench-progress-text');
const progressBar = document.getElementById('bench-progress-bar');

const canvasRt = document.getElementById('canvas-rt');
const ctxRt = canvasRt.getContext('2d');
const canvasPt = document.getElementById('canvas-pt');
const ctxPt = canvasPt.getContext('2d');
const canvasDiff = document.getElementById('canvas-diff');
const ctxDiff = canvasDiff.getContext('2d');

const chartRaysCanvas = document.getElementById('chart-rays');
const chartConvCanvas = document.getElementById('chart-convergence');

function hexToVec3f(hex) {
    const clean = (hex || '#ffffff').replace('#', '');
    return {
        x: parseInt(clean.slice(0, 2), 16) / 255,
        y: parseInt(clean.slice(2, 4), 16) / 255,
        z: parseInt(clean.slice(4, 6), 16) / 255
    };
}

function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

function setProgress(pct, text) {
    if (progressBar) progressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    if (progressText) progressText.innerText = text;
}

function setRunningState(running) {
    isRunning = running;
    btnRun.disabled = running;
    btnRun.classList.toggle('opacity-50', running);
    btnStop.classList.toggle('hidden', !running);
}

function ensureTracers(width, height) {
    if (benchRtTracer && benchPtTracer && activeWidth === width && activeHeight === height) {
        return;
    }

    if (benchRtTracer) benchRtTracer.delete();
    if (benchPtTracer) benchPtTracer.delete();

    activeWidth = width;
    activeHeight = height;

    canvasRt.width = width;
    canvasRt.height = height;
    canvasPt.width = width;
    canvasPt.height = height;
    canvasDiff.width = width;
    canvasDiff.height = height;

    benchRtTracer = new Module.RayTracer(width, height);
    benchPtTracer = new Module.PathTracer(width, height);
}

function buildSceneVectors(sceneKey) {
    const scene = BENCH_SCENES[sceneKey];
    const spheresVector = new Module.VectorSphere();
    const meshesVector = new Module.VectorMesh();
    const lightsVector = new Module.VectorLight();

    scene.objects.forEach(obj => {
        if (obj.type === 'sphere') {
            const baseColor = hexToVec3f(obj.color);
            const em = Number(obj.emissionIntensity) || 0.0;
            const mat = new Module.Material(
                obj.albedo,
                baseColor,
                obj.specularExponent,
                obj.refractiveIndex,
                { x: baseColor.x * em, y: baseColor.y * em, z: baseColor.z * em },
                obj.roughness !== undefined ? obj.roughness : 1.0
            );
            const sp = new Module.Sphere({ x: obj.x, y: obj.y, z: obj.z }, obj.r, mat);
            spheresVector.push_back(sp);
            sp.delete();
            mat.delete();
        } else if (obj.type === 'mesh') {
            const wasmMesh = MeshLibrary.buildWasmMesh(obj, hexToVec3f, obj.albedo);
            if (wasmMesh) {
                meshesVector.push_back(wasmMesh);
                wasmMesh.delete();
            }
        } else if (obj.type === 'light') {
            const lt = new Module.Light(
                { x: obj.x, y: obj.y, z: obj.z },
                obj.intensity,
                obj.radius || 1.0,
                hexToVec3f(obj.color || '#ffffff')
            );
            lightsVector.push_back(lt);
            lt.delete();
        }
    });

    return { spheresVector, meshesVector, lightsVector, scene };
}

function readTracerRgbaCopy(tracer, width, height) {
    const ptr = tracer.getBufferPointer();
    const wasmMemory = Module.HEAPU8 ? Module.HEAPU8.buffer : Module.buffer;
    const view = new Uint8ClampedArray(wasmMemory, ptr, width * height * 4);
    return new Uint8ClampedArray(view);
}

function putRgbaToCanvas(ctx, rgbaArray, width, height) {
    const imgData = ctx.createImageData(width, height);
    imgData.data.set(rgbaArray);
    ctx.putImageData(imgData, 0, 0);
}

function heatmapColor(t) {
    const v = Math.min(1, Math.max(0, t));
    if (v < 0.25) {
        const k = v / 0.25;
        return [Math.round(35 * k), Math.round(10 * k), Math.round(90 * k)];
    } else if (v < 0.5) {
        const k = (v - 0.25) / 0.25;
        return [Math.round(35 + 145 * k), Math.round(10 + 25 * k), Math.round(90 + 30 * k)];
    } else if (v < 0.75) {
        const k = (v - 0.5) / 0.25;
        return [Math.round(180 + 70 * k), Math.round(35 + 115 * k), Math.round(120 - 100 * k)];
    } else {
        const k = (v - 0.75) / 0.25;
        return [255, Math.round(150 + 105 * k), Math.round(20 + 210 * k)];
    }
}

function computeImageComparison(bufA, bufB, width, height, renderHeatmap = true) {
    const pixelCount = width * height;
    let sumSqErr = 0.0;
    let lumSumA = 0.0;
    let lumSumB = 0.0;

    const diffRgba = renderHeatmap ? new Uint8ClampedArray(pixelCount * 4) : null;

    for (let i = 0; i < pixelCount; i++) {
        const idx = i * 4;
        const rA = bufA[idx] / 255.0;
        const gA = bufA[idx + 1] / 255.0;
        const bA = bufA[idx + 2] / 255.0;

        const rB = bufB[idx] / 255.0;
        const gB = bufB[idx + 1] / 255.0;
        const bB = bufB[idx + 2] / 255.0;

        const dr = rA - rB;
        const dg = gA - gB;
        const db = bA - bB;

        const errSq = (dr * dr + dg * dg + db * db) / 3.0;
        sumSqErr += errSq;

        lumSumA += 0.2126 * rA + 0.7152 * gA + 0.0722 * bA;
        lumSumB += 0.2126 * rB + 0.7152 * gB + 0.0722 * bB;

        if (renderHeatmap) {
            const mag = Math.sqrt(errSq) * 2.5;
            const [hr, hg, hb] = heatmapColor(mag);
            diffRgba[idx] = hr;
            diffRgba[idx + 1] = hg;
            diffRgba[idx + 2] = hb;
            diffRgba[idx + 3] = 255;
        }
    }

    const mse = sumSqErr / pixelCount;
    const rmse = Math.sqrt(mse);
    const psnr = mse > 1e-10 ? 10.0 * Math.log10(1.0 / mse) : 99.9;
    const globalEnergyDiffPct = lumSumA > 1e-6
        ? ((lumSumB - lumSumA) / lumSumA) * 100.0
        : 0.0;

    return { rmse, psnr, globalEnergyDiffPct, diffRgba };
}

function computeAabbStats(metrics, scene) {
    if (!scene || !metrics) return null;

    let meshCount = 0;
    let totalTriangles = 0;
    scene.objects.forEach(obj => {
        if (obj.type === 'mesh') {
            meshCount++;
            const geom = obj.geometry || MeshLibrary.getGeometry(obj.meshKey);
            totalTriangles += geom ? geom.triangleCount : 0;
        }
    });

    if (meshCount === 0 || totalTriangles === 0 || !metrics.aabbTests) {
        return null;
    }

    const rayMeshQueries = metrics.aabbTests / meshCount;
    const bruteForceTriangles = rayMeshQueries * totalTriangles;
    const savedTriangles = Math.max(0, bruteForceTriangles - metrics.triangleTests);
    const cullPct = bruteForceTriangles > 0 ? (savedTriangles / bruteForceTriangles) * 100.0 : 0.0;
    const actualMeshChecks = metrics.aabbTests + metrics.triangleTests;
    const speedupFactor = actualMeshChecks > 0 ? bruteForceTriangles / actualMeshChecks : 1.0;

    return {
        aabbTests: Math.round(metrics.aabbTests),
        triangleTests: Math.round(metrics.triangleTests),
        cullPct,
        speedupFactor
    };
}

function updateSummaryUI(rt, pt, quality, isConvergenceRef = false) {
    const rtMs = Math.max(0.01, rt.renderTimeMs);
    const ptMs = Math.max(0.01, pt.renderTimeMs);

    const rtFps = 1000.0 / rtMs;
    const ptFps = 1000.0 / ptMs;

    const rtMRays = rt.totalRays / (rtMs * 1000.0);
    const ptMRays = pt.totalRays / (ptMs * 1000.0);

    const rtRayCost = rt.totalRays > 0 ? rt.intersectionTests / rt.totalRays : 0;
    const ptRayCost = pt.totalRays > 0 ? pt.intersectionTests / pt.totalRays : 0;

    const slowdown = ptMs / rtMs;

    document.getElementById('badge-rt-time').innerText = `${rtMs.toFixed(1)} мс (${rtFps.toFixed(1)} FPS)`;
    document.getElementById('badge-pt-time').innerText = `${ptMs.toFixed(1)} мс (${pt.spp} SPP)`;
    document.getElementById('title-pt-canvas').innerText = `Path Tracing (${pt.spp} SPP)`;
    document.getElementById('badge-diff-energy').innerText = `ΔE: ${quality.globalEnergyDiffPct >= 0 ? '+' : ''}${quality.globalEnergyDiffPct.toFixed(1)}%`;

    document.getElementById('kpi-slowdown').innerText = `${slowdown.toFixed(2)} ×`;
    document.getElementById('kpi-slowdown-sub').innerText = `RT: ${rtMs.toFixed(1)} мс | PT: ${ptMs.toFixed(1)} мс`;

    document.getElementById('kpi-throughput').innerText = `${rtMRays.toFixed(1)} / ${ptMRays.toFixed(1)}`;
    document.getElementById('kpi-ray-cost').innerText = `${rtRayCost.toFixed(2)} / ${ptRayCost.toFixed(2)}`;

    document.getElementById('kpi-quality').innerText = `${quality.psnr.toFixed(2)} дБ`;
    document.getElementById('kpi-quality-sub').innerText = isConvergenceRef
        ? `RMSE vs GT: ${quality.rmse.toFixed(4)}`
        : `RMSE (PT vs RT): ${quality.rmse.toFixed(4)}`;

    const tbody = document.getElementById('metrics-table-body');
    const rows = [
        ["Время рендера в Wasm (мс)", `${rtMs.toFixed(2)} мс`, `${ptMs.toFixed(2)} мс`, `×${slowdown.toFixed(2)}`],
        ["Эквивалентный FPS", `${rtFps.toFixed(1)} FPS`, `${ptFps.toFixed(2)} FPS`, `×${(rtFps / Math.max(0.001, ptFps)).toFixed(2)}`],
        ["Сэмплов на пиксель (SPP)", `${rt.spp}`, `${pt.spp}`, `×${pt.spp}`],
        ["Первичные лучи (Primary Rays)", rt.primaryRays.toLocaleString(), pt.primaryRays.toLocaleString(), `×${(pt.primaryRays / rt.primaryRays).toFixed(1)}`],
        ["Теневые лучи (Shadow / NEE)", rt.shadowRays.toLocaleString(), pt.shadowRays.toLocaleString(), `×${(pt.shadowRays / Math.max(1, rt.shadowRays)).toFixed(2)}`],
        ["Вторичные лучи (Bounces)", rt.secondaryRays.toLocaleString(), pt.secondaryRays.toLocaleString(), `×${(pt.secondaryRays / Math.max(1, rt.secondaryRays)).toFixed(2)}`],
        ["Всего выпущено лучей", rt.totalRays.toLocaleString(), pt.totalRays.toLocaleString(), `×${(pt.totalRays / rt.totalRays).toFixed(2)}`],
        ["Проверок пересечения «луч–сфера»", Math.round(rt.intersectionTests).toLocaleString(), Math.round(pt.intersectionTests).toLocaleString(), `×${(pt.intersectionTests / Math.max(1, rt.intersectionTests)).toFixed(2)}`],
        ["Пропускная способность (MRays/s)", `${rtMRays.toFixed(2)}`, `${ptMRays.toFixed(2)}`, `${((ptMRays / rtMRays) * 100).toFixed(0)}% от RT`],
        ["Разница световой энергии ΔE (GI)", "Базовый (0%)", `${quality.globalEnergyDiffPct >= 0 ? '+' : ''}${quality.globalEnergyDiffPct.toFixed(2)}%`, "Вклад непрямого света"]
    ];

    const currentScene = BENCH_SCENES[sceneSelect.value];
    const rtAabb = computeAabbStats(rt, currentScene);
    const ptAabb = computeAabbStats(pt, currentScene);

    if (rtAabb && ptAabb) {
        rows.push(
            [
                "Тесты ограничивающих боксов (AABB)",
                rtAabb.aabbTests.toLocaleString(),
                ptAabb.aabbTests.toLocaleString(),
                `×${(ptAabb.aabbTests / Math.max(1, rtAabb.aabbTests)).toFixed(2)}`
            ],
            [
                "Тесты пересечения «луч–треугольник» (Δ)",
                rtAabb.triangleTests.toLocaleString(),
                ptAabb.triangleTests.toLocaleString(),
                `×${(ptAabb.triangleTests / Math.max(1, rtAabb.triangleTests)).toFixed(2)}`
            ],
            [
                "Отсечено треугольников по AABB",
                `${rtAabb.cullPct.toFixed(1)}% (${rtAabb.speedupFactor.toFixed(2)}×)`,
                `${ptAabb.cullPct.toFixed(1)}% (${ptAabb.speedupFactor.toFixed(2)}×)`,
                "Ускорение против полного перебора Δ"
            ]
        );
    }

    tbody.innerHTML = rows.map(r => `
        <tr class="hover:bg-[var(--bg-elevated)] transition">
            <td class="py-2 px-3 font-sans font-medium text-[var(--text-main)]">${r[0]}</td>
            <td class="py-2 px-3 text-pink-500">${r[1]}</td>
            <td class="py-2 px-3 text-amber-500">${r[2]}</td>
            <td class="py-2 px-3 text-[var(--text-muted)]">${r[3]}</td>
        </tr>
    `).join('');

    drawRaysBarChart(rt, pt);
}

function getThemeColors() {
    const styles = getComputedStyle(document.body);
    return {
        textMain: styles.getPropertyValue('--text-main').trim() || '#e2e8f0',
        textMuted: styles.getPropertyValue('--text-muted').trim() || '#94a3b8',
        border: styles.getPropertyValue('--border-color').trim() || '#334155'
    };
}

function drawRaysBarChart(rt, pt) {
    if (!chartRaysCanvas) return;
    const ctx = chartRaysCanvas.getContext('2d');
    const w = chartRaysCanvas.width;
    const h = chartRaysCanvas.height;
    const theme = getThemeColors();

    ctx.clearRect(0, 0, w, h);

    const padLeft = 68;
    const padRight = 20;
    const padTop = 26;
    const padBottom = 34;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    const groups = [
        { label: "Primary", rt: rt.primaryRays, pt: pt.primaryRays },
        { label: "Shadow / NEE", rt: rt.shadowRays, pt: pt.shadowRays },
        { label: "Secondary", rt: rt.secondaryRays, pt: pt.secondaryRays },
        { label: "Total Rays", rt: rt.totalRays, pt: pt.totalRays }
    ];

    const maxVal = Math.max(10, ...groups.flatMap(g => [g.rt, g.pt]));

    ctx.strokeStyle = theme.border;
    ctx.fillStyle = theme.textMuted;
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';

    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
        const ratio = i / gridSteps;
        const y = padTop + plotH - ratio * plotH;
        const val = maxVal * ratio;

        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(w - padRight, y);
        ctx.stroke();

        const label = val >= 1e6 ? `${(val / 1e6).toFixed(1)}M` : `${Math.round(val / 1000)}k`;
        ctx.fillText(label, padLeft - 8, y + 3);
    }

    const groupWidth = plotW / groups.length;
    const barW = Math.min(28, groupWidth * 0.28);

    groups.forEach((g, idx) => {
        const cx = padLeft + groupWidth * (idx + 0.5);

        const hRt = (g.rt / maxVal) * plotH;
        const hPt = (g.pt / maxVal) * plotH;

        ctx.fillStyle = '#ec4899';
        ctx.fillRect(cx - barW - 3, padTop + plotH - hRt, barW, hRt);

        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(cx + 3, padTop + plotH - hPt, barW, hPt);

        ctx.fillStyle = theme.textMain;
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(g.label, cx, h - 10);
    });

    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ec4899';
    ctx.fillRect(padLeft, 6, 10, 10);
    ctx.fillStyle = theme.textMain;
    ctx.fillText('Ray Tracing', padLeft + 15, 15);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(padLeft + 105, 6, 10, 10);
    ctx.fillStyle = theme.textMain;
    ctx.fillText(`Path Tracing (${pt.spp} SPP)`, padLeft + 120, 15);
}

function drawConvergenceChart(history) {
    if (!chartConvCanvas) return;
    const ctx = chartConvCanvas.getContext('2d');
    const w = chartConvCanvas.width;
    const h = chartConvCanvas.height;
    const theme = getThemeColors();

    ctx.clearRect(0, 0, w, h);

    if (!history || history.length === 0) {
        ctx.fillStyle = theme.textMuted;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Запустите режим «3. Анализ сходимости», чтобы построить кривую PSNR(SPP)', w / 2, h / 2);
        return;
    }

    const padLeft = 52;
    const padRight = 24;
    const padTop = 24;
    const padBottom = 34;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    const minPsnr = 15;
    const maxPsnr = 50;

    ctx.strokeStyle = theme.border;
    ctx.fillStyle = theme.textMuted;
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';

    for (let p = 20; p <= 50; p += 10) {
        const y = padTop + plotH - ((p - minPsnr) / (maxPsnr - minPsnr)) * plotH;
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(w - padRight, y);
        ctx.stroke();
        ctx.fillText(`${p} dB`, padLeft - 6, y + 3);
    }

    const yThresh = padTop + plotH - ((35 - minPsnr) / (maxPsnr - minPsnr)) * plotH;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(padLeft, yThresh);
    ctx.lineTo(w - padRight, yThresh);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#10b981';
    ctx.textAlign = 'left';
    ctx.fillText('Порог 35 дБ (низкий шум)', padLeft + 6, yThresh - 5);

    const count = history.length;
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    history.forEach((pt, idx) => {
        const x = count === 1 ? padLeft + plotW / 2 : padLeft + (idx / (count - 1)) * plotW;
        const clampedPsnr = Math.min(maxPsnr, Math.max(minPsnr, pt.psnr));
        const y = padTop + plotH - ((clampedPsnr - minPsnr) / (maxPsnr - minPsnr)) * plotH;

        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    history.forEach((pt, idx) => {
        const x = count === 1 ? padLeft + plotW / 2 : padLeft + (idx / (count - 1)) * plotW;
        const clampedPsnr = Math.min(maxPsnr, Math.max(minPsnr, pt.psnr));
        const y = padTop + plotH - ((clampedPsnr - minPsnr) / (maxPsnr - minPsnr)) * plotH;

        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = theme.textMain;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${pt.spp}`, x, h - 10);
    });
}

async function runStandardOrEqualTime(mode) {
    const res = BENCH_RESOLUTIONS[resSelect.value] || BENCH_RESOLUTIONS["640x360"];
    ensureTracers(res.width, res.height);

    const { spheresVector, meshesVector, lightsVector, scene } = buildSceneVectors(sceneSelect.value);
    const bg = hexToVec3f(scene.bgColor);

    try {
        setProgress(10, 'Рендер Ray Tracing...');
        await nextFrame();

        benchRtTracer.renderSceneWithMeshes(scene.fov, bg, 5, spheresVector, meshesVector, lightsVector);
        const rtMetrics = benchRtTracer.getLastMetrics();
        const rtRgba = readTracerRgbaCopy(benchRtTracer, res.width, res.height);
        putRgbaToCanvas(ctxRt, rtRgba, res.width, res.height);

        benchPtTracer.reset();
        benchPtTracer.setSeed(42);

        if (mode === 'standard') {
            const goalSpp = parseInt(sppSlider.value, 10) || 32;
            let batch = 2;

            while (benchPtTracer.getAccumulatedSamples() < goalSpp && !cancelRequested) {
                const rem = goalSpp - benchPtTracer.getAccumulatedSamples();
                const stepSpp = Math.min(rem, batch);

                benchPtTracer.renderPassWithMeshes(stepSpp, scene.fov, bg, 3, spheresVector, meshesVector, lightsVector);
                const cur = benchPtTracer.getAccumulatedSamples();
                setProgress(15 + (cur / goalSpp) * 80, `PT: ${cur} / ${goalSpp} SPP`);

                const ptRgbaLive = readTracerRgbaCopy(benchPtTracer, res.width, res.height);
                putRgbaToCanvas(ctxPt, ptRgbaLive, res.width, res.height);
                await nextFrame();
            }
        } else {
            const budgetChoice = timeBudgetSelect.value;
            const budgetMs = budgetChoice === 'auto' ? rtMetrics.renderTimeMs : parseFloat(budgetChoice);

            let elapsedBudget = 0;
            do {
                benchPtTracer.renderPassWithMeshes(1, scene.fov, bg, 3, spheresVector, meshesVector, lightsVector);
                const m = benchPtTracer.getLastMetrics();
                elapsedBudget = m.renderTimeMs;

                const ptRgbaLive = readTracerRgbaCopy(benchPtTracer, res.width, res.height);
                putRgbaToCanvas(ctxPt, ptRgbaLive, res.width, res.height);
                setProgress(Math.min(95, (elapsedBudget / Math.max(1, budgetMs)) * 90), `Бюджет: ${elapsedBudget.toFixed(1)} / ${budgetMs.toFixed(1)} мс`);
                await nextFrame();
            } while (elapsedBudget < budgetMs && !cancelRequested);
        }

        const ptMetrics = benchPtTracer.getLastMetrics();
        const ptRgba = readTracerRgbaCopy(benchPtTracer, res.width, res.height);
        const quality = computeImageComparison(rtRgba, ptRgba, res.width, res.height, true);

        if (quality.diffRgba) {
            putRgbaToCanvas(ctxDiff, quality.diffRgba, res.width, res.height);
        }

        lastRtMetrics = rtMetrics;
        lastPtMetrics = ptMetrics;
        lastQualityStats = quality;

        updateSummaryUI(rtMetrics, ptMetrics, quality, false);
        setProgress(100, 'Завершено');
    } finally {
        spheresVector.delete();
        meshesVector.delete();
        lightsVector.delete();
    }
}

async function runConvergenceSweep() {
    const res = BENCH_RESOLUTIONS[resSelect.value] || BENCH_RESOLUTIONS["640x360"];
    ensureTracers(res.width, res.height);

    const { spheresVector, meshesVector, lightsVector, scene } = buildSceneVectors(sceneSelect.value);
    const bg = hexToVec3f(scene.bgColor);
    const gtSpp = parseInt(gtSppSelect.value, 10) || 512;

    try {
        setProgress(5, 'Этап 1/3: Базовый Ray Tracing...');
        await nextFrame();
        benchRtTracer.renderSceneWithMeshes(scene.fov, bg, 5, spheresVector, meshesVector, lightsVector);
        const rtMetrics = benchRtTracer.getLastMetrics();
        const rtRgba = readTracerRgbaCopy(benchRtTracer, res.width, res.height);
        putRgbaToCanvas(ctxRt, rtRgba, res.width, res.height);

        benchPtTracer.reset();
        benchPtTracer.setSeed(9999);
        while (benchPtTracer.getAccumulatedSamples() < gtSpp && !cancelRequested) {
            const rem = gtSpp - benchPtTracer.getAccumulatedSamples();
            const step = Math.min(rem, 16);
            benchPtTracer.renderPassWithMeshes(step, scene.fov, bg, 3, spheresVector, meshesVector, lightsVector);
            const cur = benchPtTracer.getAccumulatedSamples();
            setProgress(5 + (cur / gtSpp) * 50, `Этап 2/3: Эталон GT (${cur}/${gtSpp} SPP)`);
            await nextFrame();
        }
        if (cancelRequested) return;
        const gtRgba = readTracerRgbaCopy(benchPtTracer, res.width, res.height);

        benchPtTracer.reset();
        benchPtTracer.setSeed(42);
        convergenceHistory = [];

        for (let i = 0; i < CONVERGENCE_CHECKPOINTS.length; i++) {
            if (cancelRequested) break;
            const targetCheckpoint = CONVERGENCE_CHECKPOINTS[i];
            const deltaSpp = targetCheckpoint - benchPtTracer.getAccumulatedSamples();

            if (deltaSpp > 0) {
                benchPtTracer.renderPassWithMeshes(deltaSpp, scene.fov, bg, 3, spheresVector, meshesVector, lightsVector);
            }

            const curMetrics = benchPtTracer.getLastMetrics();
            const curRgba = readTracerRgbaCopy(benchPtTracer, res.width, res.height);
            putRgbaToCanvas(ctxPt, curRgba, res.width, res.height);

            const qGt = computeImageComparison(gtRgba, curRgba, res.width, res.height, false);
            const qRt = computeImageComparison(rtRgba, curRgba, res.width, res.height, i === CONVERGENCE_CHECKPOINTS.length - 1);

            if (qRt.diffRgba) {
                putRgbaToCanvas(ctxDiff, qRt.diffRgba, res.width, res.height);
            }

            convergenceHistory.push({
                spp: curMetrics.spp,
                renderTimeMs: curMetrics.renderTimeMs,
                totalRays: curMetrics.totalRays,
                intersectionTests: curMetrics.intersectionTests,
                mRaysPerSec: curMetrics.totalRays / (Math.max(0.01, curMetrics.renderTimeMs) * 1000.0),
                slowdownVsRt: curMetrics.renderTimeMs / Math.max(0.01, rtMetrics.renderTimeMs),
                rmse: qGt.rmse,
                psnr: qGt.psnr
            });

            lastRtMetrics = rtMetrics;
            lastPtMetrics = curMetrics;
            lastQualityStats = { ...qGt, globalEnergyDiffPct: qRt.globalEnergyDiffPct };

            updateSummaryUI(rtMetrics, curMetrics, lastQualityStats, true);
            drawConvergenceChart(convergenceHistory);

            const pct = 55 + ((i + 1) / CONVERGENCE_CHECKPOINTS.length) * 45;
            setProgress(pct, `Этап 3/3: Точка ${targetCheckpoint} SPP (PSNR: ${qGt.psnr.toFixed(1)} дБ)`);
            await nextFrame();
        }

        document.getElementById('chart-conv-subtitle').innerText = `Эталон: PT ${gtSpp} SPP | Разрешение ${res.width}×${res.height}`;
        setProgress(100, 'Анализ сходимости завершён');
    } finally {
        spheresVector.delete();
        meshesVector.delete();
        lightsVector.delete();
    }
}

async function startBenchmark() {
    if (isRunning || !benchRtTracer) return;
    cancelRequested = false;
    setRunningState(true);

    try {
        const mode = modeSelect.value;
        if (mode === 'convergence') {
            await runConvergenceSweep();
        } else {
            await runStandardOrEqualTime(mode);
        }
    } catch (err) {
        console.error(err);
        window.Toast?.error('Ошибка бенчмарка', 'Не удалось завершить расчёт');
    } finally {
        setRunningState(false);
    }
}

function exportBenchmarkCsv() {
    if (!lastRtMetrics || !lastPtMetrics) {
        window.Toast?.warning('Нет данных', 'Сначала запустите хотя бы один тест');
        return;
    }

    const sceneName = BENCH_SCENES[sceneSelect.value]?.name || sceneSelect.value;

    const scene = BENCH_SCENES[sceneSelect.value];
    const rtAabb = computeAabbStats(lastRtMetrics, scene);
    const ptAabb = computeAabbStats(lastPtMetrics, scene);

    const lines = [
        `Сцена;${sceneName};Разрешение;${activeWidth}x${activeHeight}`,
        '',
        'Алгоритм;SPP;Время (мс);FPS;Primary лучи;Shadow лучи;Secondary лучи;Всего лучей;Проверок пересечения;MRays/s;AABB тесты;Треугольные тесты;Отсечено AABB (%)',
        `Ray Tracing;${lastRtMetrics.spp};${lastRtMetrics.renderTimeMs.toFixed(2)};${(1000 / lastRtMetrics.renderTimeMs).toFixed(2)};${lastRtMetrics.primaryRays};${lastRtMetrics.shadowRays};${lastRtMetrics.secondaryRays};${lastRtMetrics.totalRays};${Math.round(lastRtMetrics.intersectionTests)};${(lastRtMetrics.totalRays / (lastRtMetrics.renderTimeMs * 1000)).toFixed(2)};${rtAabb ? rtAabb.aabbTests : 0};${rtAabb ? rtAabb.triangleTests : 0};${rtAabb ? rtAabb.cullPct.toFixed(1) : 0}`,
        `Path Tracing;${lastPtMetrics.spp};${lastPtMetrics.renderTimeMs.toFixed(2)};${(1000 / lastPtMetrics.renderTimeMs).toFixed(2)};${lastPtMetrics.primaryRays};${lastPtMetrics.shadowRays};${lastPtMetrics.secondaryRays};${lastPtMetrics.totalRays};${Math.round(lastPtMetrics.intersectionTests)};${(lastPtMetrics.totalRays / (lastPtMetrics.renderTimeMs * 1000)).toFixed(2)};${ptAabb ? ptAabb.aabbTests : 0};${ptAabb ? ptAabb.triangleTests : 0};${ptAabb ? ptAabb.cullPct.toFixed(1) : 0}`
    ];

    if (convergenceHistory.length > 0) {
        lines.push('', 'Кривая сходимости Monte Carlo (Path Tracing vs Ground Truth)');
        lines.push('SPP;Время (мс);Всего лучей;Проверок пересечения;MRays/s;Замедление к RT;RMSE;PSNR (дБ)');
        convergenceHistory.forEach(row => {
            lines.push(
                `${row.spp};${row.renderTimeMs.toFixed(2)};${row.totalRays};${Math.round(row.intersectionTests)};${row.mRaysPerSec.toFixed(2)};${row.slowdownVsRt.toFixed(2)};${row.rmse.toFixed(5)};${row.psnr.toFixed(2)}`
            );
        });
    }

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `benchmark_${sceneSelect.value}_${activeWidth}x${activeHeight}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    window.Toast?.success('CSV-отчёт выгружен');
}

function updateSceneSummary() {
    const scene = BENCH_SCENES[sceneSelect.value];
    if (!scene) return;
    const spheresCount = scene.objects.filter(o => o.type === 'sphere').length;
    const meshes = scene.objects.filter(o => o.type === 'mesh');
    const trianglesCount = meshes.reduce((acc, m) => {
        const geom = m.geometry || MeshLibrary.getGeometry(m.meshKey);
        return acc + (geom ? geom.triangleCount : 0);
    }, 0);
    const lightsCount = scene.objects.filter(o => o.type === 'light').length;

    sceneSummary.innerText = meshes.length > 0
        ? `Сфер: ${spheresCount} | Мешей: ${meshes.length} (${trianglesCount} Δ) | Света: ${lightsCount} | FOV: ${scene.fov}`
        : `Сфер: ${spheresCount} | Источников: ${lightsCount} | FOV: ${scene.fov}`;
}

modeSelect.addEventListener('change', () => {
    const mode = modeSelect.value;
    modeHint.innerText = BENCH_MODE_HINTS[mode] || '';
    document.getElementById('group-standard-spp').classList.toggle('hidden', mode !== 'standard');
    document.getElementById('group-equal-time').classList.toggle('hidden', mode !== 'equal_time');
    document.getElementById('group-convergence').classList.toggle('hidden', mode !== 'convergence');
});

sceneSelect.addEventListener('change', updateSceneSummary);

sppSlider.addEventListener('input', () => {
    sppLabel.innerText = sppSlider.value;
});

btnRun.addEventListener('click', startBenchmark);
btnStop.addEventListener('click', () => {
    cancelRequested = true;
    setProgress(0, 'Остановка...');
});
btnExportCsv.addEventListener('click', exportBenchmarkCsv);

document.getElementById('theme-toggle')?.addEventListener('click', () => {
    setTimeout(() => {
        if (lastRtMetrics && lastPtMetrics) drawRaysBarChart(lastRtMetrics, lastPtMetrics);
        drawConvergenceChart(convergenceHistory);
    }, 30);
});

window.Module = {
    onRuntimeInitialized: function() {
        statusDiv.innerText = "✓ Wasm Готов";
        statusDiv.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";

        try {
            const res = BENCH_RESOLUTIONS[resSelect.value] || BENCH_RESOLUTIONS["640x360"];
            ensureTracers(res.width, res.height);
            updateSceneSummary();
            drawConvergenceChart([]);
            startBenchmark();
        } catch (err) {
            console.error(err);
            statusDiv.innerText = "Ошибка Wasm Build";
            statusDiv.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20";
        }
    }
};