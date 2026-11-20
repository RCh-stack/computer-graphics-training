let currentStepIndex = 3;
let selectedObjectId = null;
let targetSpp = 32;

function cloneSceneObjects(objects) {
    return objects.map(obj => ({
        ...obj,
        albedo: obj.albedo ? { ...obj.albedo } : undefined
    }));
}

let ptSceneObjects = cloneSceneObjects(PT_SCENE_PRESETS.gi_showcase.objects);

function hexToVec3f(hex) {
    const clean = (hex || '#ffffff').replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return { x: r, y: g, z: b };
}

function buildWasmSceneVectors() {
    const spheresVector = new Module.VectorSphere();
    const meshesVector = new Module.VectorMesh();
    const lightsVector = new Module.VectorLight();

    ptSceneObjects.forEach(obj => {
        if (obj.type === 'sphere') {
            const baseColor = hexToVec3f(obj.color);
            const emPower = Number(obj.emissionIntensity) || 0.0;
            const emission = {
                x: baseColor.x * emPower,
                y: baseColor.y * emPower,
                z: baseColor.z * emPower
            };

            const material = new Module.Material(
                obj.albedo || { x: 1.0, y: 0.0, z: 0.0, w: 0.0 },
                baseColor,
                Number(obj.specularExponent) || 10.0,
                Number(obj.refractiveIndex) || 1.0,
                emission,
                obj.roughness !== undefined ? Number(obj.roughness) : 1.0
            );

            const sphere = new Module.Sphere(
                { x: obj.x, y: obj.y, z: obj.z },
                obj.r,
                material
            );

            spheresVector.push_back(sphere);
            sphere.delete();
            material.delete();
        } else if (obj.type === 'mesh') {
            const wasmMesh = MeshLibrary.buildWasmMesh(obj, hexToVec3f, obj.albedo);
            if (wasmMesh) {
                meshesVector.push_back(wasmMesh);
                wasmMesh.delete();
            }
        } else if (obj.type === 'light') {
            const lightColor = hexToVec3f(obj.color || '#ffffff');
            const lightRadius = obj.radius !== undefined ? Number(obj.radius) : 1.0;

            const light = new Module.Light(
                { x: obj.x, y: obj.y, z: obj.z },
                Number(obj.intensity) || 1.0,
                lightRadius,
                lightColor
            );

            lightsVector.push_back(light);
            light.delete();
        }
    });

    return { spheresVector, meshesVector, lightsVector };
}