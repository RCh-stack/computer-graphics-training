#ifndef TRIANGLE
#define TRIANGLE

#include "geometry.h"
#include "material.h"

struct Triangle
{
    Vec3f a, b, c;
    Material material;

    Triangle() {}
    Triangle(const Vec3f &A, const Vec3f &B, const Vec3f &C) : a(A), b(B), c(C) {}
    Triangle(const Vec3f &A, const Vec3f &B, const Vec3f &C, const Material &m) : a(A), b(B), c(C), material(m) {}

    bool rayCrossingTest(const Vec3f& orig, const Vec3f& dir, float& t) const
    {
        const Vec3f& v0 = a;
        const Vec3f& v1 = b;
        const Vec3f& v2 = c;

        Vec3f edge1 = v1 - v0;
        Vec3f edge2 = v2 - v0;

        Vec3f h = cross(dir, edge2);
        float A = edge1 * h;

        if (A > -1e-5 && A < 1e-5)
            return false;

        float f = 1.0f / A;
        Vec3f s = orig - v0;
        float u = f * (s * h);

        if (u < 0.0f || u > 1.0f)
            return false;

        Vec3f q = cross(s, edge1);
        float v = f * (dir * q);

        if (v < 0.0f || u + v > 1.0f)
            return false;

        t = f * (edge2 * q);
        return t > 1e-5f;
    }

    Vec3f getNormal() const
    {
        Vec3f edge1 = b - a;
        Vec3f edge2 = c - a;
        return cross(edge1, edge2).normalize();
    }
};

#endif // TRIANGLE
