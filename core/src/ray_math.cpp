#include <cmath>
#include <vector>
#include <limits>
#include <locale>

#include "ray_math.h"

namespace RayTracing 
{   

    Vec3f reflect(const Vec3f &I, const Vec3f &N)
    {
        return I - N * 2.f * (I * N);
    }

    Vec3f refract(const Vec3f &I, const Vec3f &N, const float &refractive_index)
    {
        float cosi = - std::max(-1.f, std::min(1.f, I*N));
        float etai = 1, etat = refractive_index;
        Vec3f n = N;
        if (cosi < 0)
        {
            cosi = -cosi;
            std::swap(etai, etat); n = -N;
        }

        float eta = etai / etat;
        float k = 1 - eta * eta * (1 - cosi * cosi);
        return k < 0 ? Vec3f(0, 0, 0) : I * eta + n * (eta * cosi - sqrtf(k));
    }
    
    Vec3f cast_ray_step_dispatcher(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, 
        const std::vector<Light> &lights, size_t depth, const int &current_step) 
    {
        switch (static_cast<RayTraceStep>(current_step)) {
            case RayTraceStep::BACKGROUND:
                return cast_ray(orig, dir, backg, spheres);

            case RayTraceStep::DIFFUSE:
                return cast_ray_diffuse(orig, dir, backg, spheres, lights);
            
            case RayTraceStep::SPECULAR:
                return cast_ray_specular(orig, dir, backg, spheres, lights);

            case RayTraceStep::SHADOWS:
                return cast_ray_shadows(orig, dir, backg, spheres, lights);

            case RayTraceStep::REFLECTION:
                return cast_ray_reflect(orig, dir, backg, spheres, lights, depth);

            case RayTraceStep::REFRACTION:
                return cast_ray_refract(orig, dir, backg, spheres, lights, depth);
        }
    }

    Vec3f cast_ray(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres)
    {
        Vec3f point, N;
        Material material;
        if (!scene_intersect(orig, dir, spheres, point, N, material, false))
            return backg;

        return material.diffuse_color;
    }
       
    Vec3f cast_ray_diffuse(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights)
    {
        Vec3f point, N;
        Material material;
        if (!scene_intersect(orig, dir, spheres, point, N, material, false))
            return backg;

        float diffuse_light_intensity = 0;
        for (size_t i = 0; i < lights.size(); i++)
        {
            Vec3f light_dir = (lights[i].stand - point).normalize();
            diffuse_light_intensity += lights[i].depth * std::max(0.f, light_dir * N);
        }

        return material.diffuse_color * diffuse_light_intensity;
    }

    Vec3f cast_ray_specular(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights)
    {
        Vec3f point, N;
        Material material;
        if (!scene_intersect(orig, dir, spheres, point, N, material, false))
            return backg;

        float diffuse_light_intensity = 0, specular_light_intensity = 0;
        for (size_t i = 0; i < lights.size(); i++)
        {
            Vec3f light_dir = (lights[i].stand - point).normalize();
            diffuse_light_intensity += lights[i].depth * std::max(0.f, light_dir * N);
            specular_light_intensity += powf(std:: max(0.f, -reflect(-light_dir, N) * dir), material.specular_exponent) * lights[i].depth;
        }

        return material.diffuse_color * diffuse_light_intensity * material.albedo[0] + Vec3f(1., 1., 1.) * specular_light_intensity * material.albedo[1];
    }

    Vec3f cast_ray_shadows(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights)
    {
        Vec3f point, N;
        Material material;
        if (!scene_intersect(orig, dir, spheres, point, N, material, false))
            return backg;

        float diffuse_light_intensity = 0, specular_light_intensity = 0;
        for (size_t i = 0; i < lights.size(); i++)
        {
            Vec3f light_dir = (lights[i].stand - point).normalize();
            float light_distance = (lights[i].stand - point).norm();
            Vec3f shadow_orig = light_dir * N < 0 ? point - N * 1e-3 : point + N * 1e-3;

            Vec3f shadow_pt, shadow_N;
            Material tmpmaterial;
            if (scene_intersect(shadow_orig, light_dir, spheres, shadow_pt, shadow_N, tmpmaterial, false) && (shadow_pt - shadow_orig).norm() < light_distance)
                continue;
            diffuse_light_intensity += lights[i].depth * std::max(0.f, light_dir * N);
            specular_light_intensity += powf(std::max(0.f, -reflect(-light_dir, N) * dir), material.specular_exponent) * lights[i].depth;
        }

        return material.diffuse_color * diffuse_light_intensity * material.albedo[0] + Vec3f(1., 1., 1.) * specular_light_intensity * material.albedo[1];
    }

    Vec3f cast_ray_reflect(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights, size_t depth)
    {
        Vec3f point, N;
        Material material;
        if (depth > 4 || !scene_intersect(orig, dir, spheres, point, N, material, false))
            return backg;

        Vec3f reflect_dir = reflect(dir, N).normalize();
        Vec3f reflect_orig = reflect_dir * N < 0 ? point - N * 1e-3 : point + N * 1e-3;
        Vec3f reflect_color = cast_ray_reflect(reflect_orig, reflect_dir, backg, spheres, lights, depth + 1);

        float diffuse_light_intensity = 0, specular_light_intensity = 0;
        for (size_t i = 0; i < lights.size(); i++)
        {
            Vec3f light_dir = (lights[i].stand - point).normalize();
            float light_distance = (lights[i].stand - point).norm();
            Vec3f shadow_orig = light_dir * N < 0 ? point - N * 1e-3 : point + N * 1e-3;

            Vec3f shadow_pt, shadow_N;
            Material tmpmaterial;

            if (scene_intersect(shadow_orig, light_dir, spheres, shadow_pt, shadow_N, tmpmaterial, false) && (shadow_pt - shadow_orig).norm() < light_distance)
                continue;

            diffuse_light_intensity += lights[i].depth * std::max(0.f, light_dir * N);
            specular_light_intensity += powf(std::max(0.f, -reflect(-light_dir, N) * dir), material.specular_exponent) * lights[i].depth;
        }

        return material.diffuse_color * diffuse_light_intensity * material.albedo[0] + Vec3f(1., 1., 1.) * specular_light_intensity * material.albedo[1] + reflect_color * material.albedo[2];
    }

    Vec3f cast_ray_refract(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights, size_t depth)
    {
        Vec3f point, N;
        Material material;
        if (depth > 4 || !scene_intersect(orig, dir, spheres, point, N, material, false))
            return backg;

        Vec3f reflect_dir = reflect(dir, N).normalize();
        Vec3f refract_dir = refract(dir, N, material.refractive_index).normalize();

        Vec3f reflect_orig = reflect_dir * N < 0 ? point - N * 1e-3 : point + N * 1e-3;
        Vec3f refract_orig = refract_dir * N < 0 ? point - N * 1e-3 : point + N * 1e-3;

        Vec3f reflect_color = cast_ray_reflect(reflect_orig, reflect_dir, backg, spheres, lights, depth + 1);
        Vec3f refract_color = cast_ray_refract(refract_orig, refract_dir, backg, spheres, lights, depth + 1);

        float diffuse_light_intensity = 0, specular_light_intensity = 0;
        for (size_t i = 0; i < lights.size(); i++)
        {
            Vec3f light_dir = (lights[i].stand - point).normalize();
            float light_distance = (lights[i].stand - point).norm();
            Vec3f shadow_orig = light_dir * N < 0 ? point - N * 1e-3 : point + N * 1e-3;

            Vec3f shadow_pt, shadow_N;
            Material tmpmaterial;
            if (scene_intersect(shadow_orig, light_dir, spheres, shadow_pt, shadow_N, tmpmaterial, false) && (shadow_pt - shadow_orig).norm() < light_distance)
                continue;

            diffuse_light_intensity += lights[i].depth * std::max(0.f, light_dir * N);
            specular_light_intensity += powf(std::max(0.f, -reflect(-light_dir, N) * dir), material.specular_exponent) * lights[i].depth;
        }

        return material.diffuse_color * diffuse_light_intensity * material.albedo[0] + Vec3f(1., 1., 1.) * specular_light_intensity * material.albedo[1] +
               reflect_color * material.albedo[2] + refract_color * material.albedo[3];
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