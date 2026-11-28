let drtCurrentStepIndex = 3;
let drtSelectedObjectId = null;
let drtTargetSpp = 32;
let drtAperture = DRT_SCENE_PRESETS.dof_showcase.aperture;
let drtFocalDistance = DRT_SCENE_PRESETS.dof_showcase.focalDistance;

function cloneDrtSceneObjects(objects) {
    return objects.map(obj => ({
        ...obj,
        albedo: obj.albedo ? { ...obj.albedo } : undefined
    }));
}

let drtSceneObjects = cloneDrtSceneObjects(DRT_SCENE_PRESETS.dof_showcase.objects);

const drtWasmMeshCache = new Map();
const drtWasmSphereCache = new Map();

function getDrtTextureSlotVersion(textureId) {
    if (textureId === undefined || textureId === null || Number(textureId) < 0) return 0;
    return window.TextureManager?.getTextureSlot(Number(textureId))?.version || 0;
}

function buildDrtMaterialSignature(obj) {
    const a = obj.albedo || {};
    const texVer = getDrtTextureSlotVersion(obj.textureId);
    return `${a.x}|${a.y}|${a.z}|${a.w}|${obj.color}|${obj.specularExponent}|${obj.refractiveIndex}|${obj.roughness}|${obj.emissionIntensity}|${obj.textureType}|${obj.texScale}|${obj.textureId}|${obj.secondaryColor}|${texVer}`;
}

function clearDrtWasmMeshCache() {
    drtWasmMeshCache.forEach(entry => {
        if (entry && entry.mesh) {
            entry.mesh.delete();
        }
    });
    drtWasmMeshCache.clear();
}

function clearDrtWasmSphereCache() {
    drtWasmSphereCache.forEach(entry => {
        if (entry && entry.sphere) {
            entry.sphere.delete();
        }
    });
    drtWasmSphereCache.clear();
}

function pruneDrtWasmMeshCache() {
    if (drtWasmMeshCache.size === 0) return;
    const activeIds = new Set(drtSceneObjects.filter(o => o.type === 'mesh').map(o => o.id));
    drtWasmMeshCache.forEach((entry, id) => {
        if (!activeIds.has(id)) {
            if (entry && entry.mesh) entry.mesh.delete();
            drtWasmMeshCache.delete(id);
        }
    });
}

function pruneDrtWasmSphereCache() {
    if (drtWasmSphereCache.size === 0) return;
    const activeIds = new Set(drtSceneObjects.filter(o => o.type === 'sphere').map(o => o.id));
    drtWasmSphereCache.forEach((entry, id) => {
        if (!activeIds.has(id)) {
            if (entry && entry.sphere) entry.sphere.delete();
            drtWasmSphereCache.delete(id);
        }
    });
}

function drtHexToVec3f(hex) {
    const clean = (hex || '#ffffff').replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return { x: r, y: g, z: b };
}

function getCachedDrtWasmSphere(obj) {
    const sig = `${obj.x}|${obj.y}|${obj.z}|${obj.r}|${buildDrtMaterialSignature(obj)}`;
    const cached = drtWasmSphereCache.get(obj.id);
    if (cached && cached.sig === sig) {
        return cached.sphere;
    }

    if (cached && cached.sphere) {
        cached.sphere.delete();
    }

    const baseColor = drtHexToVec3f(obj.color);
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
    window.TextureManager?.applyMaterialTexture(material, obj, drtHexToVec3f);

    const sphere = new Module.Sphere(
        { x: obj.x, y: obj.y, z: obj.z },
        obj.r,
        material
    );
    material.delete();

    drtWasmSphereCache.set(obj.id, { sig, sphere });
    return sphere;
}

function getCachedDrtWasmMesh(obj) {
    const geomKey = obj.geometry ? 'custom' : (obj.meshKey || '');
    const geomRef = obj.geometry || null;
    const useBVH = obj.useBVH !== false;
    const smooth = Boolean(obj.smoothShading);
    const matSig = buildDrtMaterialSignature(obj);

    const tx = obj.x || 0;
    const ty = obj.y || 0;
    const tz = obj.z || 0;
    const rx = obj.rotX || 0;
    const ry = obj.rotY || 0;
    const rz = obj.rotZ || 0;
    const scale = obj.scale !== undefined ? obj.scale : 1.0;

    let cached = drtWasmMeshCache.get(obj.id);
    if (
        !cached ||
        cached.geomKey !== geomKey ||
        cached.geomRef !== geomRef ||
        cached.useBVH !== useBVH ||
        cached.smooth !== smooth
    ) {
        if (cached && cached.mesh) {
            cached.mesh.delete();
        }
        const mesh = MeshLibrary.buildWasmMesh(obj, drtHexToVec3f, obj.albedo);
        if (!mesh) return null;

        cached = {
            mesh,
            geomKey,
            geomRef,
            useBVH,
            smooth,
            matSig,
            tx, ty, tz,
            rx, ry, rz,
            scale
        };
        drtWasmMeshCache.set(obj.id, cached);
        return mesh;
    }

    if (
        cached.tx !== tx || cached.ty !== ty || cached.tz !== tz ||
        cached.rx !== rx || cached.ry !== ry || cached.rz !== rz ||
        cached.scale !== scale
    ) {
        cached.mesh.setTransform(
            { x: tx, y: ty, z: tz },
            { x: rx, y: ry, z: rz },
            scale
        );
        cached.tx = tx;
        cached.ty = ty;
        cached.tz = tz;
        cached.rx = rx;
        cached.ry = ry;
        cached.rz = rz;
        cached.scale = scale;
    }

    if (cached.matSig !== matSig) {
        const baseColor = drtHexToVec3f(obj.color);
        const emPower = Number(obj.emissionIntensity) || 0.0;
        const material = new Module.Material(
            obj.albedo || { x: 1.0, y: 0.0, z: 0.0, w: 0.0 },
            baseColor,
            Number(obj.specularExponent) || 10.0,
            Number(obj.refractiveIndex) || 1.0,
            {
                x: baseColor.x * emPower,
                y: baseColor.y * emPower,
                z: baseColor.z * emPower
            },
            obj.roughness !== undefined ? Number(obj.roughness) : 1.0
        );
        window.TextureManager?.applyMaterialTexture(material, obj, drtHexToVec3f);
        cached.mesh.material = material;
        material.delete();
        cached.matSig = matSig;
    }

    return cached.mesh;
}

function buildDrtWasmSceneVectors() {
    pruneDrtWasmMeshCache();
    pruneDrtWasmSphereCache();

    const spheresVector = new Module.VectorSphere();
    const meshesVector = new Module.VectorMesh();
    const lightsVector = new Module.VectorLight();

    drtSceneObjects.forEach(obj => {
        if (obj.type === 'sphere') {
            const wasmSphere = getCachedDrtWasmSphere(obj);
            if (wasmSphere) {
                spheresVector.push_back(wasmSphere);
            }
        } else if (obj.type === 'mesh') {
            const wasmMesh = getCachedDrtWasmMesh(obj);
            if (wasmMesh) {
                meshesVector.push_back(wasmMesh);
            }
        } else if (obj.type === 'light') {
            const lightColor = drtHexToVec3f(obj.color || '#ffffff');
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