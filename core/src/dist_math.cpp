#include <cmath>
#include <algorithm>
#include <limits>
#include "dist_math.h"

namespace DistributionRayTracing
{
    namespace
    {
        constexpr size_t MAX_DIST_DEPTH = 4;
        constexpr float PI = 3.14159265358979323846f;

        inline Vec3f srgb_to_linear(const Vec3f &c)
        {
            return Vec3f(
                std::pow(std::max(0.f, c.x), 2.2f),
                std::pow(std::max(0.f, c.y), 2.2f),
                std::pow(std::max(0.f, c.z), 2.2f)
            );
        }

        inline Vec3f reflect_vec(const Vec3f &I, const Vec3f &N)
        {
            return I - N * (2.f * (I * N));
        }

        inline Vec3f refract_vec(const Vec3f &I, const Vec3f &N, float refractive_index, bool &out_tir)
        {
            float cosi = -std::max(-1.f, std::min(1.f, I * N));
            float etai = 1.f;
            float etat = std::max(1.001f, refractive_index);
            Vec3f n = N;

            if (cosi < 0.f)
            {
                cosi = -cosi;
                std::swap(etai, etat);
                n = -N;
            }

            const float eta = etai / etat;
            const float k = 1.f - eta * eta * (1.f - cosi * cosi);
            if (k < 0.f)
            {
                out_tir = true;
                return Vec3f(0.f, 0.f, 0.f);
            }

            out_tir = false;
            return I * eta + n * (eta * cosi - std::sqrt(k));
        }

        inline void build_onb(const Vec3f &N, Vec3f &tangent, Vec3f &bitangent)
        {
            const float sign = std::copysign(1.0f, N.z);
            const float a = -1.0f / (sign + N.z);
            const float b = N.x * N.y * a;
            tangent = Vec3f(1.0f + sign * N.x * N.x * a, sign * b, -sign * N.x);
            bitangent = Vec3f(b, sign + N.y * N.y * a, -N.y);
        }

        inline Vec3f sample_unit_sphere(DistRng &rng)
        {
            const float z = 1.0f - 2.0f * rng.nextFloat();
            const float r = std::sqrt(std::max(0.0f, 1.0f - z * z));
            const float phi = 2.0f * PI * rng.nextFloat();
            return Vec3f(r * std::cos(phi), r * std::sin(phi), z);
        }

        inline Vec3f perturb_glossy_direction(
            const Vec3f &ideal_dir,
            const Vec3f &surface_normal,
            float spread,
            bool keep_same_hemisphere,
            DistRng &rng)
        {
            if (spread <= 1e-4f)
                return ideal_dir;

            float dx = 0.f, dy = 0.f;
            sample_concentric_disk(rng, dx, dy);

            Vec3f T, B;
            build_onb(ideal_dir, T, B);

            const Vec3f offset = (T * dx + B * dy) * spread;
            Vec3f candidate = (ideal_dir + offset).normalize();

            if (keep_same_hemisphere)
            {
                const float ref_sign = ideal_dir * surface_normal;
                if ((candidate * surface_normal) * ref_sign <= 0.f)
                {
                    candidate = (ideal_dir - offset).normalize();
                }
            }

            return candidate;
        }

        bool scene_occluded(
            const Vec3f &orig,
            const Vec3f &dir,
            float max_dist,
            const std::vector<Sphere> &spheres,
            const std::vector<Mesh> &meshes,
            RenderMetrics &metrics)
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

            for (size_t i = 0; i < meshes.size(); i++)
            {
                if (meshes[i].occluded(orig, dir, max_dist, metrics))
                {
                    return true;
                }
            }

            return false;
        }

        bool scene_intersect(
            const Vec3f &orig,
            const Vec3f &dir,
            const std::vector<Sphere> &spheres,
            const std::vector<Mesh> &meshes,
            Vec3f &hit,
            Vec3f &N,
            Material &material,
            float &hit_u,
            float &hit_v,
            RenderMetrics &metrics)
        {
            float closest_dist = std::numeric_limits<float>::max();
            int closest_sphere = -1;
            hit_u = 0.f;
            hit_v = 0.f;

            for (size_t i = 0; i < spheres.size(); i++)
            {
                metrics.intersectionTests += 1.0;
                float dist_i = 0.f;
                if (spheres[i].rayCrossingTest(orig, dir, dist_i) && dist_i > 1e-4f && dist_i < closest_dist)
                {
                    closest_dist = dist_i;
                    closest_sphere = static_cast<int>(i);
                }
            }

            if (closest_sphere >= 0)
            {
                hit = orig + dir * closest_dist;
                N = (hit - spheres[closest_sphere].center).normalize();
                material = spheres[closest_sphere].material;
                hit_u = 0.5f + std::atan2(N.z, N.x) * (1.0f / (2.0f * PI));
                hit_v = 0.5f - std::asin(std::max(-1.0f, std::min(1.0f, N.y))) * (1.0f / PI);
            }

            for (size_t i = 0; i < meshes.size(); i++)
            {
                float mesh_t = 0.f;
                Vec3f mesh_N;
                if (meshes[i].intersect(orig, dir, closest_dist, mesh_t, mesh_N, metrics))
                {
                    closest_dist = mesh_t;
                    hit = orig + dir * mesh_t;
                    N = mesh_N;
                    material = meshes[i].material;

                    const float ax = std::fabs(mesh_N.x), ay = std::fabs(mesh_N.y), az = std::fabs(mesh_N.z);
                    if (ay >= ax && ay >= az) {
                        hit_u = hit.x * 0.25f + 0.5f;
                        hit_v = hit.z * 0.25f + 0.5f;
                    } else if (ax >= ay && ax >= az) {
                        hit_u = hit.z * 0.25f + 0.5f;
                        hit_v = 0.5f - hit.y * 0.25f;
                    } else {
                        hit_u = hit.x * 0.25f + 0.5f;
                        hit_v = 0.5f - hit.y * 0.25f;
                    }
                }
            }

            return closest_dist < 1000.f;
        }

        Vec3f shade_distributed_direct(
            const Vec3f &point,
            const Vec3f &N,
            const Vec3f &view_dir,
            const Vec3f &linear_diffuse,
            const Material &material,
            bool enable_soft_shadows,
            const std::vector<Sphere> &spheres,
            const std::vector<Mesh> &meshes,
            const std::vector<Light> &lights,
            DistRng &rng,
            RenderMetrics &metrics)
        {
            Vec3f total_direct(0.f, 0.f, 0.f);

            for (size_t i = 0; i < lights.size(); i++)
            {
                Vec3f sample_pos = lights[i].stand;
                if (enable_soft_shadows && lights[i].radius > 1e-4f)
                {
                    sample_pos = sample_pos + sample_unit_sphere(rng) * lights[i].radius;
                }

                const Vec3f to_light = sample_pos - point;
                const float dist2 = norm2(to_light);
                if (dist2 <= 1e-8f)
                    continue;

                const float dist = std::sqrt(dist2);
                const Vec3f light_dir = to_light * (1.0f / dist);
                const float ndotl = light_dir * N;

                if (ndotl <= 0.f && material.albedo[3] <= 1e-4f)
                    continue;

                const Vec3f shadow_orig = ndotl < 0.f ? point - N * 1e-3f : point + N * 1e-3f;
                const float shadow_max_dist = std::max(1e-3f, dist - 1e-3f);
                metrics.shadowRays++;

                if (scene_occluded(shadow_orig, light_dir, shadow_max_dist, spheres, meshes, metrics))
                    continue;

                if (ndotl > 0.f)
                {
                    const Vec3f light_rad = srgb_to_linear(lights[i].color) * lights[i].depth;
                    const Vec3f diff_term = cwise_mul(linear_diffuse, light_rad) * (ndotl * material.albedo[0]);

                    Vec3f spec_term(0.f, 0.f, 0.f);
                    const float spec_cos = std::max(0.f, -reflect_vec(-light_dir, N) * view_dir);
                    if (spec_cos > 0.f && material.albedo[1] > 1e-4f)
                    {
                        const float spec_factor = std::pow(spec_cos, material.specular_exponent) * material.albedo[1];
                        spec_term = light_rad * spec_factor;
                    }

                    total_direct = total_direct + diff_term + spec_term;
                }
            }

            return total_direct;
        }
    }

    uint32_t hash_pixel_seed(uint32_t pixel_idx, uint32_t sample_idx, uint32_t base_seed)
    {
        uint32_t h = pixel_idx * 2246822519u + sample_idx * 3266489917u + base_seed * 668265263u + 374761393u;
        h = (h ^ (h >> 15)) * 2246822519u;
        h = (h ^ (h >> 13)) * 3266489917u;
        h = h ^ (h >> 16);
        return h ? h : 1u;
    }

    void sample_concentric_disk(DistRng &rng, float &out_x, float &out_y)
    {
        const float u1 = 2.0f * rng.nextFloat() - 1.0f;
        const float u2 = 2.0f * rng.nextFloat() - 1.0f;

        if (u1 == 0.0f && u2 == 0.0f)
        {
            out_x = 0.0f;
            out_y = 0.0f;
            return;
        }

        float r = 0.0f;
        float theta = 0.0f;
        if (std::fabs(u1) > std::fabs(u2))
        {
            r = u1;
            theta = (PI * 0.25f) * (u2 / u1);
        }
        else
        {
            r = u2;
            theta = (PI * 0.5f) - (PI * 0.25f) * (u1 / u2);
        }

        out_x = r * std::cos(theta);
        out_y = r * std::sin(theta);
    }

    Vec3f trace_distribution_ray(
        const Vec3f &orig,
        const Vec3f &dir,
        const Vec3f &backg,
        const std::vector<Sphere> &spheres,
        const std::vector<Mesh> &meshes,
        const std::vector<Light> &lights,
        size_t depth,
        int current_step,
        DistRng &rng,
        RenderMetrics &metrics,
        const EnvironmentMap &envMap,
        const std::vector<TextureBuffer> &textures)
    {
        const Vec3f linear_bg = srgb_to_linear(backg);
        const DistributionTraceStep step = static_cast<DistributionTraceStep>(current_step);

        Vec3f point, N;
        Material material;
        float hit_u = 0.f, hit_v = 0.f;

        if (depth > MAX_DIST_DEPTH || !scene_intersect(orig, dir, spheres, meshes, point, N, material, hit_u, hit_v, metrics))
        {
            return envMap.sample(dir, linear_bg, true, metrics);
        }

        const bool enable_soft_shadows = (step >= DistributionTraceStep::SOFT_SHADOWS);
        const bool enable_glossy = (step >= DistributionTraceStep::GLOSSY_BRDF);

        Vec3f surface_col = TextureSampling::resolveSurfaceColor(material, point, hit_u, hit_v, textures, true);
        const Vec3f linear_diffuse = (material.texture_type == TEX_IMAGE) ? surface_col : srgb_to_linear(surface_col);
        const Vec3f linear_emission = srgb_to_linear(material.emission);

        Vec3f reflect_color(0.f, 0.f, 0.f);
        if (material.albedo[2] > 1e-4f)
        {
            metrics.secondaryRays++;
            Vec3f reflect_dir = reflect_vec(dir, N).normalize();
            if (enable_glossy && material.roughness > 1e-3f)
            {
                const float spread = material.roughness * material.roughness * 0.65f;
                reflect_dir = perturb_glossy_direction(reflect_dir, N, spread, true, rng);
            }
            const Vec3f reflect_orig = (reflect_dir * N < 0.f) ? (point - N * 1e-3f) : (point + N * 1e-3f);
            reflect_color = trace_distribution_ray(
                reflect_orig, reflect_dir, backg, spheres, meshes, lights,
                depth + 1, current_step, rng, metrics, envMap, textures
            );
        }

        Vec3f refract_color(0.f, 0.f, 0.f);
        if (material.albedo[3] > 1e-4f)
        {
            bool tir = false;
            Vec3f raw_refract = refract_vec(dir, N, material.refractive_index, tir);
            metrics.secondaryRays++;

            if (tir)
            {
                Vec3f tir_dir = reflect_vec(dir, N).normalize();
                if (enable_glossy && material.roughness > 1e-3f)
                {
                    const float spread = material.roughness * material.roughness * 0.65f;
                    tir_dir = perturb_glossy_direction(tir_dir, N, spread, true, rng);
                }
                const Vec3f tir_orig = (tir_dir * N < 0.f) ? (point - N * 1e-3f) : (point + N * 1e-3f);
                refract_color = trace_distribution_ray(
                    tir_orig, tir_dir, backg, spheres, meshes, lights,
                    depth + 1, current_step, rng, metrics, envMap, textures
                );
            }
            else if (norm2(raw_refract) > 1e-6f)
            {
                Vec3f refract_dir = raw_refract.normalize();
                if (enable_glossy && material.roughness > 1e-3f)
                {
                    const float spread = material.roughness * material.roughness * 0.35f;
                    refract_dir = perturb_glossy_direction(refract_dir, N, spread, true, rng);
                }
                const Vec3f refract_orig = (refract_dir * N < 0.f) ? (point - N * 1e-3f) : (point + N * 1e-3f);
                refract_color = trace_distribution_ray(
                    refract_orig, refract_dir, backg, spheres, meshes, lights,
                    depth + 1, current_step, rng, metrics, envMap, textures
                );
            }
        }

        const Vec3f direct_color = shade_distributed_direct(
            point, N, dir, linear_diffuse, material, enable_soft_shadows,
            spheres, meshes, lights, rng, metrics
        );

        return linear_emission
             + direct_color
             + reflect_color * material.albedo[2]
             + refract_color * material.albedo[3];
    }
}