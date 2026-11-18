const WIDTH = 1168;
const HEIGHT = 638;

const TARGET_PREVIEW_MS = 22;
const MIN_PREVIEW_SCALE = 0.15;
const MAX_PREVIEW_SCALE = 0.50;
const DEFAULT_PREVIEW_SCALE = 0.35;
const PREVIEW_SCALE_STEP = 0.05;

const PT_STEPS = [
    {
        id: 0,
        title: "0. EMISSION & ALBEDO",
        desc: "Первичные лучи из камеры (Primary Rays). Отображаются только базовое альбедо поверхностей и собственное свечение объектов (Emission) без расчёта теней и отскоков."
    },
    {
        id: 1,
        title: "1. DIRECT AREA LIGHT",
        desc: "Прямое освещение от площадных источников света (Next Event Estimation). Случайная выборка точек на сфере источника формирует физически корректные мягкие полутени (Penumbra)."
    },
    {
        id: 2,
        title: "2. ONE-BOUNCE GI",
        desc: "Добавление 1 непрямого отскока по косинус-взвешенной полусфере. Возникает взаимный цветовой рефлекс (Color Bleeding) между близко расположенными поверхностями."
    },
    {
        id: 3,
        title: "3. MULTI-BOUNCE GI (MONTE CARLO)",
        desc: "Полная стохастическая трассировка путей (до 5 отскоков с отсечением Russian Roulette): многократные отражения, преломления Френеля и глобальное освещение."
    }
];

const PT_MATERIAL_PRESETS = {
    matte: {
        name: "Матовый (Ламберт)",
        albedo: { x: 1.0, y: 0.0, z: 0.0, w: 0.0 },
        specularExponent: 10.0,
        refractiveIndex: 1.0,
        roughness: 1.0,
        emissionIntensity: 0.0
    },
    glossy: {
        name: "Глянцевый (Rough Specular)",
        albedo: { x: 0.35, y: 0.5, z: 0.65, w: 0.0 },
        specularExponent: 200.0,
        refractiveIndex: 1.0,
        roughness: 0.25,
        emissionIntensity: 0.0
    },
    mirror: {
        name: "Зеркало (Ideal Specular)",
        albedo: { x: 0.0, y: 1.0, z: 1.0, w: 0.0 },
        specularExponent: 1425.0,
        refractiveIndex: 1.0,
        roughness: 0.0,
        emissionIntensity: 0.0
    },
    glass: {
        name: "Стекло (Диэлектрик Френеля)",
        albedo: { x: 0.0, y: 0.5, z: 0.1, w: 0.9 },
        specularExponent: 125.0,
        refractiveIndex: 1.5,
        roughness: 0.02,
        emissionIntensity: 0.0
    },
    emissive: {
        name: "Светящийся объект (Emission)",
        albedo: { x: 0.1, y: 0.0, z: 0.0, w: 0.0 },
        specularExponent: 10.0,
        refractiveIndex: 1.0,
        roughness: 1.0,
        emissionIntensity: 3.5
    }
};

const PT_SCENE_PRESETS = {
    gi_showcase: {
        fov: 1.20,
        bgColor: "#141b29",
        objects: [
            {
                id: "pt_floor",
                name: "Пол (Опорная плоскость)",
                type: "sphere",
                x: 0.0, y: -103.5, z: -16.0, r: 100.0,
                color: "#cbd5e1",
                presetKey: "matte",
                albedo: PT_MATERIAL_PRESETS.matte.albedo,
                specularExponent: 10.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            {
                id: "pt_sp_red",
                name: "Красная сфера (GI рефлекс)",
                type: "sphere",
                x: -4.2, y: -1.1, z: -14.5, r: 2.4,
                color: "#ef4444",
                presetKey: "matte",
                albedo: PT_MATERIAL_PRESETS.matte.albedo,
                specularExponent: 10.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            {
                id: "pt_sp_center",
                name: "Белая сфера (Приёмник GI)",
                type: "sphere",
                x: 0.2, y: -1.3, z: -13.5, r: 2.2,
                color: "#f8fafc",
                presetKey: "matte",
                albedo: PT_MATERIAL_PRESETS.matte.albedo,
                specularExponent: 10.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            {
                id: "pt_sp_glass",
                name: "Стеклянная сфера",
                type: "sphere",
                x: 4.3, y: -1.4, z: -12.5, r: 2.1,
                color: "#bae6fd",
                presetKey: "glass",
                albedo: PT_MATERIAL_PRESETS.glass.albedo,
                specularExponent: 125.0,
                refractiveIndex: 1.5,
                roughness: 0.02,
                emissionIntensity: 0.0
            },
            {
                id: "pt_lt_main",
                name: "Площадной свет (Мягкие тени)",
                type: "light",
                x: -3.5, y: 7.5, z: -10.5,
                intensity: 2.2,
                radius: 1.4,
                color: "#fff7ed"
            }
        ]
    },
    rt_classic: {
        fov: 1.50,
        bgColor: "#33b2cc",
        objects: [
            {
                id: "sp_1",
                name: "Сфера 1",
                type: "sphere",
                x: -5.0, y: 0.0, z: -16.0, r: 3.0,
                color: "#66664d",
                presetKey: "matte",
                albedo: PT_MATERIAL_PRESETS.matte.albedo,
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
                presetKey: "matte",
                albedo: PT_MATERIAL_PRESETS.matte.albedo,
                specularExponent: 10.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            { id: "lt_1", name: "Свет 1", type: "light", x: -20.0, y: 20.0, z: 20.0, intensity: 1.5, radius: 1.2, color: "#ffffff" },
            { id: "lt_2", name: "Свет 2", type: "light", x: -10.0, y: 10.0, z: 10.0, intensity: 1.2, radius: 1.0, color: "#ffffff" },
            { id: "lt_3", name: "Свет 3", type: "light", x: -30.0, y: 10.0, z: 10.0, intensity: 1.2, radius: 1.0, color: "#ffffff" }
        ]
    }
};