#ifndef SPHERE
#define SPHERE

#include <cmath>
#include "geometry.h"
#include "material.h"

struct Sphere
{
    Vec3f center;
    float radius;
    Material material;

    Sphere() : center(), radius(0.0f), material() {}
    Sphere(const Vec3f &c, const float &r) : center(c), radius(r), material() {}
    Sphere(const Vec3f &c, const float &r, const Material &m) : center(c), radius(r), material(m) {}

    inline bool rayCrossingTest(const Vec3f &orig, const Vec3f &dir, float &t0) const
    {
        const Vec3f L = center - orig;
        const float tca = L * dir;
        const float r2 = radius * radius;
        const float L2 = L * L;

        if (tca < 0.0f && L2 > r2)
            return false;

        const float d2 = L2 - tca * tca;
        if (d2 > r2)
            return false;

        const float thc = std::sqrt(r2 - d2);
        t0 = tca - thc;
        if (t0 < 0.0f) {
            t0 = tca + thc;
            if (t0 < 0.0f)
                return false;
        }

        return true;
    }
};

#endif // SPHERE