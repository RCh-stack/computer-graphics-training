#ifndef MATERIAL
#define MATERIAL

#include "geometry.h"

struct Material
{
    Vec4f albedo;
    Vec3f diffuse_color;
    float specular_exponent;
    float refractive_index;
    Vec3f emission;
    float roughness;
    
    int texture_type = 0;
    Vec3f secondary_color{0.12f, 0.14f, 0.18f};
    float tex_scale = 2.0f;
    int texture_id = -1;

    Material()
        : albedo(1, 0, 0, 0), diffuse_color(), specular_exponent(0.f),
          refractive_index(1.f), emission(0.f, 0.f, 0.f), roughness(1.0f) {}

    Material(const Vec3f &color)
        : albedo(1, 0, 0, 0), diffuse_color(color), specular_exponent(0.f),
          refractive_index(1.f), emission(0.f, 0.f, 0.f), roughness(1.0f) {}

    Material(const Vec4f &a, const Vec3f &color, const float &spec)
        : albedo(a), diffuse_color(color), specular_exponent(spec),
          refractive_index(1.f), emission(0.f, 0.f, 0.f), roughness(1.0f) {}

    Material(const Vec4f &a, const Vec3f &color, const float &spec, const float &r)
        : albedo(a), diffuse_color(color), specular_exponent(spec),
          refractive_index(r), emission(0.f, 0.f, 0.f), roughness(1.0f) {}

    Material(const Vec4f &a, const Vec3f &color, const float &spec, const float &r, const Vec3f &em, float rough)
        : albedo(a), diffuse_color(color), specular_exponent(spec),
          refractive_index(r), emission(em), roughness(rough) {}
};

#endif // MATERIAL