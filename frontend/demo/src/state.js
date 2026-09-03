let currentStepIndex = 0;
let selectedObjectId = null;

let sceneObjects = [
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
];

function hexToVec3f(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { x: r, y: g, z: b };
}

function getStepAdaptedAlbedo(baseAlbedo, step) 
{
    switch (step) {
        case 0:
            return { x: 1.0, y: 0.0, z: 0.0, w: 0.0 };
        case 1:
            return { x: 1.0, y: 0.0, z: 0.0, w: 0.0 };
        case 2:
            return { x: baseAlbedo.x, y: baseAlbedo.y, z: 0.0, w: 0.0 };
        case 3:
            return { x: baseAlbedo.x, y: baseAlbedo.y, z: 0.0, w: 0.0 };
        case 4:
            return { x: baseAlbedo.x, y: baseAlbedo.y, z: baseAlbedo.z, w: 0.0 };
        case 5:
            return { x: baseAlbedo.x, y: baseAlbedo.y, z: baseAlbedo.z, w: baseAlbedo.w };
        default:
            return baseAlbedo;
    }
}