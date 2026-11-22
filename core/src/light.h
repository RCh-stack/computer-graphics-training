#ifndef LIGHT
#define LIGHT

#include "geometry.h"

struct Light
{
    Vec3f stand;
    float depth;
    float radius;
    Vec3f color;

    Light() : stand(), depth(1.f), radius(0.6f), color(1.f, 1.f, 1.f) {}
    Light(const Vec3f &s, const float &d)
        : stand(s), depth(d), radius(0.6f), color(1.f, 1.f, 1.f) {}
    Light(const Vec3f &s, const float &d, float r)
        : stand(s), depth(d), radius(r), color(1.f, 1.f, 1.f) {}
    Light(const Vec3f &s, const float &d, float r, const Vec3f &c)
        : stand(s), depth(d), radius(r), color(c) {}
};

#endif // LIGHT