#ifndef RAY_MATH_H
#define RAY_MATH_H

#include <vector>
#include "geometry.h"
#include "material.h"
#include "sphere.h"
#include "light.h"
#include "render_metrics.h"

namespace RayTracing
{
    enum class RayTraceStep : int {
        BACKGROUND = 0,
        DIFFUSE = 1,
        SPECULAR = 2,
        SHADOWS = 3,
        REFLECTION = 4,
        REFRACTION = 5
    };

    Vec3f reflect(const Vec3f &I, const Vec3f &N);
    Vec3f refract(const Vec3f &I, const Vec3f &N, const float &refractive_index);

    Vec3f cast_ray_step_dispatcher(
        const Vec3f &orig,
        const Vec3f &dir,
        const Vec3f &backg,
        const std::vector<Sphere> &spheres,
        const std::vector<Light> &lights,
        size_t depth,
        const int current_step,
        RenderMetrics &metrics
    );

    Vec3f cast_ray(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, RenderMetrics &metrics);
    Vec3f cast_ray_diffuse(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights, RenderMetrics &metrics);
    Vec3f cast_ray_specular(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights, RenderMetrics &metrics);
    Vec3f cast_ray_shadows(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights, RenderMetrics &metrics);
    Vec3f cast_ray_reflect(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights, size_t depth, RenderMetrics &metrics);
    Vec3f cast_ray_refract(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights, size_t depth, RenderMetrics &metrics);

    bool scene_intersect(const Vec3f &orig, const Vec3f &dir, const std::vector<Sphere> &spheres, Vec3f &hit, Vec3f &N, Material &material, bool out_scene, RenderMetrics &metrics);
    bool scene_occluded(const Vec3f &orig, const Vec3f &dir, float max_dist, const std::vector<Sphere> &spheres, RenderMetrics &metrics);
    bool generate_scene(const Vec3f &orig, const Vec3f &dir, Vec3f &hit, float spheres_dist, Vec3f &N, Material &material);
}

#endif // RAY_MATH_H