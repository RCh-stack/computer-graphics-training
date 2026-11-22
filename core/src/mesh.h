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
    std::vector<Vec3f> localFaceNormals;
    std::vector<Vec3f> localVertNormals;

    std::vector<BVHNode> bvhNodes;
    std::vector<uint32_t> bvhTriIndices;

    Vec3f localBboxMin;
    Vec3f localBboxMax;
    Vec3f worldBboxMin;
    Vec3f worldBboxMax;

    Vec3f rotRow0;
    Vec3f rotRow1;
    Vec3f rotRow2;
    float safeScale;
    float invScale;

    Vec3f position;
    Vec3f rotation;
    float scale;
    bool smoothShading;
    bool useBVH;
    Material material;

    Mesh()
        : localBboxMin(), localBboxMax(), worldBboxMin(), worldBboxMax(),
          rotRow0(1.f, 0.f, 0.f), rotRow1(0.f, 1.f, 0.f), rotRow2(0.f, 0.f, 1.f),
          safeScale(1.0f), invScale(1.0f),
          position(0.f, 0.f, 0.f), rotation(0.f, 0.f, 0.f), scale(1.0f),
          smoothShading(false), useBVH(true), material() {}

    explicit Mesh(const Material &m)
        : localBboxMin(), localBboxMax(), worldBboxMin(), worldBboxMax(),
          rotRow0(1.f, 0.f, 0.f), rotRow1(0.f, 1.f, 0.f), rotRow2(0.f, 0.f, 1.f),
          safeScale(1.0f), invScale(1.0f),
          position(0.f, 0.f, 0.f), rotation(0.f, 0.f, 0.f), scale(1.0f),
          smoothShading(false), useBVH(true), material(m) {}

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

        rebuildLocalData();
        updateTransformCache();
    }

    void setTransform(const Vec3f &pos, const Vec3f &rotEuler, float sc)
    {
        position = pos;
        rotation = rotEuler;
        scale = sc;
        updateTransformCache();
    }

    inline Vec3f rotateLocalToWorld(const Vec3f &v) const
    {
        return Vec3f(
            rotRow0 * v,
            rotRow1 * v,
            rotRow2 * v
        );
    }

    inline Vec3f rotateWorldToLocal(const Vec3f &w) const
    {
        return Vec3f(
            rotRow0.x * w.x + rotRow1.x * w.y + rotRow2.x * w.z,
            rotRow0.y * w.x + rotRow1.y * w.y + rotRow2.y * w.z,
            rotRow0.z * w.x + rotRow1.z * w.y + rotRow2.z * w.z
        );
    }

    void updateTransformCache()
    {
        safeScale = std::max(1e-4f, std::fabs(scale));
        invScale = 1.0f / safeScale;

        const float cx = std::cos(rotation.x), sx = std::sin(rotation.x);
        const float cy = std::cos(rotation.y), sy = std::sin(rotation.y);
        const float cz = std::cos(rotation.z), sz = std::sin(rotation.z);

        rotRow0 = Vec3f(
            cy * cz,
            sx * sy * cz - cx * sz,
            cx * sy * cz + sx * sz
        );
        rotRow1 = Vec3f(
            cy * sz,
            sx * sy * sz + cx * cz,
            cx * sy * sz - sx * cz
        );
        rotRow2 = Vec3f(
            -sy,
            sx * cy,
            cx * cy
        );

        if (faces.empty()) {
            worldBboxMin = position;
            worldBboxMax = position;
            return;
        }

        const Vec3f rows[3] = { rotRow0, rotRow1, rotRow2 };
        for (int axis = 0; axis < 3; axis++) {
            float minAcc = position[axis];
            float maxAcc = position[axis];
            for (int j = 0; j < 3; j++) {
                const float a = rows[axis][j] * localBboxMin[j] * safeScale;
                const float b = rows[axis][j] * localBboxMax[j] * safeScale;
                minAcc += std::min(a, b);
                maxAcc += std::max(a, b);
            }
            worldBboxMin[axis] = minAcc - 1e-3f;
            worldBboxMax[axis] = maxAcc + 1e-3f;
        }
    }

    void rebuildLocalData()
    {
        const size_t vCount = localVerts.size();
        const size_t fCount = faces.size();

        localVertNormals.assign(vCount, Vec3f(0.f, 0.f, 0.f));
        localFaceNormals.resize(fCount);
        bvhNodes.clear();
        bvhTriIndices.clear();

        if (vCount == 0 || fCount == 0) {
            localBboxMin = Vec3f(0.f, 0.f, 0.f);
            localBboxMax = Vec3f(0.f, 0.f, 0.f);
            return;
        }

        localBboxMin = Vec3f(
            std::numeric_limits<float>::max(),
            std::numeric_limits<float>::max(),
            std::numeric_limits<float>::max()
        );
        localBboxMax = Vec3f(
            std::numeric_limits<float>::lowest(),
            std::numeric_limits<float>::lowest(),
            std::numeric_limits<float>::lowest()
        );

        for (size_t i = 0; i < vCount; i++) {
            const Vec3f &lv = localVerts[i];
            localBboxMin.x = std::min(localBboxMin.x, lv.x);
            localBboxMin.y = std::min(localBboxMin.y, lv.y);
            localBboxMin.z = std::min(localBboxMin.z, lv.z);

            localBboxMax.x = std::max(localBboxMax.x, lv.x);
            localBboxMax.y = std::max(localBboxMax.y, lv.y);
            localBboxMax.z = std::max(localBboxMax.z, lv.z);
        }

        localBboxMin = localBboxMin - Vec3f(1e-4f, 1e-4f, 1e-4f);
        localBboxMax = localBboxMax + Vec3f(1e-4f, 1e-4f, 1e-4f);

        for (size_t f = 0; f < fCount; f++) {
            const int i0 = faces[f].x;
            const int i1 = faces[f].y;
            const int i2 = faces[f].z;

            const Vec3f e1 = localVerts[i1] - localVerts[i0];
            const Vec3f e2 = localVerts[i2] - localVerts[i0];
            Vec3f rawN = cross(e1, e2);

            localVertNormals[i0] = localVertNormals[i0] + rawN;
            localVertNormals[i1] = localVertNormals[i1] + rawN;
            localVertNormals[i2] = localVertNormals[i2] + rawN;

            if (norm2(rawN) > 1e-12f) {
                localFaceNormals[f] = rawN.normalize();
            } else {
                localFaceNormals[f] = Vec3f(0.f, 1.f, 0.f);
            }
        }

        for (size_t i = 0; i < vCount; i++) {
            if (norm2(localVertNormals[i]) > 1e-12f) {
                localVertNormals[i].normalize();
            } else {
                localVertNormals[i] = Vec3f(0.f, 1.f, 0.f);
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
        float minDist,
        float maxDist,
        float &outTNear)
    {
        float tmin = minDist;
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

    inline bool intersectLocalTriangle(
        const Vec3f &localOrig,
        const Vec3f &localDir,
        size_t f,
        float minDist,
        float maxDist,
        float &outT,
        float &outU,
        float &outV) const
    {
        const Vec3f &v0 = localVerts[faces[f].x];
        const Vec3f &v1 = localVerts[faces[f].y];
        const Vec3f &v2 = localVerts[faces[f].z];

        const Vec3f e1 = v1 - v0;
        const Vec3f e2 = v2 - v0;
        const Vec3f pvec = cross(localDir, e2);
        const float det = e1 * pvec;

        if (std::fabs(det) < 1e-7f) return false;

        const float invDet = 1.0f / det;
        const Vec3f tvec = localOrig - v0;
        const float u = (tvec * pvec) * invDet;
        if (u < 0.0f || u > 1.0f) return false;

        const Vec3f qvec = cross(tvec, e1);
        const float v = (localDir * qvec) * invDet;
        if (v < 0.0f || u + v > 1.0f) return false;

        const float t = (e2 * qvec) * invDet;
        if (t > minDist && t < maxDist) {
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

        const Vec3f worldInvDir = computeInvDir(dir);
        float rootNear = 0.f;

        metrics.intersectionTests += 1.0;
        metrics.aabbTests += 1.0;
        if (!intersectBox(orig, worldInvDir, worldBboxMin, worldBboxMax, 1e-4f, maxDist, rootNear)) {
            return false;
        }

        const Vec3f localOrig = rotateWorldToLocal(orig - position) * invScale;
        const Vec3f localDir = rotateWorldToLocal(dir);
        const Vec3f localInvDir = computeInvDir(localDir);
        const float localMinDist = 1e-4f * invScale;
        float bestLocalT = maxDist * invScale;

        int bestFace = -1;
        float bestU = 0.f;
        float bestV = 0.f;

        if (!useBVH || bvhNodes.empty()) {
            for (size_t f = 0; f < faces.size(); f++) {
                metrics.intersectionTests += 1.0;
                metrics.triangleTests += 1.0;

                float t = 0.f, u = 0.f, v = 0.f;
                if (intersectLocalTriangle(localOrig, localDir, f, localMinDist, bestLocalT, t, u, v)) {
                    bestLocalT = t;
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
                        if (intersectLocalTriangle(localOrig, localDir, f, localMinDist, bestLocalT, t, u, v)) {
                            bestLocalT = t;
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
                    const bool hitL = intersectBox(localOrig, localInvDir, bvhNodes[leftIdx].bboxMin, bvhNodes[leftIdx].bboxMax, localMinDist, bestLocalT, tNearL);
                    const bool hitR = intersectBox(localOrig, localInvDir, bvhNodes[rightIdx].bboxMin, bvhNodes[rightIdx].bboxMax, localMinDist, bestLocalT, tNearR);

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

        outT = bestLocalT * safeScale;

        Vec3f localNormal;
        if (smoothShading) {
            const float w = 1.0f - bestU - bestV;
            Vec3f interpN = localVertNormals[faces[bestFace].x] * w
                          + localVertNormals[faces[bestFace].y] * bestU
                          + localVertNormals[faces[bestFace].z] * bestV;
            localNormal = norm2(interpN) > 1e-10f ? interpN.normalize() : localFaceNormals[bestFace];
        } else {
            localNormal = localFaceNormals[bestFace];
        }

        Vec3f worldN = rotateLocalToWorld(localNormal);
        outNormal = norm2(worldN) > 1e-10f ? worldN.normalize() : Vec3f(0.f, 1.f, 0.f);
        return true;
    }

    bool occluded(const Vec3f &orig, const Vec3f &dir, float maxDist, RenderMetrics &metrics) const
    {
        if (faces.empty()) return false;

        const Vec3f worldInvDir = computeInvDir(dir);
        float rootNear = 0.f;

        metrics.intersectionTests += 1.0;
        metrics.aabbTests += 1.0;
        if (!intersectBox(orig, worldInvDir, worldBboxMin, worldBboxMax, 1e-4f, maxDist, rootNear)) {
            return false;
        }

        const Vec3f localOrig = rotateWorldToLocal(orig - position) * invScale;
        const Vec3f localDir = rotateWorldToLocal(dir);
        const Vec3f localInvDir = computeInvDir(localDir);
        const float localMinDist = 1e-4f * invScale;
        const float localMaxDist = maxDist * invScale;

        if (!useBVH || bvhNodes.empty()) {
            for (size_t f = 0; f < faces.size(); f++) {
                metrics.intersectionTests += 1.0;
                metrics.triangleTests += 1.0;

                float t = 0.f, u = 0.f, v = 0.f;
                if (intersectLocalTriangle(localOrig, localDir, f, localMinDist, localMaxDist, t, u, v)) {
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
                    if (intersectLocalTriangle(localOrig, localDir, f, localMinDist, localMaxDist, t, u, v)) {
                        return true;
                    }
                }
            } else {
                const uint32_t leftIdx = node.leftFirst;
                const uint32_t rightIdx = leftIdx + 1;

                metrics.intersectionTests += 2.0;
                metrics.aabbTests += 2.0;

                float tNearL = 0.f, tNearR = 0.f;
                if (intersectBox(localOrig, localInvDir, bvhNodes[leftIdx].bboxMin, bvhNodes[leftIdx].bboxMax, localMinDist, localMaxDist, tNearL)) {
                    stack[stackPtr++] = leftIdx;
                }
                if (intersectBox(localOrig, localInvDir, bvhNodes[rightIdx].bboxMin, bvhNodes[rightIdx].bboxMax, localMinDist, localMaxDist, tNearR)) {
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
            const Vec3f &v0 = localVerts[faces[f].x];
            const Vec3f &v1 = localVerts[faces[f].y];
            const Vec3f &v2 = localVerts[faces[f].z];

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