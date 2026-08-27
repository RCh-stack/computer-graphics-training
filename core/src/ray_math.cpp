#include <cmath>
#include <vector>
#include <limits>
#include <locale>

#include "ray_math.h"

namespace RayTracing 
{   
    Vec3f cast_ray(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres)
    {
        Vec3f point, N;
        Material material;
        if (!scene_intersect(orig, dir, spheres, point, N, material, false))
            return backg;

        return material.diffuse_color;
    }
        
    bool scene_intersect(const Vec3f &orig, const Vec3f &dir, const std::vector<Sphere> &spheres, Vec3f &hit, Vec3f&N, Material &material, bool out_scene)
    {
        float spheres_dist = std::numeric_limits<float>:: max();
        for (size_t i = 0; i < spheres.size(); i++)
        {
            float dist_i;
            if (spheres[i].rayCrossingTest(orig, dir, dist_i) && dist_i < spheres_dist)
            {
                spheres_dist = dist_i;
                hit = orig + dir * dist_i;
                N = (hit - spheres[i].center).normalize();
                material = spheres[i].material;
            }
        }

        if(out_scene)
            return generate_scene(orig, dir, hit, spheres_dist, N, material);
        else
            return spheres_dist < 1000;
    }

    bool generate_scene(const Vec3f &orig, const Vec3f &dir, Vec3f &hit, float spheres_dist, Vec3f &N, Material &material)
    {
        float checkerboard_dist = std::numeric_limits<float>::max();
        if (fabs(dir.y) > 1e-3)
        {
            float d = -(orig.y + 4) / dir.y;
            Vec3f pt = orig + dir * d;

            if (d > 0 && fabs(pt.x) < 10 && pt.z < -10 && pt.z > -30 && d < spheres_dist)
            {
                checkerboard_dist = d;
                hit = pt;
                N = Vec3f(0,1,0);
                material.diffuse_color = (int(.5 * hit.x + 1000) + int(.5 * hit.z)) & 1 ? Vec3f(.3, .3, .3) : Vec3f(.1, .1, .1);
            }
        }

        return std::min(spheres_dist, checkerboard_dist) < 1000;
    }
}