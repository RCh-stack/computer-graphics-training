const WIDTH = 1168;
const HEIGHT = 638;

const TARGET_PREVIEW_MS = 14;
const MIN_PREVIEW_SCALE = 0.15;
const MAX_PREVIEW_SCALE = 0.55;
const DEFAULT_PREVIEW_SCALE = 0.35;
const PREVIEW_SCALE_STEP = 0.05;

const STEPS = [
    { id: 0, title: "0. BACKGROUND", desc: "Генерация первичного пучка лучей из камеры (Ray Casting). Если луч не пересекает ни один объект сцены, возвращается базовый цвет фона." },
    { id: 1, title: "1. DIFFUSE", desc: "Поиск ближайшей точки пересечения луча со сферами и треугольниками мешей (с отсечением по AABB). Расчёт диффузного освещения по Ламберту." },
    { id: 2, title: "2. SPECULAR", desc: "Расчёт зеркальных бликов по модели Фонга (Blinn-Phong) с учётом вектора отражения и направления взгляда." },
    { id: 3, title: "3. SHADOWS", desc: "Трассировка теневых лучей (Shadow Rays) к точечным источникам света с проверкой перекрытия сферами и треугольниками." },
    { id: 4, title: "4. REFLECTION", desc: "Рекурсивный вызов трассировки для отражённого направления R = I - 2(I·N)N от зеркальных и хрустальных поверхностей." },
    { id: 5, title: "5. REFRACTION", desc: "Полный рендеринг преломления по закону Снеллиуса (Snell's Law) внутри прозрачных сред и полигональных кристаллов." }
];

const MATERIAL_PRESETS = {
    matte: {
        name: "Матовый (Diffuse)",
        albedo: { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
        specularExponent: 10.0,
        refractiveIndex: 1.0
    },
    mirror: {
        name: "Зеркало (Specular/Reflection)",
        albedo: { x: 0.0, y: 10.0, z: 0.8, w: 0.0 },
        specularExponent: 1425.0,
        refractiveIndex: 1.0
    },
    glass: {
        name: "Стекло / Хрусталь (Refraction)",
        albedo: { x: 0.0, y: 0.5, z: 0.1, w: 0.85 },
        specularExponent: 125.0,
        refractiveIndex: 1.5
    },
    semitrans: {
        name: "Полупрозрачный пластик",
        albedo: { x: 0.4, y: 0.2, z: 0.1, w: 0.3 },
        specularExponent: 50.0,
        refractiveIndex: 1.2
    }
};

const RT_SCENE_PRESETS = {
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
                albedo: MATERIAL_PRESETS.matte.albedo,
                specularExponent: MATERIAL_PRESETS.matte.specularExponent,
                refractiveIndex: MATERIAL_PRESETS.matte.refractiveIndex
            },
            {
                id: "sp_2",
                name: "Сфера 2",
                type: "sphere",
                x: 3.0, y: 3.0, z: -16.0, r: 5.0,
                color: "#451717",
                presetKey: "matte",
                albedo: MATERIAL_PRESETS.matte.albedo,
                specularExponent: MATERIAL_PRESETS.matte.specularExponent,
                refractiveIndex: MATERIAL_PRESETS.matte.refractiveIndex
            },
            { id: "lt_1", name: "Свет 1", type: "light", x: -20.0, y: 20.0, z: 20.0, intensity: 1.5 },
            { id: "lt_2", name: "Свет 2", type: "light", x: -10.0, y: 10.0, z: 10.0, intensity: 1.2 },
            { id: "lt_3", name: "Свет 3", type: "light", x: -30.0, y: 10.0, z: 10.0, intensity: 1.2 }
        ]
    },
    obj_crystal: {
        fov: 1.15,
        bgColor: "#16213e",
        objects: [
            {
                id: "rt_floor_sp",
                name: "Опорная сфера-пол",
                type: "sphere",
                x: 0.0, y: -103.5, z: -14.0, r: 100.0,
                color: "#475569",
                presetKey: "matte",
                albedo: MATERIAL_PRESETS.matte.albedo,
                specularExponent: 15.0,
                refractiveIndex: 1.0
            },
            {
                id: "rt_duck",
                name: "Хрустальная утка (.obj)",
                type: "mesh",
                meshKey: "duck",
                x: -1.4, y: -1.3, z: -10.5,
                rotX: 0, rotY: -28, rotZ: 0,
                scale: 2.1,
                smoothShading: true,
                color: "#bae6fd",
                presetKey: "glass",
                albedo: MATERIAL_PRESETS.glass.albedo,
                specularExponent: MATERIAL_PRESETS.glass.specularExponent,
                refractiveIndex: 1.5
            },
            {
                id: "rt_prism",
                name: "Оптическая призма (.obj)",
                type: "mesh",
                meshKey: "prism",
                x: 3.1, y: -1.6, z: -11.5,
                rotX: 0, rotY: 22, rotZ: 0,
                scale: 1.9,
                smoothShading: false,
                color: "#fde68a",
                presetKey: "glass",
                albedo: MATERIAL_PRESETS.glass.albedo,
                specularExponent: MATERIAL_PRESETS.glass.specularExponent,
                refractiveIndex: 1.55
            },
            {
                id: "rt_bg_sphere",
                name: "Контрастная сфера (за уткой)",
                type: "sphere",
                x: -0.6, y: -1.4, z: -15.5, r: 2.1,
                color: "#f43f5e",
                presetKey: "matte",
                albedo: MATERIAL_PRESETS.matte.albedo,
                specularExponent: 25.0,
                refractiveIndex: 1.0
            },
            { id: "rt_obj_lt1", name: "Свет 1", type: "light", x: -12.0, y: 16.0, z: 6.0, intensity: 1.6 },
            { id: "rt_obj_lt2", name: "Свет 2", type: "light", x: 14.0, y: 12.0, z: 4.0, intensity: 1.2 }
        ]
    },
    obj_cornell: {
        fov: 1.15,
        bgColor: "#0f172a",
        objects: [
            ...MeshLibrary.createCornellBoxWalls(),
            {
                id: "rt_cb_duck",
                name: "Хрустальная утка (.obj)",
                type: "mesh",
                meshKey: "duck",
                x: -1.6, y: -1.5, z: -13.0,
                rotX: 0, rotY: -35, rotZ: 0,
                scale: 1.9,
                smoothShading: true,
                color: "#e0f2fe",
                presetKey: "glass",
                albedo: MATERIAL_PRESETS.glass.albedo,
                specularExponent: 125.0,
                refractiveIndex: 1.5
            },
            {
                id: "rt_cb_mirror",
                name: "Зеркальная сфера",
                type: "sphere",
                x: 2.0, y: -1.8, z: -14.2, r: 1.7,
                color: "#ffffff",
                presetKey: "mirror",
                albedo: MATERIAL_PRESETS.mirror.albedo,
                specularExponent: 1425.0,
                refractiveIndex: 1.0
            },
            { id: "rt_cb_lt", name: "Потолочный свет", type: "light", x: 0.0, y: 3.6, z: -13.5, intensity: 1.6 }
        ]
    }
};