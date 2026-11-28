#ifndef DIST_MATH_H
#define DIST_MATH_H

#include <vector>
#include <cstdint>
#include "geometry.h"
#include "material.h"
#include "sphere.h"
#include "mesh.h"
#include "light.h"
#include "render_metrics.h"
#include "texture.h"

namespace DistributionRayTracing
{
    enum class DistributionTraceStep : int {
        STOCHASTIC_AA = 0,
        SOFT_SHADOWS  = 1,
        GLOSSY_BRDF   = 2,
        DEPTH_OF_FIELD = 3
    };

    struct DistRng {
        uint32_t state;

        explicit DistRng(uint32_t seed = 1u) : state(seed ? seed : 1u) {}

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

    uint32_t hash_pixel_seed(uint32_t pixel_idx, uint32_t sample_idx, uint32_t base_seed);

    void sample_concentric_disk(DistRng &rng, float &out_x, float &out_y);

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
        const std::vector<TextureBuffer> &textures
    );
}

#endif // DIST_MATH_H