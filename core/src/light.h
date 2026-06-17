#ifndef LIGHT
#define LIGHT

#include "geometry.h"

struct Light
{

    Light(const Vec3f &s, const float &d) : stand(s), depth(d) {}

    Vec3f stand;
    float depth;
};

#endif // LIGHT
