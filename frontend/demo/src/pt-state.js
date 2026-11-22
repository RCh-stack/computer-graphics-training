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

const ptWasmMeshCache = new Map();
const ptWasmSphereCache = new Map();

function getPtTextureSlotVersion(textureId) {
    if (textureId === undefined || textureId === null || Number(textureId) < 0) return 0;
    return window.TextureManager?.getTextureSlot(Number(textureId))?.version || 0;
}

function buildPtMaterialSignature(obj) {
    const a = obj.albedo || {};
    const texVer = getPtTextureSlotVersion(obj.textureId);
    return `${a.x}|${a.y}|${a.z}|${a.w}|${obj.color}|${obj.specularExponent}|${obj.refractiveIndex}|${obj.roughness}|${obj.emissionIntensity}|${obj.textureType}|${obj.texScale}|${obj.textureId}|${obj.secondaryColor}|${texVer}`;
}

function clearPtWasmMeshCache() {
    ptWasmMeshCache.forEach(entry => {
        if (entry && entry.mesh) {
            entry.mesh.delete();
        }
    });
    ptWasmMeshCache.clear();
}

function clearPtWasmSphereCache() {
    ptWasmSphereCache.forEach(entry => {
        if (entry && entry.sphere) {
            entry.sphere.delete();
        }
    });
    ptWasmSphereCache.clear();
}

function prunePtWasmMeshCache() {
    if (ptWasmMeshCache.size === 0) return;
    const activeIds = new Set(ptSceneObjects.filter(o => o.type === 'mesh').map(o => o.id));
    ptWasmMeshCache.forEach((entry, id) => {
        if (!activeIds.has(id)) {
            if (entry && entry.mesh) entry.mesh.delete();
            ptWasmMeshCache.delete(id);
        }
    });
}

function prunePtWasmSphereCache() {
    if (ptWasmSphereCache.size === 0) return;
    const activeIds = new Set(ptSceneObjects.filter(o => o.type === 'sphere').map(o => o.id));
    ptWasmSphereCache.forEach((entry, id) => {
        if (!activeIds.has(id)) {
            if (entry && entry.sphere) entry.sphere.delete();
            ptWasmSphereCache.delete(id);
        }
    });
}

function getCachedPtWasmSphere(obj) {
    const sig = `${obj.x}|${obj.y}|${obj.z}|${obj.r}|${buildPtMaterialSignature(obj)}`;
    const cached = ptWasmSphereCache.get(obj.id);
    if (cached && cached.sig === sig) {
        return cached.sphere;
    }

    if (cached && cached.sphere) {
        cached.sphere.delete();
    }

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
    window.TextureManager?.applyMaterialTexture(material, obj, hexToVec3f);

    const sphere = new Module.Sphere(
        { x: obj.x, y: obj.y, z: obj.z },
        obj.r,
        material
    );
    material.delete();

    ptWasmSphereCache.set(obj.id, { sig, sphere });
    return sphere;
}

function getCachedPtWasmMesh(obj) {
    const geomKey = obj.geometry ? 'custom' : (obj.meshKey || '');
    const geomRef = obj.geometry || null;
    const useBVH = obj.useBVH !== false;
    const smooth = Boolean(obj.smoothShading);
    const matSig = buildPtMaterialSignature(obj);

    const tx = obj.x || 0;
    const ty = obj.y || 0;
    const tz = obj.z || 0;
    const rx = obj.rotX || 0;
    const ry = obj.rotY || 0;
    const rz = obj.rotZ || 0;
    const scale = obj.scale !== undefined ? obj.scale : 1.0;

    let cached = ptWasmMeshCache.get(obj.id);
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
        const mesh = MeshLibrary.buildWasmMesh(obj, hexToVec3f, obj.albedo);
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
        ptWasmMeshCache.set(obj.id, cached);
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
        const baseColor = hexToVec3f(obj.color);
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
        window.TextureManager?.applyMaterialTexture(material, obj, hexToVec3f);
        cached.mesh.material = material;
        material.delete();
        cached.matSig = matSig;
    }

    return cached.mesh;
}

function hexToVec3f(hex) {
    const clean = (hex || '#ffffff').replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return { x: r, y: g, z: b };
}

function buildWasmSceneVectors() {
    prunePtWasmMeshCache();
    prunePtWasmSphereCache();

    const spheresVector = new Module.VectorSphere();
    const meshesVector = new Module.VectorMesh();
    const lightsVector = new Module.VectorLight();

    ptSceneObjects.forEach(obj => {
        if (obj.type === 'sphere') {
            const wasmSphere = getCachedPtWasmSphere(obj);
            if (wasmSphere) {
                spheresVector.push_back(wasmSphere);
            }
        } else if (obj.type === 'mesh') {
            const wasmMesh = getCachedPtWasmMesh(obj);
            if (wasmMesh) {
                meshesVector.push_back(wasmMesh);
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