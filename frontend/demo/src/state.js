let currentStepIndex = 0;
let selectedObjectId = null;

function cloneRtSceneObjects(objects) {
    return objects.map(obj => ({
        ...obj,
        albedo: obj.albedo ? { ...obj.albedo } : undefined
    }));
}

let sceneObjects = cloneRtSceneObjects(RT_SCENE_PRESETS.rt_classic.objects);

function hexToVec3f(hex) {
    const clean = (hex || '#ffffff').replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
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