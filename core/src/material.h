#ifndef MATERIAL
#define MATERIAL

#include "geometry.h"

struct Material
{
    Vec4f albedo;
    Vec3f diffuse_color;
    float specular_exponent;
    float refractive_index;

    Material() : albedo(1, 0, 0, 0), diffuse_color(), specular_exponent(), refractive_index(1) {}

    Material(const Vec3f &color) : diffuse_color(color) {}
    Material(const Vec4f &a, const Vec3f &color, const float &spec) : albedo(a), diffuse_color(color), specular_exponent(spec) {}
    Material(const Vec4f &a, const Vec3f &color, const float &spec, const float &r) : albedo(a), diffuse_color(color), specular_exponent(spec), refractive_index(r) {}
};

#endif // MATERIAL
