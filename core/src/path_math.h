#ifndef PATH_MATH_H
#define PATH_MATH_H

#include <vector>
#include <cstdint>
#include "geometry.h"
#include "material.h"
#include "sphere.h"
#include "mesh.h"
#include "light.h"
#include "render_metrics.h"
#include "texture.h"

namespace PathTracing
{
    enum class PathTraceStep : int {
        EMISSION_AND_ALBEDO = 0,
        DIRECT_AREA_LIGHT   = 1,
        ONE_BOUNCE_GI       = 2,
        MULTI_BOUNCE_GI     = 3
    };

    struct RngState {
        uint32_t state;

        explicit RngState(uint32_t seed = 1u) : state(seed ? seed : 1u) {}

        inline uint32_t nextUint() {
            uint32_t x = state;
            x ^= x << 13;
            x ^= x >> 17;
            x ^= x << 5;
            state = x;
            return x;
        }

        inline float nextFloat() {
            return static_cast<float>(nextUint() >> 8) * (1.0f / 16777216.0f);
        }
    };

    uint32_t hash_seed(uint32_t pixel_idx, uint32_t sample_idx, uint32_t base_seed);

    Vec3f trace_path_step_dispatcher(
        const Vec3f &orig,
        const Vec3f &dir,
        const Vec3f &backg,
        const std::vector<Sphere> &spheres,
        const std::vector<Mesh> &meshes,
        const std::vector<Light> &lights,
        int current_step,
        RngState &rng,
        RenderMetrics &metrics,
        const EnvironmentMap &envMap,
        const std::vector<TextureBuffer> &textures
    );

    inline Vec3f trace_path_step_dispatcher(
        const Vec3f &orig,
        const Vec3f &dir,
        const Vec3f &backg,
        const std::vector<Sphere> &spheres,
        const std::vector<Mesh> &meshes,
        const std::vector<Light> &lights,
        int current_step,
        RngState &rng,
        RenderMetrics &metrics)
    {
        static const EnvironmentMap default_env;
        static const std::vector<TextureBuffer> empty_textures;
        return trace_path_step_dispatcher(orig, dir, backg, spheres, meshes, lights, current_step, rng, metrics, default_env, empty_textures);
    }

    inline Vec3f trace_path_step_dispatcher(
        const Vec3f &orig,
        const Vec3f &dir,
        const Vec3f &backg,
        const std::vector<Sphere> &spheres,
        const std::vector<Light> &lights,
        int current_step,
        RngState &rng,
        RenderMetrics &metrics)
    {
        static const std::vector<Mesh> empty_meshes;
        return trace_path_step_dispatcher(orig, dir, backg, spheres, empty_meshes, lights, current_step, rng, metrics);
    }
}

#endif // PATH_MATH_H