#include <cmath>
#include <vector>
#include <limits>
#include <algorithm>

#include "ray_math.h"

namespace RayTracing
{
    namespace
    {
        constexpr size_t MAX_RAY_DEPTH = 4;

        Vec3f shade_direct_lighting(
            const Vec3f &point,
            const Vec3f &N,
            const Vec3f &view_dir,
            const Material &material,
            const std::vector<Sphere> &spheres,
            const std::vector<Light> &lights,
            RenderMetrics &metrics)
        {
            float diffuse_intensity = 0.f;
            float specular_intensity = 0.f;

            for (size_t i = 0; i < lights.size(); i++)
            {
                Vec3f to_light = lights[i].stand - point;
                float light_dist2 = norm2(to_light);
                if (light_dist2 <= 1e-8f)
                    continue;

                float light_distance = std::sqrt(light_dist2);
                Vec3f light_dir = to_light * (1.f / light_distance);
                float ndotl = light_dir * N;

                if (ndotl <= 0.f && material.albedo[3] <= 1e-4f)
                    continue;

                Vec3f shadow_orig = ndotl < 0.f ? point - N * 1e-3f : point + N * 1e-3f;
                metrics.shadowRays++;

                if (scene_occluded(shadow_orig, light_dir, light_distance, spheres, metrics))
                    continue;

                if (ndotl > 0.f)
                {
                    diffuse_intensity += lights[i].depth * ndotl;
                    float spec_cos = std::max(0.f, -reflect(-light_dir, N) * view_dir);
                    if (spec_cos > 0.f && material.albedo[1] > 1e-4f)
                    {
                        specular_intensity += std::pow(spec_cos, material.specular_exponent) * lights[i].depth;
                    }
                }
            }

            return material.diffuse_color * (diffuse_intensity * material.albedo[0]) +
                   Vec3f(1.f, 1.f, 1.f) * (specular_intensity * material.albedo[1]);
        }
    }

    Vec3f reflect(const Vec3f &I, const Vec3f &N)
    {
        return I - N * (2.f * (I * N));
    }

    Vec3f refract(const Vec3f &I, const Vec3f &N, const float &refractive_index)
    {
        float cosi = -std::max(-1.f, std::min(1.f, I * N));
        float etai = 1.f, etat = refractive_index;
        Vec3f n = N;
        if (cosi < 0.f)
        {
            cosi = -cosi;
            std::swap(etai, etat);
            n = -N;
        }

        float eta = etai / etat;
        float k = 1.f - eta * eta * (1.f - cosi * cosi);
        return k < 0.f ? Vec3f(0.f, 0.f, 0.f) : I * eta + n * (eta * cosi - std::sqrt(k));
    }

    Vec3f cast_ray_step_dispatcher(
        const Vec3f &orig,
        const Vec3f &dir,
        const Vec3f &backg,
        const std::vector<Sphere> &spheres,
        const std::vector<Light> &lights,
        size_t depth,
        const int current_step,
        RenderMetrics &metrics)
    {
        switch (static_cast<RayTraceStep>(current_step))
        {
            case RayTraceStep::BACKGROUND:
                return cast_ray(orig, dir, backg, spheres, metrics);

            case RayTraceStep::DIFFUSE:
                return cast_ray_diffuse(orig, dir, backg, spheres, lights, metrics);

            case RayTraceStep::SPECULAR:
                return cast_ray_specular(orig, dir, backg, spheres, lights, metrics);

            case RayTraceStep::SHADOWS:
                return cast_ray_shadows(orig, dir, backg, spheres, lights, metrics);

            case RayTraceStep::REFLECTION:
                return cast_ray_reflect(orig, dir, backg, spheres, lights, depth, metrics);

            case RayTraceStep::REFRACTION:
            default:
                return cast_ray_refract(orig, dir, backg, spheres, lights, depth, metrics);
        }
    }

    Vec3f cast_ray(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, RenderMetrics &metrics)
    {
        Vec3f point, N;
        Material material;
        if (!scene_intersect(orig, dir, spheres, point, N, material, false, metrics))
            return backg;

        return material.diffuse_color;
    }

    Vec3f cast_ray_diffuse(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights, RenderMetrics &metrics)
    {
        Vec3f point, N;
        Material material;
        if (!scene_intersect(orig, dir, spheres, point, N, material, false, metrics))
            return backg;

        float diffuse_light_intensity = 0.f;
        for (size_t i = 0; i < lights.size(); i++)
        {
            Vec3f light_dir = (lights[i].stand - point).normalize();
            diffuse_light_intensity += lights[i].depth * std::max(0.f, light_dir * N);
        }

        return material.diffuse_color * diffuse_light_intensity;
    }

    Vec3f cast_ray_specular(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights, RenderMetrics &metrics)
    {
        Vec3f point, N;
        Material material;
        if (!scene_intersect(orig, dir, spheres, point, N, material, false, metrics))
            return backg;

        float diffuse_light_intensity = 0.f, specular_light_intensity = 0.f;
        for (size_t i = 0; i < lights.size(); i++)
        {
            Vec3f light_dir = (lights[i].stand - point).normalize();
            diffuse_light_intensity += lights[i].depth * std::max(0.f, light_dir * N);
            specular_light_intensity += std::pow(std::max(0.f, -reflect(-light_dir, N) * dir), material.specular_exponent) * lights[i].depth;
        }

        return material.diffuse_color * (diffuse_light_intensity * material.albedo[0]) +
               Vec3f(1.f, 1.f, 1.f) * (specular_light_intensity * material.albedo[1]);
    }

    Vec3f cast_ray_shadows(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights, RenderMetrics &metrics)
    {
        Vec3f point, N;
        Material material;
        if (!scene_intersect(orig, dir, spheres, point, N, material, false, metrics))
            return backg;

        return shade_direct_lighting(point, N, dir, material, spheres, lights, metrics);
    }

    Vec3f cast_ray_reflect(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights, size_t depth, RenderMetrics &metrics)
    {
        Vec3f point, N;
        Material material;
        if (depth > MAX_RAY_DEPTH || !scene_intersect(orig, dir, spheres, point, N, material, false, metrics))
            return backg;

        Vec3f reflect_color(0.f, 0.f, 0.f);
        if (material.albedo[2] > 1e-4f)
        {
            metrics.secondaryRays++;
            Vec3f reflect_dir = reflect(dir, N).normalize();
            Vec3f reflect_orig = reflect_dir * N < 0.f ? point - N * 1e-3f : point + N * 1e-3f;
            reflect_color = cast_ray_reflect(reflect_orig, reflect_dir, backg, spheres, lights, depth + 1, metrics);
        }

        Vec3f direct_color = shade_direct_lighting(point, N, dir, material, spheres, lights, metrics);
        return direct_color + reflect_color * material.albedo[2];
    }

    Vec3f cast_ray_refract(const Vec3f &orig, const Vec3f &dir, const Vec3f &backg, const std::vector<Sphere> &spheres, const std::vector<Light> &lights, size_t depth, RenderMetrics &metrics)
    {
        Vec3f point, N;
        Material material;
        if (depth > MAX_RAY_DEPTH || !scene_intersect(orig, dir, spheres, point, N, material, false, metrics))
            return backg;

        Vec3f reflect_color(0.f, 0.f, 0.f);
        if (material.albedo[2] > 1e-4f)
        {
            metrics.secondaryRays++;
            Vec3f reflect_dir = reflect(dir, N).normalize();
            Vec3f reflect_orig = reflect_dir * N < 0.f ? point - N * 1e-3f : point + N * 1e-3f;
            reflect_color = cast_ray_refract(reflect_orig, reflect_dir, backg, spheres, lights, depth + 1, metrics);
        }

        Vec3f refract_color(0.f, 0.f, 0.f);
        if (material.albedo[3] > 1e-4f)
        {
            Vec3f raw_refract = refract(dir, N, material.refractive_index);
            if (norm2(raw_refract) > 1e-6f)
            {
                metrics.secondaryRays++;
                Vec3f refract_dir = raw_refract.normalize();
                Vec3f refract_orig = refract_dir * N < 0.f ? point - N * 1e-3f : point + N * 1e-3f;
                refract_color = cast_ray_refract(refract_orig, refract_dir, backg, spheres, lights, depth + 1, metrics);
            }
        }

        Vec3f direct_color = shade_direct_lighting(point, N, dir, material, spheres, lights, metrics);
        return direct_color + reflect_color * material.albedo[2] + refract_color * material.albedo[3];
    }

    bool scene_occluded(const Vec3f &orig, const Vec3f &dir, float max_dist, const std::vector<Sphere> &spheres, RenderMetrics &metrics)
    {
        for (size_t i = 0; i < spheres.size(); i++)
        {
            metrics.intersectionTests += 1.0;
            float dist_i = 0.f;
            if (spheres[i].rayCrossingTest(orig, dir, dist_i) && dist_i > 1e-4f && dist_i < max_dist)
            {
                return true;
            }
        }
        return false;
    }

    bool scene_intersect(const Vec3f &orig, const Vec3f &dir, const std::vector<Sphere> &spheres, Vec3f &hit, Vec3f &N, Material &material, bool out_scene, RenderMetrics &metrics)
    {
        float spheres_dist = std::numeric_limits<float>::max();
        int closest_idx = -1;

        for (size_t i = 0; i < spheres.size(); i++)
        {
            metrics.intersectionTests += 1.0;
            float dist_i = 0.f;
            if (spheres[i].rayCrossingTest(orig, dir, dist_i) && dist_i < spheres_dist)
            {
                spheres_dist = dist_i;
                closest_idx = static_cast<int>(i);
            }
        }

        if (closest_idx >= 0)
        {
            hit = orig + dir * spheres_dist;
            N = (hit - spheres[closest_idx].center).normalize();
            material = spheres[closest_idx].material;
        }

        if (out_scene)
            return generate_scene(orig, dir, hit, spheres_dist, N, material);

        return spheres_dist < 1000.f;
    }

    bool generate_scene(const Vec3f &orig, const Vec3f &dir, Vec3f &hit, float spheres_dist, Vec3f &N, Material &material)
    {
        float checkerboard_dist = std::numeric_limits<float>::max();
        if (std::fabs(dir.y) > 1e-3f)
        {
            float d = -(orig.y + 4.f) / dir.y;
            Vec3f pt = orig + dir * d;

            if (d > 0.f && std::fabs(pt.x) < 10.f && pt.z < -10.f && pt.z > -30.f && d < spheres_dist)
            {
                checkerboard_dist = d;
                hit = pt;
                N = Vec3f(0.f, 1.f, 0.f);
                material.diffuse_color = (int(.5f * hit.x + 1000.f) + int(.5f * hit.z)) & 1 ? Vec3f(.3f, .3f, .3f) : Vec3f(.1f, .1f, .1f);
            }
        }

        return std::min(spheres_dist, checkerboard_dist) < 1000.f;
    }
}