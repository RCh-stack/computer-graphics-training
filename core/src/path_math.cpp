#include <cmath>
#include <algorithm>
#include <limits>
#include "path_math.h"

namespace PathTracing
{
    namespace
    {
        constexpr float PI = 3.14159265358979323846f;
        constexpr int MAX_BOUNCE_DEPTH = 5;

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

        inline Vec3f refract_vec(const Vec3f &I, const Vec3f &N, float eta)
        {
            float cosi = std::min(1.f, std::max(-1.f, -(I * N)));
            float k = 1.f - eta * eta * (1.f - cosi * cosi);
            if (k < 0.f)
                return Vec3f(0.f, 0.f, 0.f);
            return I * eta + N * (eta * cosi - std::sqrt(k));
        }

        inline float fresnel_schlick(float cosine, float ref_idx)
        {
            float r0 = (1.f - ref_idx) / (1.f + ref_idx);
            r0 = r0 * r0;
            float one_minus = 1.f - cosine;
            float one_minus2 = one_minus * one_minus;
            return r0 + (1.f - r0) * (one_minus2 * one_minus2 * one_minus);
        }

        inline void build_onb(const Vec3f &N, Vec3f &tangent, Vec3f &bitangent)
        {
            float sign = std::copysign(1.0f, N.z);
            const float a = -1.0f / (sign + N.z);
            const float b = N.x * N.y * a;
            tangent = Vec3f(1.0f + sign * N.x * N.x * a, sign * b, -sign * N.x);
            bitangent = Vec3f(b, sign + N.y * N.y * a, -N.y);
        }

        inline Vec3f sample_cosine_hemisphere(const Vec3f &N, RngState &rng)
        {
            float r1 = rng.nextFloat();
            float r2 = rng.nextFloat();

            float phi = 2.0f * PI * r1;
            float r = std::sqrt(r2);
            float x = r * std::cos(phi);
            float y = r * std::sin(phi);
            float z = std::sqrt(std::max(0.0f, 1.0f - r2));

            Vec3f T, B;
            build_onb(N, T, B);
            return (T * x + B * y + N * z).normalize();
        }

        inline Vec3f sample_unit_sphere(RngState &rng)
        {
            float z = 1.0f - 2.0f * rng.nextFloat();
            float r = std::sqrt(std::max(0.0f, 1.0f - z * z));
            float phi = 2.0f * PI * rng.nextFloat();
            return Vec3f(r * std::cos(phi), r * std::sin(phi), z);
        }

        bool ray_sphere_hit(const Vec3f &orig, const Vec3f &dir, const Vec3f center, float radius, float &t0)
        {
            if (radius <= 1e-5f) return false;
            Vec3f L = center - orig;
            float tca = L * dir;
            float d2 = L * L - tca * tca;
            float r2 = radius * radius;
            if (d2 > r2) return false;

            float thc = std::sqrt(r2 - d2);
            t0 = tca - thc;
            float t1 = tca + thc;
            if (t0 < 1e-4f) t0 = t1;
            return t0 >= 1e-4f;
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

        struct HitRecord {
            bool hit = false;
            bool isLight = false;
            float dist = std::numeric_limits<float>::max();
            Vec3f point;
            Vec3f normal;
            Material material;
            Vec3f lightEmission;
        };

        HitRecord intersect_scene_and_lights(
            const Vec3f &orig,
            const Vec3f &dir,
            const std::vector<Sphere> &spheres,
            const std::vector<Light> &lights,
            RenderMetrics &metrics)
        {
            HitRecord rec;
            int closest_sphere = -1;
            int closest_light = -1;

            for (size_t i = 0; i < spheres.size(); i++)
            {
                metrics.intersectionTests += 1.0;
                float dist_i = 0.f;
                if (spheres[i].rayCrossingTest(orig, dir, dist_i) && dist_i > 1e-4f && dist_i < rec.dist)
                {
                    rec.dist = dist_i;
                    closest_sphere = static_cast<int>(i);
                    closest_light = -1;
                }
            }

            for (size_t i = 0; i < lights.size(); i++)
            {
                metrics.intersectionTests += 1.0;
                float dist_l = 0.f;
                if (ray_sphere_hit(orig, dir, lights[i].stand, lights[i].radius, dist_l) && dist_l < rec.dist)
                {
                    rec.dist = dist_l;
                    closest_light = static_cast<int>(i);
                    closest_sphere = -1;
                }
            }

            if (closest_light >= 0)
            {
                rec.hit = true;
                rec.isLight = true;
                rec.point = orig + dir * rec.dist;
                rec.normal = (rec.point - lights[closest_light].stand).normalize();
                rec.lightEmission = srgb_to_linear(lights[closest_light].color) * lights[closest_light].depth;
            }
            else if (closest_sphere >= 0)
            {
                rec.hit = true;
                rec.isLight = false;
                rec.point = orig + dir * rec.dist;
                rec.normal = (rec.point - spheres[closest_sphere].center).normalize();
                rec.material = spheres[closest_sphere].material;
            }

            return rec;
        }

        Vec3f estimate_direct_area_lights(
            const Vec3f &point,
            const Vec3f &N,
            const Vec3f &linear_diffuse,
            const std::vector<Sphere> &spheres,
            const std::vector<Light> &lights,
            RngState &rng,
            RenderMetrics &metrics)
        {
            Vec3f direct(0.f, 0.f, 0.f);

            for (size_t i = 0; i < lights.size(); i++)
            {
                Vec3f sample_pos = lights[i].stand;
                if (lights[i].radius > 1e-4f)
                {
                    sample_pos = sample_pos + sample_unit_sphere(rng) * lights[i].radius;
                }

                Vec3f to_light = sample_pos - point;
                float dist2 = norm2(to_light);
                if (dist2 <= 1e-8f) continue;

                float dist = std::sqrt(dist2);
                Vec3f light_dir = to_light * (1.0f / dist);
                float ndotl = light_dir * N;
                if (ndotl <= 0.f) continue;

                float shadow_max_dist = std::max(1e-3f, dist - 1e-3f);
                Vec3f shadow_orig = point + N * 1e-3f;
                metrics.shadowRays++;

                if (!scene_occluded(shadow_orig, light_dir, shadow_max_dist, spheres, metrics))
                {
                    Vec3f light_rad = srgb_to_linear(lights[i].color) * lights[i].depth;
                    direct = direct + cwise_mul(linear_diffuse, light_rad) * ndotl;
                }
            }

            return direct;
        }
    }

    uint32_t hash_seed(uint32_t pixel_idx, uint32_t sample_idx, uint32_t base_seed)
    {
        uint32_t h = pixel_idx * 1973u + sample_idx * 9277u + base_seed * 26699u + 911u;
        h = (h ^ 61u) ^ (h >> 16);
        h *= 9u;
        h = h ^ (h >> 4);
        h *= 0x27d4eb2du;
        h = h ^ (h >> 15);
        return h ? h : 1u;
    }

    Vec3f trace_path_step_dispatcher(
        const Vec3f &orig,
        const Vec3f &dir,
        const Vec3f &backg,
        const std::vector<Sphere> &spheres,
        const std::vector<Light> &lights,
        int current_step,
        RngState &rng,
        RenderMetrics &metrics)
    {
        const PathTraceStep step = static_cast<PathTraceStep>(current_step);
        const Vec3f linear_bg = srgb_to_linear(backg);

        int max_bounces = 0;
        if (step == PathTraceStep::ONE_BOUNCE_GI) max_bounces = 1;
        else if (step >= PathTraceStep::MULTI_BOUNCE_GI) max_bounces = MAX_BOUNCE_DEPTH;

        Vec3f ray_orig = orig;
        Vec3f ray_dir = dir;
        Vec3f radiance(0.f, 0.f, 0.f);
        Vec3f throughput(1.f, 1.f, 1.f);
        bool last_bounce_specular = true;

        for (int bounce = 0; bounce <= max_bounces; bounce++)
        {
            if (bounce > 0)
            {
                metrics.secondaryRays++;
            }

            HitRecord rec = intersect_scene_and_lights(ray_orig, ray_dir, spheres, lights, metrics);

            if (!rec.hit)
            {
                if (step == PathTraceStep::EMISSION_AND_ALBEDO || bounce == 0 || !last_bounce_specular)
                {
                    radiance = radiance + cwise_mul(throughput, linear_bg);
                }
                else
                {
                    radiance = radiance + cwise_mul(throughput, linear_bg);
                }
                break;
            }

            if (rec.isLight)
            {
                if (step == PathTraceStep::EMISSION_AND_ALBEDO || last_bounce_specular)
                {
                    radiance = radiance + cwise_mul(throughput, rec.lightEmission);
                }
                break;
            }

            const Material &mat = rec.material;
            const Vec3f linear_albedo = srgb_to_linear(mat.diffuse_color);
            const Vec3f linear_emission = srgb_to_linear(mat.emission);

            if (step == PathTraceStep::EMISSION_AND_ALBEDO)
            {
                radiance = radiance + cwise_mul(throughput, linear_emission + linear_albedo);
                break;
            }

            if (norm2(linear_emission) > 1e-6f)
            {
                radiance = radiance + cwise_mul(throughput, linear_emission);
            }

            const float w_diff = std::max(0.f, mat.albedo[0]);
            const float w_spec = std::max(0.f, mat.albedo[2]);
            const float w_refr = std::max(0.f, mat.albedo[3]);
            const float w_sum = w_diff + w_spec + w_refr;

            float p_refr = w_sum > 1e-5f ? (w_refr / w_sum) : 0.f;
            float p_spec = w_sum > 1e-5f ? (w_spec / w_sum) : 0.f;

            float event_rnd = rng.nextFloat();

            if (event_rnd < p_refr)
            {
                bool front_face = (ray_dir * rec.normal) < 0.f;
                Vec3f outward_N = front_face ? rec.normal : -rec.normal;
                float eta = front_face ? (1.0f / std::max(1.01f, mat.refractive_index)) : std::max(1.01f, mat.refractive_index);

                float cos_theta = std::min(1.0f, -(ray_dir * outward_N));
                float sin_theta = std::sqrt(std::max(0.0f, 1.0f - cos_theta * cos_theta));
                bool cannot_refract = (eta * sin_theta) > 1.0f;
                float refl_prob = fresnel_schlick(cos_theta, mat.refractive_index);

                Vec3f next_dir;
                if (cannot_refract || rng.nextFloat() < refl_prob)
                {
                    next_dir = reflect_vec(ray_dir, outward_N).normalize();
                    ray_orig = rec.point + outward_N * 1e-3f;
                }
                else
                {
                    next_dir = refract_vec(ray_dir, outward_N, eta).normalize();
                    ray_orig = rec.point - outward_N * 1e-3f;
                }

                if (mat.roughness > 1e-3f)
                {
                    float blur = mat.roughness * mat.roughness * 0.35f;
                    next_dir = (next_dir + sample_unit_sphere(rng) * blur).normalize();
                }

                ray_dir = next_dir;
                last_bounce_specular = true;

                Vec3f tint(
                    0.85f + 0.15f * linear_albedo.x,
                    0.85f + 0.15f * linear_albedo.y,
                    0.85f + 0.15f * linear_albedo.z
                );
                throughput = cwise_mul(throughput, tint);
            }
            else if (event_rnd < p_refr + p_spec)
            {
                Vec3f refl_dir = reflect_vec(ray_dir, rec.normal).normalize();
                if (mat.roughness > 1e-3f)
                {
                    float fuzzy = mat.roughness * mat.roughness;
                    Vec3f jittered = (refl_dir + sample_unit_sphere(rng) * fuzzy).normalize();
                    if ((jittered * rec.normal) > 0.f)
                        refl_dir = jittered;
                }

                ray_orig = rec.point + rec.normal * 1e-3f;
                ray_dir = refl_dir;
                last_bounce_specular = (mat.roughness < 0.15f);

                Vec3f spec_tint(
                    0.7f + 0.3f * linear_albedo.x,
                    0.7f + 0.3f * linear_albedo.y,
                    0.7f + 0.3f * linear_albedo.z
                );
                throughput = cwise_mul(throughput, spec_tint);
            }
            else
            {
                Vec3f direct_light = estimate_direct_area_lights(
                    rec.point, rec.normal, linear_albedo, spheres, lights, rng, metrics
                );
                radiance = radiance + cwise_mul(throughput, direct_light);

                if (bounce >= max_bounces)
                    break;

                ray_orig = rec.point + rec.normal * 1e-3f;
                ray_dir = sample_cosine_hemisphere(rec.normal, rng);
                throughput = cwise_mul(throughput, linear_albedo);
                last_bounce_specular = false;
            }

            if (bounce >= 2 && step >= PathTraceStep::MULTI_BOUNCE_GI)
            {
                float max_comp = std::max(throughput.x, std::max(throughput.y, throughput.z));
                float survive_prob = std::max(0.05f, std::min(0.95f, max_comp));
                if (rng.nextFloat() > survive_prob)
                {
                    break;
                }
                throughput = throughput * (1.0f / survive_prob);
            }
        }

        return radiance;
    }
}