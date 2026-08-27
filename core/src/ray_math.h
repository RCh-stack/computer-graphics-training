#include "geometry.h"
#include "material.h"
#include "sphere.h"
#include "light.h"
#include "model.h"
#include "triangle.h"

namespace RayTracing
{
    Vec3f reflect(const Vec3f &I, const Vec3f &N);
    Vec3f refract(const Vec3f &I, const Vec3f &N, const float &refractive_index);

    Vec3f cast_ray(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres);
    //Vec3f cast_ray(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights);
    //Vec3f cast_ray(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights); // 1
    //Vec3f cast_ray(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights); // 2
    //Vec3f cast_ray(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights, size_t depth); // 3
    //Vec3f cast_ray(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights, size_t depth); // 4

    bool scene_intersect(const Vec3f &orig, const Vec3f &dir, const std::vector<Sphere> &spheres, Vec3f &hit, Vec3f &N, Material &material, bool out_scene);
    //bool scene_intersect(const Vec3f &orig, const Vec3f &dir, const std::vector<Sphere> &spheres, Vec3f &hit, Vec3f &N, Material3f &material, bool out_scene);
    //bool scene_intersect(const Vec3f &orig, const Vec3f &dir, const std::vector<Sphere> &spheres, Vec3f &hit, Vec3f &N, Material4f &material, bool out_scene);

    bool generate_scene(const Vec3f &orig, const Vec3f &dir, Vec3f &hit, float spheres_dist, Vec3f &N, Material &material);
    //bool generate_scene(const Vec3f &orig, const Vec3f &dir, Vec3f &hit, float spheres_dist, Vec3f &N, Material3f &material);
    //bool generate_scene(const Vec3f &orig, const Vec3f &dir, Vec3f &hit, float spheres_dist, Vec3f &N, Material4f &material);
}