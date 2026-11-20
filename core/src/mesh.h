#ifndef MESH_H
#define MESH_H

#include <vector>
#include <cmath>
#include <algorithm>
#include <limits>
#include "geometry.h"
#include "material.h"
#include "render_metrics.h"

struct Mesh
{
    std::vector<Vec3f> localVerts;
    std::vector<Vec3i> faces;
    std::vector<Vec3f> worldVerts;
    std::vector<Vec3f> faceNormals;
    std::vector<Vec3f> worldVertNormals;

    Vec3f bboxMin;
    Vec3f bboxMax;

    Vec3f position;
    Vec3f rotation;
    float scale;
    bool smoothShading;
    Material material;

    Mesh()
        : bboxMin(), bboxMax(), position(0.f, 0.f, 0.f),
          rotation(0.f, 0.f, 0.f), scale(1.0f), smoothShading(false), material() {}

    explicit Mesh(const Material &m)
        : bboxMin(), bboxMax(), position(0.f, 0.f, 0.f),
          rotation(0.f, 0.f, 0.f), scale(1.0f), smoothShading(false), material(m) {}

    size_t triangleCount() const {
        return faces.size();
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
    }

    inline bool intersectAABB(const Vec3f &orig, const Vec3f &dir, float maxDist) const
    {
        float tmin = 1e-4f;
        float tmax = maxDist;

        for (int axis = 0; axis < 3; axis++) {
            const float d = dir[axis];
            const float o = orig[axis];
            const float bmin = bboxMin[axis];
            const float bmax = bboxMax[axis];

            if (std::fabs(d) < 1e-8f) {
                if (o < bmin || o > bmax) return false;
            } else {
                const float invD = 1.0f / d;
                float t1 = (bmin - o) * invD;
                float t2 = (bmax - o) * invD;
                if (t1 > t2) std::swap(t1, t2);
                if (t1 > tmin) tmin = t1;
                if (t2 < tmax) tmax = t2;
                if (tmin > tmax) return false;
            }
        }
        return true;
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

        metrics.intersectionTests += 1.0;
        metrics.aabbTests += 1.0;
        if (!intersectAABB(orig, dir, maxDist)) {
            return false;
        }

        float bestT = maxDist;
        int bestFace = -1;
        float bestU = 0.f;
        float bestV = 0.f;

        for (size_t f = 0; f < faces.size(); f++) {
            metrics.intersectionTests += 1.0;
            metrics.triangleTests += 1.0;

            const Vec3f &v0 = worldVerts[faces[f].x];
            const Vec3f &v1 = worldVerts[faces[f].y];
            const Vec3f &v2 = worldVerts[faces[f].z];

            const Vec3f e1 = v1 - v0;
            const Vec3f e2 = v2 - v0;
            const Vec3f pvec = cross(dir, e2);
            const float det = e1 * pvec;

            if (std::fabs(det) < 1e-7f) continue;

            const float invDet = 1.0f / det;
            const Vec3f tvec = orig - v0;
            const float u = (tvec * pvec) * invDet;
            if (u < 0.0f || u > 1.0f) continue;

            const Vec3f qvec = cross(tvec, e1);
            const float v = (dir * qvec) * invDet;
            if (v < 0.0f || u + v > 1.0f) continue;

            const float t = (e2 * qvec) * invDet;
            if (t > 1e-4f && t < bestT) {
                bestT = t;
                bestFace = static_cast<int>(f);
                bestU = u;
                bestV = v;
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

        metrics.intersectionTests += 1.0;
        metrics.aabbTests += 1.0;
        if (!intersectAABB(orig, dir, maxDist)) {
            return false;
        }

        for (size_t f = 0; f < faces.size(); f++) {
            metrics.intersectionTests += 1.0;
            metrics.triangleTests += 1.0;

            const Vec3f &v0 = worldVerts[faces[f].x];
            const Vec3f &v1 = worldVerts[faces[f].y];
            const Vec3f &v2 = worldVerts[faces[f].z];

            const Vec3f e1 = v1 - v0;
            const Vec3f e2 = v2 - v0;
            const Vec3f pvec = cross(dir, e2);
            const float det = e1 * pvec;

            if (std::fabs(det) < 1e-7f) continue;

            const float invDet = 1.0f / det;
            const Vec3f tvec = orig - v0;
            const float u = (tvec * pvec) * invDet;
            if (u < 0.0f || u > 1.0f) continue;

            const Vec3f qvec = cross(tvec, e1);
            const float v = (dir * qvec) * invDet;
            if (v < 0.0f || u + v > 1.0f) continue;

            const float t = (e2 * qvec) * invDet;
            if (t > 1e-4f && t < maxDist) {
                return true;
            }
        }

        return false;
    }
};

#endif // MESH_H