#ifndef SPHERE
#define SPHERE

#include "geometry.h"
#include "material.h"

struct Sphere
{
    Vec3f center;
    float radius;
    Material material;
    Material3f material3f;
    Material4f material4f;

    Sphere() {}
    Sphere(const Vec3f &c, const float &r) : center(c), radius(r) {}
    Sphere(const Vec3f &c, const float &r, const Material &m) : center(c), radius(r), material(m) {}
    Sphere(const Vec3f &c, const float &r, const Material3f &m) : center(c), radius(r), material3f(m){}
    Sphere(const Vec3f &c, const float &r, const Material4f &m) : center(c), radius(r), material4f(m){}

    bool rayCrossingTest(const Vec3f &orig, const Vec3f &dir, float &t0) const
    {
        Vec3f L = center - orig;
        float tca = L * dir;
        float d2 = L * L - tca * tca;
        if (d2 > radius * radius)
            return false;
        float thc = sqrtf(radius * radius - d2);
        t0       = tca - thc;
        float t1 = tca + thc;

        if (t0 < 0)
            t0 = t1;

        if (t0 < 0)
            return false;

        return true;
    }
};

#endif // SPHERE
