#ifndef MESH_H
#define MESH_H

#include <vector>
#include <cstdint>
#include <cmath>
#include <algorithm>
#include <limits>
#include "geometry.h"
#include "material.h"
#include "render_metrics.h"

struct BVHNode
{
    Vec3f bboxMin;
    uint32_t leftFirst;
    Vec3f bboxMax;
    uint32_t triCount;
};

struct Mesh
{
    std::vector<Vec3f> localVerts;
    std::vector<Vec3i> faces;
    std::vector<Vec3f> worldVerts;
    std::vector<Vec3f> faceNormals;
    std::vector<Vec3f> worldVertNormals;

    std::vector<BVHNode> bvhNodes;
    std::vector<uint32_t> bvhTriIndices;

    Vec3f bboxMin;
    Vec3f bboxMax;

    Vec3f position;
    Vec3f rotation;
    float scale;
    bool smoothShading;
    bool useBVH;
    Material material;

    Mesh()
        : bboxMin(), bboxMax(), position(0.f, 0.f, 0.f),
          rotation(0.f, 0.f, 0.f), scale(1.0f), smoothShading(false), useBVH(true), material() {}

    explicit Mesh(const Material &m)
        : bboxMin(), bboxMax(), position(0.f, 0.f, 0.f),
          rotation(0.f, 0.f, 0.f), scale(1.0f), smoothShading(false), useBVH(true), material(m) {}

    size_t triangleCount() const {
        return faces.size();
    }

    size_t bvhNodeCount() const {
        return bvhNodes.size();
    }

    void setGeometry(const std::vector<float> &flatVerts, const std::vector<int> &flatIndices)
    {
        const size_t vCount = flatVerts.size() / 3;
        localVerts.resize(vCount);
        for (size_t i = 0; i < vCount; i++) {
            localVerts[i] = Vec3f(
                flatVerts[i * 3],
                flatVerts[i * 3 + 1],
                flatVerts[i * 3 + 2]
            );
        }

        const size_t fCount = flatIndices.size() / 3;
        faces.clear();
        faces.reserve(fCount);
        for (size_t i = 0; i < fCount; i++) {
            int i0 = flatIndices[i * 3];
            int i1 = flatIndices[i * 3 + 1];
            int i2 = flatIndices[i * 3 + 2];
            if (i0 >= 0 && i1 >= 0 && i2 >= 0 &&
                static_cast<size_t>(i0) < vCount &&
                static_cast<size_t>(i1) < vCount &&
                static_cast<size_t>(i2) < vCount) {
                faces.push_back(Vec3i(i0, i1, i2));
            }
        }

        rebuildWorldData();
    }

    void setTransform(const Vec3f &pos, const Vec3f &rotEuler, float sc)
    {
        position = pos;
        rotation = rotEuler;
        scale = sc;
        rebuildWorldData();
    }

    static inline Vec3f rotateEuler(const Vec3f &v, const Vec3f &rot)
    {
        const float cx = std::cos(rot.x), sx = std::sin(rot.x);
        const float cy = std::cos(rot.y), sy = std::sin(rot.y);
        const float cz = std::cos(rot.z), sz = std::sin(rot.z);

        const float y1 = v.y * cx - v.z * sx;
        const float z1 = v.y * sx + v.z * cx;

        const float x2 = v.x * cy + z1 * sy;
        const float z2 = -v.x * sy + z1 * cy;

        const float x3 = x2 * cz - y1 * sz;
        const float y3 = x2 * sz + y1 * cz;

        return Vec3f(x3, y3, z2);
    }

    void rebuildWorldData()
    {
        const size_t vCount = localVerts.size();
        const size_t fCount = faces.size();

        worldVerts.resize(vCount);
        worldVertNormals.assign(vCount, Vec3f(0.f, 0.f, 0.f));
        faceNormals.resize(fCount);
        bvhNodes.clear();
        bvhTriIndices.clear();

        if (vCount == 0 || fCount == 0) {
            bboxMin = position;
            bboxMax = position;
            return;
        }

        bboxMin = Vec3f(
            std::numeric_limits<float>::max(),
            std::numeric_limits<float>::max(),
            std::numeric_limits<float>::max()
        );
        bboxMax = Vec3f(
            std::numeric_limits<float>::lowest(),
            std::numeric_limits<float>::lowest(),
            std::numeric_limits<float>::lowest()
        );

        for (size_t i = 0; i < vCount; i++) {
            Vec3f scaled = localVerts[i] * scale;
            Vec3f wv = rotateEuler(scaled, rotation) + position;
            worldVerts[i] = wv;

            bboxMin.x = std::min(bboxMin.x, wv.x);
            bboxMin.y = std::min(bboxMin.y, wv.y);
            bboxMin.z = std::min(bboxMin.z, wv.z);

            bboxMax.x = std::max(bboxMax.x, wv.x);
            bboxMax.y = std::max(bboxMax.y, wv.y);
            bboxMax.z = std::max(bboxMax.z, wv.z);
        }

        bboxMin = bboxMin - Vec3f(1e-3f, 1e-3f, 1e-3f);
        bboxMax = bboxMax + Vec3f(1e-3f, 1e-3f, 1e-3f);

        for (size_t f = 0; f < fCount; f++) {
            const int i0 = faces[f].x;
            const int i1 = faces[f].y;
            const int i2 = faces[f].z;

            const Vec3f e1 = worldVerts[i1] - worldVerts[i0];
            const Vec3f e2 = worldVerts[i2] - worldVerts[i0];
            Vec3f rawN = cross(e1, e2);

            worldVertNormals[i0] = worldVertNormals[i0] + rawN;
            worldVertNormals[i1] = worldVertNormals[i1] + rawN;
            worldVertNormals[i2] = worldVertNormals[i2] + rawN;

            if (norm2(rawN) > 1e-12f) {
                faceNormals[f] = rawN.normalize();
            } else {
                faceNormals[f] = Vec3f(0.f, 1.f, 0.f);
            }
        }

        for (size_t i = 0; i < vCount; i++) {
            if (norm2(worldVertNormals[i]) > 1e-12f) {
                worldVertNormals[i].normalize();
            } else {
                worldVertNormals[i] = Vec3f(0.f, 1.f, 0.f);
            }
        }

        buildBVH();
    }

    static inline Vec3f computeInvDir(const Vec3f &dir)
    {
        return Vec3f(
            std::fabs(dir.x) < 1e-8f ? (dir.x < 0.f ? -1e8f : 1e8f) : (1.0f / dir.x),
            std::fabs(dir.y) < 1e-8f ? (dir.y < 0.f ? -1e8f : 1e8f) : (1.0f / dir.y),
            std::fabs(dir.z) < 1e-8f ? (dir.z < 0.f ? -1e8f : 1e8f) : (1.0f / dir.z)
        );
    }

    static inline bool intersectBox(
        const Vec3f &orig,
        const Vec3f &invDir,
        const Vec3f &bmin,
        const Vec3f &bmax,
        float maxDist,
        float &outTNear)
    {
        float tmin = 1e-4f;
        float tmax = maxDist;

        for (int axis = 0; axis < 3; axis++) {
            float t1 = (bmin[axis] - orig[axis]) * invDir[axis];
            float t2 = (bmax[axis] - orig[axis]) * invDir[axis];
            if (t1 > t2) std::swap(t1, t2);
            if (t1 > tmin) tmin = t1;
            if (t2 < tmax) tmax = t2;
            if (tmin > tmax) return false;
        }
        outTNear = tmin;
        return true;
    }

    inline bool intersectTriangle(
        const Vec3f &orig,
        const Vec3f &dir,
        size_t f,
        float maxDist,
        float &outT,
        float &outU,
        float &outV) const
    {
        const Vec3f &v0 = worldVerts[faces[f].x];
        const Vec3f &v1 = worldVerts[faces[f].y];
        const Vec3f &v2 = worldVerts[faces[f].z];

        const Vec3f e1 = v1 - v0;
        const Vec3f e2 = v2 - v0;
        const Vec3f pvec = cross(dir, e2);
        const float det = e1 * pvec;

        if (std::fabs(det) < 1e-7f) return false;

        const float invDet = 1.0f / det;
        const Vec3f tvec = orig - v0;
        const float u = (tvec * pvec) * invDet;
        if (u < 0.0f || u > 1.0f) return false;

        const Vec3f qvec = cross(tvec, e1);
        const float v = (dir * qvec) * invDet;
        if (v < 0.0f || u + v > 1.0f) return false;

        const float t = (e2 * qvec) * invDet;
        if (t > 1e-4f && t < maxDist) {
            outT = t;
            outU = u;
            outV = v;
            return true;
        }
        return false;
    }

    bool intersect(
        const Vec3f &orig,
        const Vec3f &dir,
        float maxDist,
        float &outT,
        Vec3f &outNormal,
        RenderMetrics &metrics) const
    {
        if (faces.empty()) return false;

        const Vec3f invDir = computeInvDir(dir);
        float rootNear = 0.f;

        metrics.intersectionTests += 1.0;
        metrics.aabbTests += 1.0;
        if (!intersectBox(orig, invDir, bboxMin, bboxMax, maxDist, rootNear)) {
            return false;
        }

        float bestT = maxDist;
        int bestFace = -1;
        float bestU = 0.f;
        float bestV = 0.f;

        if (!useBVH || bvhNodes.empty()) {
            for (size_t f = 0; f < faces.size(); f++) {
                metrics.intersectionTests += 1.0;
                metrics.triangleTests += 1.0;

                float t = 0.f, u = 0.f, v = 0.f;
                if (intersectTriangle(orig, dir, f, bestT, t, u, v)) {
                    bestT = t;
                    bestFace = static_cast<int>(f);
                    bestU = u;
                    bestV = v;
                }
            }
        } else {
            uint32_t stack[64];
            int stackPtr = 0;
            stack[stackPtr++] = 0;

            while (stackPtr > 0) {
                const BVHNode &node = bvhNodes[stack[--stackPtr]];

                if (node.triCount > 0) {
                    for (uint32_t i = 0; i < node.triCount; i++) {
                        const uint32_t f = bvhTriIndices[node.leftFirst + i];
                        metrics.intersectionTests += 1.0;
                        metrics.triangleTests += 1.0;

                        float t = 0.f, u = 0.f, v = 0.f;
                        if (intersectTriangle(orig, dir, f, bestT, t, u, v)) {
                            bestT = t;
                            bestFace = static_cast<int>(f);
                            bestU = u;
                            bestV = v;
                        }
                    }
                } else {
                    const uint32_t leftIdx = node.leftFirst;
                    const uint32_t rightIdx = leftIdx + 1;

                    metrics.intersectionTests += 2.0;
                    metrics.aabbTests += 2.0;

                    float tNearL = 0.f, tNearR = 0.f;
                    const bool hitL = intersectBox(orig, invDir, bvhNodes[leftIdx].bboxMin, bvhNodes[leftIdx].bboxMax, bestT, tNearL);
                    const bool hitR = intersectBox(orig, invDir, bvhNodes[rightIdx].bboxMin, bvhNodes[rightIdx].bboxMax, bestT, tNearR);

                    if (hitL && hitR) {
                        if (tNearL < tNearR) {
                            stack[stackPtr++] = rightIdx;
                            stack[stackPtr++] = leftIdx;
                        } else {
                            stack[stackPtr++] = leftIdx;
                            stack[stackPtr++] = rightIdx;
                        }
                    } else if (hitL) {
                        stack[stackPtr++] = leftIdx;
                    } else if (hitR) {
                        stack[stackPtr++] = rightIdx;
                    }
                }
            }
        }

        if (bestFace < 0) return false;

        outT = bestT;
        if (smoothShading) {
            const float w = 1.0f - bestU - bestV;
            Vec3f interpN = worldVertNormals[faces[bestFace].x] * w
                          + worldVertNormals[faces[bestFace].y] * bestU
                          + worldVertNormals[faces[bestFace].z] * bestV;
            outNormal = norm2(interpN) > 1e-10f ? interpN.normalize() : faceNormals[bestFace];
        } else {
            outNormal = faceNormals[bestFace];
        }

        return true;
    }

    bool occluded(const Vec3f &orig, const Vec3f &dir, float maxDist, RenderMetrics &metrics) const
    {
        if (faces.empty()) return false;

        const Vec3f invDir = computeInvDir(dir);
        float rootNear = 0.f;

        metrics.intersectionTests += 1.0;
        metrics.aabbTests += 1.0;
        if (!intersectBox(orig, invDir, bboxMin, bboxMax, maxDist, rootNear)) {
            return false;
        }

        if (!useBVH || bvhNodes.empty()) {
            for (size_t f = 0; f < faces.size(); f++) {
                metrics.intersectionTests += 1.0;
                metrics.triangleTests += 1.0;

                float t = 0.f, u = 0.f, v = 0.f;
                if (intersectTriangle(orig, dir, f, maxDist, t, u, v)) {
                    return true;
                }
            }
            return false;
        }

        uint32_t stack[64];
        int stackPtr = 0;
        stack[stackPtr++] = 0;

        while (stackPtr > 0) {
            const BVHNode &node = bvhNodes[stack[--stackPtr]];

            if (node.triCount > 0) {
                for (uint32_t i = 0; i < node.triCount; i++) {
                    const uint32_t f = bvhTriIndices[node.leftFirst + i];
                    metrics.intersectionTests += 1.0;
                    metrics.triangleTests += 1.0;

                    float t = 0.f, u = 0.f, v = 0.f;
                    if (intersectTriangle(orig, dir, f, maxDist, t, u, v)) {
                        return true;
                    }
                }
            } else {
                const uint32_t leftIdx = node.leftFirst;
                const uint32_t rightIdx = leftIdx + 1;

                metrics.intersectionTests += 2.0;
                metrics.aabbTests += 2.0;

                float tNearL = 0.f, tNearR = 0.f;
                if (intersectBox(orig, invDir, bvhNodes[leftIdx].bboxMin, bvhNodes[leftIdx].bboxMax, maxDist, tNearL)) {
                    stack[stackPtr++] = leftIdx;
                }
                if (intersectBox(orig, invDir, bvhNodes[rightIdx].bboxMin, bvhNodes[rightIdx].bboxMax, maxDist, tNearR)) {
                    stack[stackPtr++] = rightIdx;
                }
            }
        }

        return false;
    }

private:
    struct TriBuildInfo {
        Vec3f bmin;
        Vec3f bmax;
        Vec3f centroid;
    };

    static inline float surfaceArea(const Vec3f &bmin, const Vec3f &bmax)
    {
        const float dx = std::max(0.f, bmax.x - bmin.x);
        const float dy = std::max(0.f, bmax.y - bmin.y);
        const float dz = std::max(0.f, bmax.z - bmin.z);
        return 2.0f * (dx * dy + dy * dz + dz * dx);
    }

    void buildBVH()
    {
        const uint32_t fCount = static_cast<uint32_t>(faces.size());
        if (fCount == 0) return;

        bvhTriIndices.resize(fCount);
        std::vector<TriBuildInfo> triInfo(fCount);

        for (uint32_t f = 0; f < fCount; f++) {
            bvhTriIndices[f] = f;
            const Vec3f &v0 = worldVerts[faces[f].x];
            const Vec3f &v1 = worldVerts[faces[f].y];
            const Vec3f &v2 = worldVerts[faces[f].z];

            triInfo[f].bmin = Vec3f(
                std::min({v0.x, v1.x, v2.x}),
                std::min({v0.y, v1.y, v2.y}),
                std::min({v0.z, v1.z, v2.z})
            );
            triInfo[f].bmax = Vec3f(
                std::max({v0.x, v1.x, v2.x}),
                std::max({v0.y, v1.y, v2.y}),
                std::max({v0.z, v1.z, v2.z})
            );
            triInfo[f].centroid = (v0 + v1 + v2) * (1.0f / 3.0f);
        }

        bvhNodes.reserve(fCount * 2);
        bvhNodes.emplace_back();
        subdivideBVH(0, 0, fCount, triInfo);
    }

    void subdivideBVH(uint32_t nodeIdx, uint32_t start, uint32_t count, const std::vector<TriBuildInfo> &triInfo)
    {
        Vec3f bmin(std::numeric_limits<float>::max(), std::numeric_limits<float>::max(), std::numeric_limits<float>::max());
        Vec3f bmax(std::numeric_limits<float>::lowest(), std::numeric_limits<float>::lowest(), std::numeric_limits<float>::lowest());
        Vec3f cmin = bmin;
        Vec3f cmax = bmax;

        for (uint32_t i = start; i < start + count; i++) {
            const TriBuildInfo &ti = triInfo[bvhTriIndices[i]];
            for (int a = 0; a < 3; a++) {
                bmin[a] = std::min(bmin[a], ti.bmin[a]);
                bmax[a] = std::max(bmax[a], ti.bmax[a]);
                cmin[a] = std::min(cmin[a], ti.centroid[a]);
                cmax[a] = std::max(cmax[a], ti.centroid[a]);
            }
        }

        bvhNodes[nodeIdx].bboxMin = bmin - Vec3f(1e-4f, 1e-4f, 1e-4f);
        bvhNodes[nodeIdx].bboxMax = bmax + Vec3f(1e-4f, 1e-4f, 1e-4f);

        constexpr uint32_t MAX_LEAF_TRIS = 4;
        constexpr int NUM_BINS = 8;

        if (count <= MAX_LEAF_TRIS) {
            bvhNodes[nodeIdx].leftFirst = start;
            bvhNodes[nodeIdx].triCount = count;
            return;
        }

        int bestAxis = -1;
        float bestPos = 0.f;
        float bestCost = std::numeric_limits<float>::max();

        for (int axis = 0; axis < 3; axis++) {
            const float boundsMin = cmin[axis];
            const float boundsMax = cmax[axis];
            if (boundsMax - boundsMin < 1e-6f) continue;

            struct Bin {
                Vec3f bmin{std::numeric_limits<float>::max(), std::numeric_limits<float>::max(), std::numeric_limits<float>::max()};
                Vec3f bmax{std::numeric_limits<float>::lowest(), std::numeric_limits<float>::lowest(), std::numeric_limits<float>::lowest()};
                uint32_t count = 0;
            };
            Bin bins[NUM_BINS];
            const float scaleToBin = NUM_BINS / (boundsMax - boundsMin);

            for (uint32_t i = start; i < start + count; i++) {
                const TriBuildInfo &ti = triInfo[bvhTriIndices[i]];
                int binIdx = static_cast<int>((ti.centroid[axis] - boundsMin) * scaleToBin);
                binIdx = std::min(NUM_BINS - 1, std::max(0, binIdx));
                bins[binIdx].count++;
                for (int a = 0; a < 3; a++) {
                    bins[binIdx].bmin[a] = std::min(bins[binIdx].bmin[a], ti.bmin[a]);
                    bins[binIdx].bmax[a] = std::max(bins[binIdx].bmax[a], ti.bmax[a]);
                }
            }

            float leftArea[NUM_BINS - 1], rightArea[NUM_BINS - 1];
            uint32_t leftCount[NUM_BINS - 1], rightCount[NUM_BINS - 1];

            Vec3f curMin(std::numeric_limits<float>::max(), std::numeric_limits<float>::max(), std::numeric_limits<float>::max());
            Vec3f curMax(std::numeric_limits<float>::lowest(), std::numeric_limits<float>::lowest(), std::numeric_limits<float>::lowest());
            uint32_t curSum = 0;

            for (int b = 0; b < NUM_BINS - 1; b++) {
                curSum += bins[b].count;
                leftCount[b] = curSum;
                if (bins[b].count > 0) {
                    for (int a = 0; a < 3; a++) {
                        curMin[a] = std::min(curMin[a], bins[b].bmin[a]);
                        curMax[a] = std::max(curMax[a], bins[b].bmax[a]);
                    }
                }
                leftArea[b] = surfaceArea(curMin, curMax);
            }

            curMin = Vec3f(std::numeric_limits<float>::max(), std::numeric_limits<float>::max(), std::numeric_limits<float>::max());
            curMax = Vec3f(std::numeric_limits<float>::lowest(), std::numeric_limits<float>::lowest(), std::numeric_limits<float>::lowest());
            curSum = 0;

            for (int b = NUM_BINS - 1; b > 0; b--) {
                curSum += bins[b].count;
                rightCount[b - 1] = curSum;
                if (bins[b].count > 0) {
                    for (int a = 0; a < 3; a++) {
                        curMin[a] = std::min(curMin[a], bins[b].bmin[a]);
                        curMax[a] = std::max(curMax[a], bins[b].bmax[a]);
                    }
                }
                rightArea[b - 1] = surfaceArea(curMin, curMax);
            }

            const float step = (boundsMax - boundsMin) / NUM_BINS;
            for (int b = 0; b < NUM_BINS - 1; b++) {
                if (leftCount[b] == 0 || rightCount[b] == 0) continue;
                const float cost = leftCount[b] * leftArea[b] + rightCount[b] * rightArea[b];
                if (cost < bestCost) {
                    bestCost = cost;
                    bestAxis = axis;
                    bestPos = boundsMin + step * (b + 1);
                }
            }
        }

        const float parentCost = count * surfaceArea(bmin, bmax);
        if (bestAxis == -1 || bestCost >= parentCost) {
            bvhNodes[nodeIdx].leftFirst = start;
            bvhNodes[nodeIdx].triCount = count;
            return;
        }

        auto midIt = std::partition(
            bvhTriIndices.begin() + start,
            bvhTriIndices.begin() + start + count,
            [&](uint32_t idx) { return triInfo[idx].centroid[bestAxis] < bestPos; }
        );

        const uint32_t leftLen = static_cast<uint32_t>(midIt - (bvhTriIndices.begin() + start));
        if (leftLen == 0 || leftLen == count) {
            bvhNodes[nodeIdx].leftFirst = start;
            bvhNodes[nodeIdx].triCount = count;
            return;
        }

        const uint32_t leftChildIdx = static_cast<uint32_t>(bvhNodes.size());
        bvhNodes.emplace_back();
        bvhNodes.emplace_back();

        bvhNodes[nodeIdx].leftFirst = leftChildIdx;
        bvhNodes[nodeIdx].triCount = 0;

        subdivideBVH(leftChildIdx, start, leftLen, triInfo);
        subdivideBVH(leftChildIdx + 1, start + leftLen, count - leftLen, triInfo);
    }
};

#endif // MESH_H