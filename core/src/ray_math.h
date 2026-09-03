#include "geometry.h"
#include "material.h"
#include "sphere.h"
#include "light.h"
#include "model.h"
#include "triangle.h"

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

    Vec3f cast_ray_step_dispatcher(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, 
        const std::vector<Light> &lights, size_t depth, const int &current_step);

    Vec3f cast_ray(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres);
    Vec3f cast_ray_diffuse(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights);
    Vec3f cast_ray_specular(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights);
    Vec3f cast_ray_shadows(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights); 
    Vec3f cast_ray_reflect(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights, size_t depth);
    Vec3f cast_ray_refract(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights, size_t depth);

    bool scene_intersect(const Vec3f &orig, const Vec3f &dir, const std::vector<Sphere> &spheres, Vec3f &hit, Vec3f &N, Material &material, bool out_scene);
    bool scene_intersect(const Vec3f &orig, const Vec3f &dir, const std::vector<Triangle> &triangles, Vec3f &hit, Vec3f &N, Material &material, bool out_scene);

    bool generate_scene(const Vec3f &orig, const Vec3f &dir, Vec3f &hit, float spheres_dist, Vec3f &N, Material &material);
}