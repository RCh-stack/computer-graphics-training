const MeshLibrary = (() => {
    function parseObjText(objText, options = {}) {
        const shouldNormalize = options.normalize !== false;
        const rawVerts = [];
        const flatIndices = [];

        const lines = objText.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('#')) continue;

            if (line.startsWith('v ')) {
                const parts = line.split(/\s+/);
                if (parts.length >= 4) {
                    const x = parseFloat(parts[1]);
                    const y = parseFloat(parts[2]);
                    const z = parseFloat(parts[3]);
                    if (!Number.isNaN(x) && !Number.isNaN(y) && !Number.isNaN(z)) {
                        rawVerts.push(x, y, z);
                    }
                }
            } else if (line.startsWith('f ')) {
                const parts = line.split(/\s+/).slice(1);
                const vCount = rawVerts.length / 3;
                const faceIdx = [];

                for (let p = 0; p < parts.length; p++) {
                    const vToken = parts[p].split('/')[0];
                    if (!vToken) continue;
                    let idx = parseInt(vToken, 10);
                    if (Number.isNaN(idx)) continue;
                    idx = idx < 0 ? vCount + idx : idx - 1;
                    if (idx >= 0 && idx < vCount) {
                        faceIdx.push(idx);
                    }
                }

                for (let k = 1; k + 1 < faceIdx.length; k++) {
                    flatIndices.push(faceIdx[0], faceIdx[k], faceIdx[k + 1]);
                }
            }
        }

        const vertexCount = rawVerts.length / 3;
        const triangleCount = flatIndices.length / 3;

        if (vertexCount === 0 || triangleCount === 0) {
            return { flatVerts: [], flatIndices: [], vertexCount: 0, triangleCount: 0 };
        }

        if (shouldNormalize) {
            let minX = Infinity, minY = Infinity, minZ = Infinity;
            let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

            for (let i = 0; i < vertexCount; i++) {
                const vx = rawVerts[i * 3];
                const vy = rawVerts[i * 3 + 1];
                const vz = rawVerts[i * 3 + 2];
                if (vx < minX) minX = vx;
                if (vy < minY) minY = vy;
                if (vz < minZ) minZ = vz;
                if (vx > maxX) maxX = vx;
                if (vy > maxY) maxY = vy;
                if (vz > maxZ) maxZ = vz;
            }

            const cx = (minX + maxX) * 0.5;
            const cy = (minY + maxY) * 0.5;
            const cz = (minZ + maxZ) * 0.5;
            const maxExtent = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1e-5);
            const normScale = 2.0 / maxExtent;

            for (let i = 0; i < vertexCount; i++) {
                rawVerts[i * 3]     = (rawVerts[i * 3] - cx) * normScale;
                rawVerts[i * 3 + 1] = (rawVerts[i * 3 + 1] - cy) * normScale;
                rawVerts[i * 3 + 2] = (rawVerts[i * 3 + 2] - cz) * normScale;
            }
        }

        return {
            flatVerts: rawVerts,
            flatIndices,
            vertexCount,
            triangleCount
        };
    }

    const PRISM_OBJ = `
v  0.000  1.000  1.000
v -0.866  1.000 -0.500
v  0.866  1.000 -0.500
v  0.000 -1.000  1.000
v -0.866 -1.000 -0.500
v  0.866 -1.000 -0.500
f 1 2 3
f 4 6 5
f 1 4 5 2
f 2 5 6 3
f 3 6 4 1
`;

    const CRYSTAL_OBJ = `
v  0.0  1.35  0.0
v  0.0 -1.35  0.0
v  0.0  0.00  1.0
v  1.0  0.00  0.0
v  0.0  0.00 -1.0
v -1.0  0.00  0.0
f 1 3 4
f 1 4 5
f 1 5 6
f 1 6 3
f 2 4 3
f 2 5 4
f 2 6 5
f 2 3 6
`;

    function generateDuckObjText() {
        const rings = [
            { x: -1.42, cy:  0.26, rx: 0.04, ry: 0.04 },
            { x: -1.05, cy:  0.04, rx: 0.44, ry: 0.34 },
            { x: -0.35, cy: -0.18, rx: 0.74, ry: 0.56 },
            { x:  0.34, cy: -0.12, rx: 0.66, ry: 0.52 },
            { x:  0.50, cy:  0.38, rx: 0.30, ry: 0.28 },
            { x:  0.56, cy:  0.84, rx: 0.24, ry: 0.24 },
            { x:  0.66, cy:  1.04, rx: 0.34, ry: 0.32 },
            { x:  0.96, cy:  0.95, rx: 0.22, ry: 0.11 },
            { x:  1.34, cy:  0.91, rx: 0.13, ry: 0.05 }
        ];

        const segs = 8;
        const lines = ['# Low-Poly Crystal Duck'];

        for (let r = 0; r < rings.length; r++) {
            const ring = rings[r];
            for (let s = 0; s < segs; s++) {
                const theta = (2.0 * Math.PI * s) / segs;
                const y = ring.cy + ring.ry * Math.sin(theta);
                const z = ring.rx * Math.cos(theta);
                lines.push(`v ${ring.x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)}`);
            }
        }

        for (let s = 1; s + 1 < segs; s++) {
            lines.push(`f 1 ${s + 2} ${s + 1}`);
        }

        for (let r = 0; r + 1 < rings.length; r++) {
            const baseA = r * segs + 1;
            const baseB = (r + 1) * segs + 1;
            for (let s = 0; s < segs; s++) {
                const sNext = (s + 1) % segs;
                const a0 = baseA + s;
                const a1 = baseA + sNext;
                const b0 = baseB + s;
                const b1 = baseB + sNext;
                lines.push(`f ${a0} ${b0} ${b1} ${a1}`);
            }
        }

        const lastBase = (rings.length - 1) * segs + 1;
        for (let s = 1; s + 1 < segs; s++) {
            lines.push(`f ${lastBase} ${lastBase + s} ${lastBase + s + 1}`);
        }

        return lines.join('\n');
    }

    const BUILTIN_GEOMETRIES = {
        duck: {
            label: "Хрустальная утка (.obj)",
            data: parseObjText(generateDuckObjText(), { normalize: true })
        },
        prism: {
            label: "Оптическая призма (.obj)",
            data: parseObjText(PRISM_OBJ, { normalize: true })
        },
        crystal: {
            label: "Кристалл / Октаэдр (.obj)",
            data: parseObjText(CRYSTAL_OBJ, { normalize: true })
        }
    };

    function createCornellBoxWalls() {
        const makeQuadWall = (v0, v1, v2, v3) => ({
            flatVerts: [...v0, ...v1, ...v2, ...v3],
            flatIndices: [0, 1, 2, 0, 2, 3],
            vertexCount: 4,
            triangleCount: 2
        });

        const xL = -4.5, xR = 4.5;
        const yB = -3.5, yT = 4.5;
        const zF = -9.0, zB = -18.0;

        return [
            {
                id: "cb_floor",
                name: "Пол комнаты (.obj)",
                type: "mesh",
                meshKey: "custom_wall",
                geometry: makeQuadWall([xL, yB, zF], [xR, yB, zF], [xR, yB, zB], [xL, yB, zB]),
                x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1.0,
                smoothShading: false,
                color: "#e2e8f0",
                presetKey: "matte",
                albedo: { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
                specularExponent: 10.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            {
                id: "cb_ceil",
                name: "Потолок комнаты (.obj)",
                type: "mesh",
                meshKey: "custom_wall",
                geometry: makeQuadWall([xL, yT, zB], [xR, yT, zB], [xR, yT, zF], [xL, yT, zF]),
                x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1.0,
                smoothShading: false,
                color: "#e2e8f0",
                presetKey: "matte",
                albedo: { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
                specularExponent: 10.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            {
                id: "cb_back",
                name: "Задняя стена (.obj)",
                type: "mesh",
                meshKey: "custom_wall",
                geometry: makeQuadWall([xL, yB, zB], [xR, yB, zB], [xR, yT, zB], [xL, yT, zB]),
                x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1.0,
                smoothShading: false,
                color: "#cbd5e1",
                presetKey: "matte",
                albedo: { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
                specularExponent: 10.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            {
                id: "cb_left",
                name: "Левая стена — Красная (.obj)",
                type: "mesh",
                meshKey: "custom_wall",
                geometry: makeQuadWall([xL, yB, zF], [xL, yB, zB], [xL, yT, zB], [xL, yT, zF]),
                x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1.0,
                smoothShading: false,
                color: "#ef4444",
                presetKey: "matte",
                albedo: { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
                specularExponent: 10.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            },
            {
                id: "cb_right",
                name: "Правая стена — Зелёная (.obj)",
                type: "mesh",
                meshKey: "custom_wall",
                geometry: makeQuadWall([xR, yB, zB], [xR, yB, zF], [xR, yT, zF], [xR, yT, zB]),
                x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1.0,
                smoothShading: false,
                color: "#22c55e",
                presetKey: "matte",
                albedo: { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
                specularExponent: 10.0,
                refractiveIndex: 1.0,
                roughness: 1.0,
                emissionIntensity: 0.0
            }
        ];
    }

    function getGeometry(meshKey) {
        return BUILTIN_GEOMETRIES[meshKey]?.data || BUILTIN_GEOMETRIES.duck.data;
    }

    function buildWasmMesh(obj, colorToVec3Fn, effectiveAlbedo) {
        const geom = obj.geometry || getGeometry(obj.meshKey || 'duck');
        if (!geom || !geom.flatVerts || geom.flatVerts.length === 0) return null;

        const baseColor = colorToVec3Fn(obj.color);
        const emPower = Number(obj.emissionIntensity) || 0.0;
        const emission = {
            x: baseColor.x * emPower,
            y: baseColor.y * emPower,
            z: baseColor.z * emPower
        };

        const mat = new Module.Material(
            effectiveAlbedo || obj.albedo || { x: 0.9, y: 0.1, z: 0.0, w: 0.0 },
            baseColor,
            Number(obj.specularExponent) || 10.0,
            Number(obj.refractiveIndex) || 1.0,
            emission,
            obj.roughness !== undefined ? Number(obj.roughness) : 1.0
        );
        window.TextureManager?.applyMaterialTexture(mat, obj, colorToVec3Fn);

        const mesh = new Module.Mesh(mat);
        const vVec = new Module.VectorFloat();
        const iVec = new Module.VectorInt();

        for (let i = 0; i < geom.flatVerts.length; i++) {
            vVec.push_back(geom.flatVerts[i]);
        }
        for (let i = 0; i < geom.flatIndices.length; i++) {
            iVec.push_back(geom.flatIndices[i]);
        }

        mesh.setGeometry(vVec, iVec);

        const deg2rad = Math.PI / 180.0;
        mesh.setTransform(
            { x: Number(obj.x) || 0, y: Number(obj.y) || 0, z: Number(obj.z) || 0 },
            {
                x: (Number(obj.rotX) || 0) * deg2rad,
                y: (Number(obj.rotY) || 0) * deg2rad,
                z: (Number(obj.rotZ) || 0) * deg2rad
            },
            Number(obj.scale) || 1.0
        );
        mesh.smoothShading = Boolean(obj.smoothShading);
        mesh.useBVH = obj.useBVH !== false;
        obj._bvhNodeCount = mesh.bvhNodeCount();

        vVec.delete();
        iVec.delete();
        mat.delete();

        return mesh;
    }

    return {
        parseObjText,
        BUILTIN_GEOMETRIES,
        getGeometry,
        createCornellBoxWalls,
        buildWasmMesh
    };
})();