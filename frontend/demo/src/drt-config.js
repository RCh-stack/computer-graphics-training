const DRT_WIDTH = 1168;
const DRT_HEIGHT = 638;

const DRT_TARGET_PREVIEW_MS = 16;
const DRT_MIN_PREVIEW_SCALE = 0.15;
const DRT_MAX_PREVIEW_SCALE = 0.50;
const DRT_DEFAULT_PREVIEW_SCALE = 0.30;
const DRT_PREVIEW_SCALE_STEP = 0.05;

const DRT_STEPS = [
    {
        id: 0,
        title: "0. STOCHASTIC AA (JITTER)",
        desc: "Субпиксельное смещение первичных лучей (Jittered Super-Sampling). Устраняет ступенчатый алиасинг на границах сфер и полигональных мешей при сохранении точечных теней и идеальных отражений."
    },
    {
        id: 1,
        title: "1. SOFT SHADOWS (AREA LIGHT)",
        desc: "Распределённая выборка по площади источника света (сфера радиуса light.radius). Вместо резкой границы тени формируется физически плавный переход полутени (Penumbra)."
    },
    {
        id: 2,
        title: "2. GLOSSY BRDF (ROUGHNESS)",
        desc: "Стохастическое возмущение отражённых и преломлённых лучей в конусе, пропорциональном шероховатости поверхности (material.roughness). Создаёт матовые металлические блики и сатинированное стекло без диффузного GI."
    },
    {
        id: 3,
        title: "3. DEPTH OF FIELD (THIN LENS)",
        desc: "Модель тонкой линзы камеры (Aperture + Focal Distance). Начало первичных лучей распределяется по диску апертуры и сводится в фокальной плоскости z = -focalDistance, создавая естественное размытие (боке) вне фокуса."
    }
];

const DRT_MATERIAL_PRESETS = {
    matte: {
        name: "Матовый (Ламберт + Фонг)",
        albedo: { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
        specularExponent: 25.0,
        refractiveIndex: 1.0,
        roughness: 1.0,
        emissionIntensity: 0.0
    },
    satin_metal: {
        name: "Шлифованный металл (Glossy)",
        albedo: { x: 0.25, y: 0.45, z: 0.70, w: 0.0 },
        specularExponent: 180.0,
        refractiveIndex: 1.0,
        roughness: 0.32,
        emissionIntensity: 0.0
    },
    polished_glossy: {
        name: "Полированный глянец (Low Rough)",
        albedo: { x: 0.35, y: 0.55, z: 0.55, w: 0.0 },
        specularExponent: 420.0,
        refractiveIndex: 1.0,
        roughness: 0.14,
        emissionIntensity: 0.0
    },
    mirror: {
        name: "Идеальное зеркало (Rough = 0)",
        albedo: { x: 0.0, y: 1.0, z: 1.0, w: 0.0 },
        specularExponent: 1425.0,
        refractiveIndex: 1.0,
        roughness: 0.0,
        emissionIntensity: 0.0
    },
    frosted_glass: {
        name: "Матовое стекло (Frosted)",
        albedo: { x: 0.05, y: 0.4, z: 0.12, w: 0.85 },
        specularExponent: 125.0,
        refractiveIndex: 1.5,
        roughness: 0.28,
        emissionIntensity: 0.0
    },
    crystal_glass: {
        name: "Прозрачный хрусталь (IOR 1.5)",
        albedo: { x: 0.0, y: 0.5, z: 0.1, w: 0.9 },
        specularExponent: 125.0,
        refractiveIndex: 1.5,
        roughness: 0.02,
        emissionIntensity: 0.0
    },
    emissive: {
        name: "Светящийся маркер (Emission)",
        albedo: { x: 0.1, y: 0.0, z: 0.0, w: 0.0 },
        specularExponent: 10.0,
        refractiveIndex: 1.0,
        roughness: 1.0,
        emissionIntensity: 2.8
    }
};

const DRT_SCENE_PRESETS = {
    dof_showcase: {
        fov: 1.15,
        bgColor: "#111827",
        aperture: 0.24,
        focalDistance: 11.5,
        objects: [
            {
                id: "drt_floor",
                name: "Шахматный подиум",
                type: "sphere",
                x: 0.0, y: -103.5, z: -15.0, r: 100.0,
                color: "#cbd5e1",
                secondaryColor: "#334155",
                textureType: 1,
                texScale: 1.0,
                presetKey: "polished_glossy",
                albedo: { x: 0.65, y: 0.2, z: 0.22, w: 0.0 },
                specularExponent: 120.0,
                refractiveIndex: 1.0,
                roughness: 0.22,
                emissionIntensity: 0.0
            },
            {
                id: "drt_sp_near",
                name: "Передний план (Размытие)",
                type: "sphere",
                x: -2.9, y: -2.1, z: -7.2, r: 1.35,
                color: "#f43f5e",
                presetKey: "satin_metal",
                albedo: { ...DRT_MATERIAL_PRESETS.satin_metal.albedo },
                specularExponent: 180.0,
                refractiveIndex: 1.0,
                roughness: 0.25,
                emissionIntensity: 0.0
            },
            {
                id: "drt_sp_focus",
                name: "Фокус: Хрустальная сфера",
                type: "sphere",
                x: 0.0, y: -1.4, z: -11.5, r: 2.1,
                color: "#bae6fd",
                presetKey: "crystal_glass",
                albedo: { ...DRT_MATERIAL_PRESETS.crystal_glass.albedo },
                specularExponent: 125.0,
                refractiveIndex: 1.5,
                roughness: 0.02,
                emissionIntensity: 0.0
            },
            {
                id: "drt_sp_mid",
                name: "Средний план (Матовый металл)",
                type: "sphere",
                x: 3.7, y: -1.3, z: -15.2, r: 2.2,
                color: "#fbbf24",
                presetKey: "satin_metal",
                albedo: { ...DRT_MATERIAL_PRESETS.satin_metal.albedo },
                specularExponent: 180.0,
                refractiveIndex: 1.0,
                roughness: 0.34,
                emissionIntensity: 0.0
            },
            {
                id: "drt_sp_far",
                name: "Дальний план (Боке)",
                type: "sphere",
                x: -4.8, y: -0.7, z: -20.5, r: 2.8,
                color: "#818cf8",
                presetKey: "polished_glossy",
                albedo: { ...DRT_MATERIAL_PRESETS.polished_glossy.albedo },
                specularExponent: 320.0,
                refractiveIndex: 1.0,
                roughness: 0.18,
                emissionIntensity: 0.0
            },
            {
                id: "drt_lt_main",
                name: "Студийный софтбокс",
                type: "light",
                x: -4.0, y: 8.5, z: -8.5,
                intensity: 1.8,
                radius: 1.5,
                color: "#fff7ed"
            }
        ]
    },
    glossy_studio: {
        fov: 1.15,
        bgColor: "#0f172a",
        aperture: 0.08,
        focalDistance: 13.0,
        objects: [
            {
                id: "drt_gl_floor",
                name: "Отражающий пол",
                type: "sphere",
                x: 0.0, y: -103.5, z: -14.0, r: 100.0,
                color: "#94a3b8",
                presetKey: "polished_glossy",
                albedo: { x: 0.55, y: 0.25, z: 0.35, w: 0.0 },
                specularExponent: 220.0,
                refractiveIndex: 1.0,
                roughness: 0.26,
                emissionIntensity: 0.0
            },
            {
                id: "drt_gl_left",
                name: "Зеркало (Rough 0.02)",
                type: "sphere",
                x: -4.3, y: -1.3, z: -13.0, r: 2.2,
                color: "#e2e8f0",
                presetKey: "mirror",
                albedo: { ...DRT_MATERIAL_PRESETS.mirror.albedo },
                specularExponent: 1425.0,
                refractiveIndex: 1.0,
                roughness: 0.02,
                emissionIntensity: 0.0
            },
            {
                id: "drt_gl_center",
                name: "Сатин (Rough 0.25)",
                type: "sphere",
                x: 0.0, y: -1.3, z: -13.0, r: 2.2,
                color: "#38bdf8",
                presetKey: "satin_metal",
                albedo: { ...DRT_MATERIAL_PRESETS.satin_metal.albedo },
                specularExponent: 180.0,
                refractiveIndex: 1.0,
                roughness: 0.25,
                emissionIntensity: 0.0
            },
            {
                id: "drt_gl_right",
                name: "Матовый металл (Rough 0.55)",
                type: "sphere",
                x: 4.3, y: -1.3, z: -13.0, r: 2.2,
                color: "#f59e0b",
                presetKey: "satin_metal",
                albedo: { ...DRT_MATERIAL_PRESETS.satin_metal.albedo },
                specularExponent: 90.0,
                refractiveIndex: 1.0,
                roughness: 0.55,
                emissionIntensity: 0.0
            },
            {
                id: "drt_gl_lt",
                name: "Широкий источник (Полутени)",
                type: "light",
                x: -2.5, y: 8.0, z: -9.5,
                intensity: 1.9,
                radius: 1.8,
                color: "#ffffff"
            }
        ]
    },
    obj_crystal_dof: {
        fov: 1.15,
        bgColor: "#111827",
        aperture: 0.20,
        focalDistance: 10.5,
        objects: [
            {
                id: "drt_obj_floor",
                name: "Пол (Опорная плоскость)",
                type: "sphere",
                x: 0.0, y: -103.5, z: -14.0, r: 100.0,
                color: "#cbd5e1",
                secondaryColor: "#475569",
                textureType: 1,
                texScale: 1.0,
                presetKey: "matte",
                albedo: { ...DRT_MATERIAL_PRESETS.matte.albedo },
                specularExponent: 25.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            {
                id: "drt_duck",
                name: "Фокус: Хрустальная утка (.obj)",
                type: "mesh",
                meshKey: "duck",
                x: -1.4, y: -1.3, z: -10.5,
                rotX: 0, rotY: -28, rotZ: 0,
                scale: 2.1,
                smoothShading: true,
                color: "#bae6fd",
                presetKey: "crystal_glass",
                albedo: { ...DRT_MATERIAL_PRESETS.crystal_glass.albedo },
                specularExponent: 125.0,
                refractiveIndex: 1.5,
                roughness: 0.02,
                emissionIntensity: 0.0
            },
            {
                id: "drt_prism",
                name: "Фон: Матовая призма (.obj)",
                type: "mesh",
                meshKey: "prism",
                x: 3.1, y: -1.6, z: -14.0,
                rotX: 0, rotY: 22, rotZ: 0,
                scale: 2.0,
                smoothShading: false,
                color: "#fde68a",
                presetKey: "frosted_glass",
                albedo: { ...DRT_MATERIAL_PRESETS.frosted_glass.albedo },
                specularExponent: 125.0,
                refractiveIndex: 1.52,
                roughness: 0.26,
                emissionIntensity: 0.0
            },
            {
                id: "drt_obj_lt",
                name: "Площадной свет",
                type: "light",
                x: -3.5, y: 7.5, z: -9.0,
                intensity: 2.0,
                radius: 1.4,
                color: "#fff7ed"
            }
        ]
    },
    rt_classic: {
        fov: 1.50,
        bgColor: "#33b2cc",
        aperture: 0.14,
        focalDistance: 16.0,
        objects: [
            {
                id: "sp_1",
                name: "Сфера 1",
                type: "sphere",
                x: -5.0, y: 0.0, z: -16.0, r: 3.0,
                color: "#66664d",
                presetKey: "matte",
                albedo: { ...DRT_MATERIAL_PRESETS.matte.albedo },
                specularExponent: 10.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            {
                id: "sp_2",
                name: "Сфера 2",
                type: "sphere",
                x: 3.0, y: 3.0, z: -16.0, r: 5.0,
                color: "#451717",
                presetKey: "satin_metal",
                albedo: { ...DRT_MATERIAL_PRESETS.satin_metal.albedo },
                specularExponent: 180.0,
                refractiveIndex: 1.0,
                roughness: 0.22,
                emissionIntensity: 0.0
            },
            { id: "lt_1", name: "Свет 1", type: "light", x: -20.0, y: 20.0, z: 20.0, intensity: 1.5, radius: 1.4, color: "#ffffff" },
            { id: "lt_2", name: "Свет 2", type: "light", x: -10.0, y: 10.0, z: 10.0, intensity: 1.2, radius: 1.2, color: "#ffffff" },
            { id: "lt_3", name: "Свет 3", type: "light", x: -30.0, y: 10.0, z: 10.0, intensity: 1.2, radius: 1.2, color: "#ffffff" }
        ]
    }
};