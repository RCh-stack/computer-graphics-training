const WIDTH = 1168;
const HEIGHT = 638;

const STEPS = [
    { id: 0, title: "0. BACKGROUND", desc: "Генерация первичного пучка лучей из камеры (Ray Casting). Если луч не пересекает ни один объект сцены, возвращается базовый цвет фона." },
    { id: 1, title: "1. DIFFUSE", desc: "Поиск ближайшей точки пересечения луча со сферами методом решения квадратного уравнения. Визуализация нормалей поверхностей." },
    { id: 2, title: "2. SPECULAR", desc: "Трассировка лучей к источникам света (Shadow Rays). Расчет освещенности по скалярному произведению нормали и вектора на свет." },
    { id: 3, title: "3. SHADOWS", desc: "Рекурсивный вызов cast_ray для отраженного направления R = I - 2(I·N)N от материалов с физическим коэффициентом отражения." },
    { id: 4, title: "4. REFLECTION", desc: "Расчет траектории преломленного луча внутри прозрачных сред с учетом показателя преломления материала (Fresnel equation)." },
    { id: 5, title: "5. REFRACTION", desc: "Полный рендеринг физических эффектов преломления и прозрачности." }
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
        name: "Стекло (Refraction)",
        albedo: { x: 0.0, y: 0.5, z: 0.1, w: 0.8 },
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