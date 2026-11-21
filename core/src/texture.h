#ifndef TEXTURE_H
#define TEXTURE_H

#include <vector>
#include <array>
#include <cstdint>
#include <cmath>
#include <algorithm>
#include "geometry.h"
#include "material.h"

enum TextureType : int {
    TEX_SOLID = 0,
    TEX_CHECKER = 1,
    TEX_STRIPES = 2,
    TEX_MARBLE = 3,
    TEX_IMAGE = 4
};

struct TextureBuffer {
    int width = 0;
    int height = 0;
    std::vector<uint8_t> rgba;

    bool isValid() const {
        return width > 0 && height > 0 && rgba.size() >= static_cast<size_t>(width) * height * 4;
    }

    void setPixels(int w, int h, std::vector<uint8_t>&& data) {
        width = w;
        height = h;
        rgba = std::move(data);
    }

    void clear() {
        width = 0;
        height = 0;
        rgba.clear();
    }

    static inline float byteToChannel(uint8_t b, bool linearize) {
        if (!linearize) {
            return static_cast<float>(b) * (1.0f / 255.0f);
        }
        static const std::array<float, 256> srgbLut = []() {
            std::array<float, 256> t{};
            for (int i = 0; i < 256; ++i) {
                float c = static_cast<float>(i) / 255.0f;
                t[i] = (c <= 0.04045f) ? (c / 12.92f) : std::pow((c + 0.055f) / 1.055f, 2.4f);
            }
            return t;
        }();
        return srgbLut[b];
    }

    inline Vec3f fetchTexel(int x, int y, bool linearize) const {
        const int cx = ((x % width) + width) % width;
        const int cy = std::max(0, std::min(height - 1, y));
        const size_t idx = static_cast<size_t>(cy * width + cx) * 4;
        return Vec3f(
            byteToChannel(rgba[idx], linearize),
            byteToChannel(rgba[idx + 1], linearize),
            byteToChannel(rgba[idx + 2], linearize)
        );
    }

    Vec3f sampleBilinear(float u, float v, bool linearize) const {
        if (!isValid()) return Vec3f(1.0f, 0.0f, 1.0f);

        u = u - std::floor(u);
        v = std::max(0.0f, std::min(1.0f, v));

        const float fx = u * static_cast<float>(width) - 0.5f;
        const float fy = v * static_cast<float>(height) - 0.5f;

        const int x0 = static_cast<int>(std::floor(fx));
        const int y0 = static_cast<int>(std::floor(fy));
        const float tx = fx - static_cast<float>(x0);
        const float ty = fy - static_cast<float>(y0);

        const Vec3f c00 = fetchTexel(x0, y0, linearize);
        const Vec3f c10 = fetchTexel(x0 + 1, y0, linearize);
        const Vec3f c01 = fetchTexel(x0, y0 + 1, linearize);
        const Vec3f c11 = fetchTexel(x0 + 1, y0 + 1, linearize);

        const Vec3f top = c00 * (1.0f - tx) + c10 * tx;
        const Vec3f bot = c01 * (1.0f - tx) + c11 * tx;
        return top * (1.0f - ty) + bot * ty;
    }
};

struct EnvironmentMap {
    TextureBuffer texture;
    bool enabled = false;
    float intensity = 1.0f;
    float rotationRad = 0.0f;

    Vec3f sample(const Vec3f& dir, const Vec3f& fallbackBg, bool linearize) const {
        if (!enabled || !texture.isValid()) {
            return fallbackBg;
        }

        constexpr float invTwoPi = 1.0f / (2.0f * 3.14159265359f);
        constexpr float invPi = 1.0f / 3.14159265359f;

        const float phi = std::atan2(dir[2], dir[0]) + rotationRad;
        const float theta = std::asin(std::max(-1.0f, std::min(1.0f, dir[1])));

        const float u = 0.5f + phi * invTwoPi;
        const float v = 0.5f - theta * invPi;

        return texture.sampleBilinear(u, v, linearize) * intensity;
    }
};

namespace TextureSampling {

    inline float hash3(int x, int y, int z) {
        uint32_t n = static_cast<uint32_t>(x * 374761393 + y * 668265263 + z * 2147483647);
        n = (n ^ (n >> 13)) * 1274126177u;
        return static_cast<float>((n ^ (n >> 16)) & 0x7fffffffu) / static_cast<float>(0x7fffffff);
    }

    inline float valueNoise3D(const Vec3f& p) {
        const int ix = static_cast<int>(std::floor(p[0]));
        const int iy = static_cast<int>(std::floor(p[1]));
        const int iz = static_cast<int>(std::floor(p[2]));

        const float fx = p[0] - ix;
        const float fy = p[1] - iy;
        const float fz = p[2] - iz;

        const float ux = fx * fx * (3.0f - 2.0f * fx);
        const float uy = fy * fy * (3.0f - 2.0f * fy);
        const float uz = fz * fz * (3.0f - 2.0f * fz);

        const float c000 = hash3(ix, iy, iz);
        const float c100 = hash3(ix + 1, iy, iz);
        const float c010 = hash3(ix, iy + 1, iz);
        const float c110 = hash3(ix + 1, iy + 1, iz);
        const float c001 = hash3(ix, iy, iz + 1);
        const float c101 = hash3(ix + 1, iy, iz + 1);
        const float c011 = hash3(ix, iy + 1, iz + 1);
        const float c111 = hash3(ix + 1, iy + 1, iz + 1);

        const float x00 = c000 + (c100 - c000) * ux;
        const float x10 = c010 + (c110 - c010) * ux;
        const float x01 = c001 + (c101 - c001) * ux;
        const float x11 = c011 + (c111 - c011) * ux;

        const float y0 = x00 + (x10 - x00) * uy;
        const float y1 = x01 + (x11 - x01) * uy;
        return y0 + (y1 - y0) * uz;
    }

    inline Vec3f resolveSurfaceColor(
        const Material& mat,
        const Vec3f& hitPoint,
        float u,
        float v,
        const std::vector<TextureBuffer>& textures,
        bool linearize
    ) {
        if (mat.texture_type == TEX_SOLID) {
            return mat.diffuse_color;
        }

        const float s = std::max(0.05f, mat.tex_scale);
        const Vec3f p = hitPoint * s;

        if (mat.texture_type == TEX_CHECKER) {
            const int cx = static_cast<int>(std::floor(p[0] + 1e-3f));
            const int cy = static_cast<int>(std::floor(p[1] + 1e-3f));
            const int cz = static_cast<int>(std::floor(p[2] + 1e-3f));
            const bool isEven = ((cx + cy + cz) & 1) == 0;
            return isEven ? mat.diffuse_color : mat.secondary_color;
        }

        if (mat.texture_type == TEX_STRIPES) {
            const float wave = std::sin((p[0] + p[1] + p[2]) * 3.14159265f);
            return wave >= 0.0f ? mat.diffuse_color : mat.secondary_color;
        }

        if (mat.texture_type == TEX_MARBLE) {
            const float n = valueNoise3D(p) + 0.5f * valueNoise3D(p * 2.03f);
            const float t = 0.5f + 0.5f * std::sin((p[0] + n * 2.2f) * 3.14159265f);
            return mat.diffuse_color * t + mat.secondary_color * (1.0f - t);
        }

        if (mat.texture_type == TEX_IMAGE &&
            mat.texture_id >= 0 &&
            static_cast<size_t>(mat.texture_id) < textures.size() &&
            textures[mat.texture_id].isValid()) {
            return textures[mat.texture_id].sampleBilinear(u * s, v * s, linearize);
        }

        return mat.diffuse_color;
    }
}

#endif // TEXTURE_H