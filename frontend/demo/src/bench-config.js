const BENCH_RESOLUTIONS = {
    "640x360": { width: 640, height: 360 },
    "800x450": { width: 800, height: 450 },
    "1168x638": { width: 1168, height: 638 }
};

const CONVERGENCE_CHECKPOINTS = [1, 2, 4, 8, 16, 32, 64, 128, 256];

const BENCH_MODE_HINTS = {
    standard: "Синхронный прогон классического RT и стохастического PT на выбранной сцене с расчётом разности освещённости.",
    equal_time: "Ограничение времени рендера PT бюджетом одного кадра RT (или заданным лимитом) для оценки достижимого SPP.",
    convergence: "Серия прогонов PT (1 → 256 SPP) с расчётом RMSE и PSNR относительно эталонного изображения Ground Truth."
};

const BENCH_SCENES = {
    gi_soft_shadows: {
        name: "Глобальное освещение (GI & Soft Shadows)",
        fov: 1.20,
        bgColor: "#141b29",
        objects: [
            {
                type: "sphere",
                x: 0.0, y: -103.5, z: -16.0, r: 100.0,
                color: "#cbd5e1",
                albedo: { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
                specularExponent: 10.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            {
                type: "sphere",
                x: -4.2, y: -1.1, z: -14.5, r: 2.4,
                color: "#ef4444",
                albedo: { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
                specularExponent: 10.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            {
                type: "sphere",
                x: 0.2, y: -1.3, z: -13.5, r: 2.2,
                color: "#f8fafc",
                albedo: { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
                specularExponent: 10.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            {
                type: "sphere",
                x: 4.3, y: -1.4, z: -12.5, r: 2.1,
                color: "#3b82f6",
                albedo: { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
                specularExponent: 10.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            {
                type: "light",
                x: -3.5, y: 7.5, z: -10.5,
                intensity: 2.2,
                radius: 1.6,
                color: "#fff7ed"
            }
        ]
    },
    diffuse_only: {
        name: "Базовая геометрия (Diffuse Only)",
        fov: 1.35,
        bgColor: "#1e293b",
        objects: [
            {
                type: "sphere",
                x: -4.5, y: 0.0, z: -15.0, r: 2.6,
                color: "#e2e8f0",
                albedo: { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
                specularExponent: 10.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            {
                type: "sphere",
                x: 0.0, y: 0.5, z: -13.0, r: 2.2,
                color: "#f59e0b",
                albedo: { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
                specularExponent: 10.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            {
                type: "sphere",
                x: 4.6, y: -0.3, z: -15.5, r: 2.8,
                color: "#10b981",
                albedo: { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
                specularExponent: 10.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            {
                type: "light",
                x: -8.0, y: 12.0, z: -4.0,
                intensity: 1.8,
                radius: 0.8,
                color: "#ffffff"
            }
        ]
    },
    specular_glass: {
        name: "Зеркала и стекло (Specular & Glass)",
        fov: 1.25,
        bgColor: "#0f172a",
        objects: [
            {
                type: "sphere",
                x: 0.0, y: -103.5, z: -16.0, r: 100.0,
                color: "#94a3b8",
                albedo: { x: 0.8, y: 0.2, z: 0.0, w: 0.0 },
                specularExponent: 25.0,
                refractiveIndex: 1.0,
                roughness: 0.85,
                emissionIntensity: 0.0
            },
            {
                type: "sphere",
                x: -3.8, y: -0.8, z: -14.0, r: 2.6,
                color: "#f8fafc",
                albedo: { x: 0.0, y: 10.0, z: 0.85, w: 0.0 },
                specularExponent: 1425.0,
                refractiveIndex: 1.0,
                roughness: 0.0,
                emissionIntensity: 0.0
            },
            {
                type: "sphere",
                x: 0.6, y: -1.1, z: -11.5, r: 2.2,
                color: "#bae6fd",
                albedo: { x: 0.0, y: 0.5, z: 0.1, w: 0.85 },
                specularExponent: 125.0,
                refractiveIndex: 1.5,
                roughness: 0.01,
                emissionIntensity: 0.0
            },
            {
                type: "sphere",
                x: 4.5, y: -0.9, z: -15.0, r: 2.5,
                color: "#f43f5e",
                albedo: { x: 0.85, y: 0.15, z: 0.0, w: 0.0 },
                specularExponent: 20.0,
                refractiveIndex: 1.0,
                roughness: 0.9,
                emissionIntensity: 0.0
            },
            {
                type: "light",
                x: -6.0, y: 10.0, z: -6.0,
                intensity: 1.9,
                radius: 1.2,
                color: "#ffffff"
            },
            {
                type: "light",
                x: 7.0, y: 8.0, z: -8.0,
                intensity: 1.4,
                radius: 1.0,
                color: "#e0f2fe"
            }
        ]
    },
    stress_many: {
        name: "Стресс-тест (18 объектов, 3 света)",
        fov: 1.35,
        bgColor: "#111827",
        objects: (() => {
            const list = [
                {
                    type: "sphere",
                    x: 0.0, y: -104.0, z: -18.0, r: 100.0,
                    color: "#cbd5e1",
                    albedo: { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
                    specularExponent: 10.0,
                    refractiveIndex: 1.0,
                    roughness: 1.0,
                    emissionIntensity: 0.0
                }
            ];
            const palette = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];
            let idx = 0;
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 5; col++) {
                    const isMirror = (row + col) % 4 === 1;
                    const isGlass = (row + col) % 5 === 2;
                    list.push({
                        type: "sphere",
                        x: -6.4 + col * 3.2,
                        y: -2.4 + row * 2.6,
                        z: -13.0 - row * 2.5,
                        r: 1.15,
                        color: palette[idx % palette.length],
                        albedo: isGlass
                            ? { x: 0.0, y: 0.5, z: 0.1, w: 0.85 }
                            : isMirror
                                ? { x: 0.0, y: 8.0, z: 0.8, w: 0.0 }
                                : { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
                        specularExponent: isMirror ? 1200.0 : 25.0,
                        refractiveIndex: isGlass ? 1.5 : 1.0,
                        roughness: isMirror || isGlass ? 0.03 : 0.95,
                        emissionIntensity: 0.0
                    });
                    idx++;
                }
            }
            list.push(
                { type: "light", x: -10.0, y: 12.0, z: -8.0, intensity: 1.6, radius: 1.3, color: "#ffffff" },
                { type: "light", x: 10.0, y: 11.0, z: -9.0, intensity: 1.5, radius: 1.3, color: "#fef3c7" },
                { type: "light", x: 0.0, y: 14.0, z: -15.0, intensity: 1.2, radius: 1.5, color: "#e0f2fe" }
            );
            return list;
        })()
    },
    obj_duck_prism: {
        name: "3D-модели (.obj): Хрустальная утка и призма",
        fov: 1.15,
        bgColor: "#141b29",
        objects: [
            {
                type: "sphere",
                x: 0.0, y: -103.5, z: -14.0, r: 100.0,
                color: "#cbd5e1",
                albedo: { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
                specularExponent: 15.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            {
                type: "mesh",
                meshKey: "duck",
                x: -1.4, y: -1.3, z: -10.5,
                rotX: 0, rotY: -28, rotZ: 0,
                scale: 2.1,
                smoothShading: true,
                color: "#bae6fd",
                albedo: { x: 0.0, y: 0.5, z: 0.1, w: 0.85 },
                specularExponent: 125.0,
                refractiveIndex: 1.5,
                roughness: 0.02,
                emissionIntensity: 0.0
            },
            {
                type: "mesh",
                meshKey: "prism",
                x: 3.1, y: -1.6, z: -11.5,
                rotX: 0, rotY: 22, rotZ: 0,
                scale: 1.9,
                smoothShading: false,
                color: "#fde68a",
                albedo: { x: 0.0, y: 0.5, z: 0.1, w: 0.85 },
                specularExponent: 125.0,
                refractiveIndex: 1.55,
                roughness: 0.02,
                emissionIntensity: 0.0
            },
            {
                type: "light",
                x: -3.5, y: 8.0, z: -9.0,
                intensity: 2.3,
                radius: 1.3,
                color: "#fff7ed"
            }
        ]
    },
    obj_cornell: {
        name: "3D-модели (.obj): Корнельская комната",
        fov: 1.15,
        bgColor: "#090d16",
        objects: [
            ...MeshLibrary.createCornellBoxWalls(),
            {
                type: "mesh",
                meshKey: "duck",
                x: -1.6, y: -1.5, z: -13.0,
                rotX: 0, rotY: -35, rotZ: 0,
                scale: 1.9,
                smoothShading: true,
                color: "#e0f2fe",
                albedo: { x: 0.0, y: 0.5, z: 0.1, w: 0.85 },
                specularExponent: 125.0,
                refractiveIndex: 1.5,
                roughness: 0.02,
                emissionIntensity: 0.0
            },
            {
                type: "sphere",
                x: 2.0, y: -1.8, z: -14.2, r: 1.7,
                color: "#f8fafc",
                albedo: { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
                specularExponent: 10.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            {
                type: "light",
                x: 0.0, y: 3.55, z: -13.5,
                intensity: 2.6,
                radius: 0.85,
                color: "#fff7ed"
            }
        ]
    },
    obj_highpoly_torus: {
        name: "Высокополигональный меш (.obj, 2048 Δ)",
        fov: 1.15,
        bgColor: "#0f172a",
        objects: [
            {
                type: "sphere",
                x: 0.0, y: -103.5, z: -14.0, r: 100.0,
                color: "#cbd5e1",
                albedo: { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
                specularExponent: 15.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            {
                type: "mesh",
                meshKey: "highpoly_torus",
                geometry: (() => {
                    const majorSegs = 32;
                    const minorSegs = 32;
                    const R = 0.68;
                    const r = 0.28;
                    const flatVerts = [];
                    const flatIndices = [];

                    for (let i = 0; i < majorSegs; i++) {
                        const theta = (2.0 * Math.PI * i) / majorSegs;
                        const cosT = Math.cos(theta);
                        const sinT = Math.sin(theta);

                        for (let j = 0; j < minorSegs; j++) {
                            const phi = (2.0 * Math.PI * j) / minorSegs;
                            const rad = R + r * Math.cos(phi);
                            flatVerts.push(rad * cosT, r * Math.sin(phi), rad * sinT);
                        }
                    }

                    for (let i = 0; i < majorSegs; i++) {
                        const iNext = (i + 1) % majorSegs;
                        for (let j = 0; j < minorSegs; j++) {
                            const jNext = (j + 1) % minorSegs;
                            const a = i * minorSegs + j;
                            const b = iNext * minorSegs + j;
                            const c = iNext * minorSegs + jNext;
                            const d = i * minorSegs + jNext;
                            flatIndices.push(a, b, c, a, c, d);
                        }
                    }

                    return {
                        flatVerts,
                        flatIndices,
                        vertexCount: majorSegs * minorSegs,
                        triangleCount: flatIndices.length / 3
                    };
                })(),
                x: 0.0, y: -0.6, z: -11.5,
                rotX: 38, rotY: -25, rotZ: 12,
                scale: 2.8,
                smoothShading: true,
                color: "#38bdf8",
                albedo: { x: 0.1, y: 2.5, z: 0.35, w: 0.65 },
                specularExponent: 250.0,
                refractiveIndex: 1.5,
                roughness: 0.04,
                emissionIntensity: 0.0
            },
            {
                type: "light",
                x: -4.5, y: 8.5, z: -8.5,
                intensity: 2.3,
                radius: 1.3,
                color: "#fff7ed"
            }
        ]
    }
};