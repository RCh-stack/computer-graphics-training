#ifndef TEXTURE_H
#define TEXTURE_H

#include <vector>
#include <cstdint>
#include <cmath>
#include <algorithm>
#include "geometry.h"
#include "material.h"
#include "render_metrics.h"

enum TextureType : int {
    TEX_NONE    = 0,
    TEX_CHECKER = 1,
    TEX_STRIPES = 2,
    TEX_MARBLE  = 3,
    TEX_IMAGE   = 4
};

class TextureBuffer {
private:
    int width = 0;
    int height = 0;
    std::vector<Vec3f> srgbNormPixels;
    std::vector<Vec3f> linearPixels;

    static const float* getSrgbToLinearLut() {
        static float lut[256];
        static bool initialized = false;
        if (!initialized) {
            for (int i = 0; i < 256; ++i) {
                lut[i] = std::pow(static_cast<float>(i) / 255.0f, 2.2f);
            }
            initialized = true;
        }
        return lut;
    }

public:
    bool isValid() const {
        return width > 0 && height > 0 && !linearPixels.empty();
    }

    void clear() {
        width = 0;
        height = 0;
        srgbNormPixels.clear();
        linearPixels.clear();
    }

    void setPixels(int w, int h, std::vector<uint8_t>&& rgbaBytes) {
        const size_t pixelCount = static_cast<size_t>(w) * static_cast<size_t>(h);
        if (w <= 0 || h <= 0 || rgbaBytes.size() < pixelCount * 4) {
            clear();
            return;
        }

        width = w;
        height = h;
        srgbNormPixels.resize(pixelCount);
        linearPixels.resize(pixelCount);

        const float* lut = getSrgbToLinearLut();
        constexpr float inv255 = 1.0f / 255.0f;

        for (size_t i = 0; i < pixelCount; ++i) {
            const size_t base = i * 4;
            const uint8_t r = rgbaBytes[base];
            const uint8_t g = rgbaBytes[base + 1];
            const uint8_t b = rgbaBytes[base + 2];

            srgbNormPixels[i] = Vec3f(r * inv255, g * inv255, b * inv255);
            linearPixels[i] = Vec3f(lut[r], lut[g], lut[b]);
        }
    }

    inline Vec3f sampleBilinear(float u, float v, bool linearOutput, bool wrapX = true) const {
        if (!isValid()) return Vec3f(0.f, 0.f, 0.f);

        u = u - std::floor(u);
        v = std::max(0.0f, std::min(1.0f, v));

        const float fx = wrapX
            ? u * static_cast<float>(width)
            : u * static_cast<float>(width - 1);
        const float fy = v * static_cast<float>(height - 1);

        int x0 = static_cast<int>(std::floor(fx));
        int y0 = static_cast<int>(std::floor(fy));
        const float tx = fx - static_cast<float>(x0);
        const float ty = fy - static_cast<float>(y0);

        int x1 = x0 + 1;
        if (wrapX) {
            x0 = ((x0 % width) + width) % width;
            x1 = (x0 + 1) % width;
        } else {
            x0 = std::max(0, std::min(width - 1, x0));
            x1 = std::max(0, std::min(width - 1, x1));
        }

        y0 = std::max(0, std::min(height - 1, y0));
        const int y1 = std::min(height - 1, y0 + 1);

        const std::vector<Vec3f>& buf = linearOutput ? linearPixels : srgbNormPixels;
        const size_t row0 = static_cast<size_t>(y0) * static_cast<size_t>(width);
        const size_t row1 = static_cast<size_t>(y1) * static_cast<size_t>(width);

        const Vec3f& c00 = buf[row0 + static_cast<size_t>(x0)];
        const Vec3f& c10 = buf[row0 + static_cast<size_t>(x1)];
        const Vec3f& c01 = buf[row1 + static_cast<size_t>(x0)];
        const Vec3f& c11 = buf[row1 + static_cast<size_t>(x1)];

        const Vec3f top = c00 * (1.0f - tx) + c10 * tx;
        const Vec3f bot = c01 * (1.0f - tx) + c11 * tx;
        return top * (1.0f - ty) + bot * ty;
    }
};

struct EnvironmentMap {
    bool enabled = false;
    float intensity = 1.0f;
    float rotationRad = 0.0f;
    TextureBuffer texture;

    mutable float cachedRotationRad = 0.0f;
    mutable float cosRot = 1.0f;
    mutable float sinRot = 0.0f;

    inline Vec3f sample(const Vec3f& dir, const Vec3f& fallbackBg, bool linearOutput) const {
        if (!enabled || !texture.isValid()) {
            return fallbackBg;
        }

        if (rotationRad != cachedRotationRad) {
            cachedRotationRad = rotationRad;
            cosRot = std::cos(-rotationRad);
            sinRot = std::sin(-rotationRad);
        }

        constexpr float INV_TWO_PI = 0.15915494309189533577f;
        constexpr float INV_PI     = 0.31830988618379067154f;

        const float rx = dir.x * cosRot + dir.z * sinRot;
        const float rz = -dir.x * sinRot + dir.z * cosRot;

        const float u = 0.5f + std::atan2(rz, rx) * INV_TWO_PI;
        const float clampedY = std::max(-1.0f, std::min(1.0f, dir.y));
        const float v = 0.5f - std::asin(clampedY) * INV_PI;

        return texture.sampleBilinear(u, v, linearOutput, true) * intensity;
    }

    inline Vec3f sample(const Vec3f& dir, const Vec3f& fallbackBg, bool linearOutput, RenderMetrics& metrics) const {
        if (enabled && texture.isValid()) {
            metrics.envLookups++;
        }
        return sample(dir, fallbackBg, linearOutput);
    }
};

namespace TextureSampling {

    inline float hash3(int x, int y, int z) {
        uint32_t n = static_cast<uint32_t>(x * 374761393 + y * 668265263 + z * 2147483647);
        n = (n ^ (n >> 13)) * 1274126177u;
        return static_cast<float>((n ^ (n >> 16)) & 0xFFFFu) * (1.0f / 65535.0f);
    }

    inline float valueNoise3D(float x, float y, float z) {
        const int ix = static_cast<int>(std::floor(x));
        const int iy = static_cast<int>(std::floor(y));
        const int iz = static_cast<int>(std::floor(z));

        const float fx = x - static_cast<float>(ix);
        const float fy = y - static_cast<float>(iy);
        const float fz = z - static_cast<float>(iz);

        const float ux = fx * fx * (3.0f - 2.0f * fx);
        const float uy = fy * fy * (3.0f - 2.0f * fy);
        const float uz = fz * fz * (3.0f - 2.0f * fz);

        const float c000 = hash3(ix,     iy,     iz);
        const float c100 = hash3(ix + 1, iy,     iz);
        const float c010 = hash3(ix,     iy + 1, iz);
        const float c110 = hash3(ix + 1, iy + 1, iz);
        const float c001 = hash3(ix,     iy,     iz + 1);
        const float c101 = hash3(ix + 1, iy,     iz + 1);
        const float c011 = hash3(ix,     iy + 1, iz + 1);
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
        const Vec3f& point,
        float u,
        float v,
        const std::vector<TextureBuffer>& textures,
        bool linearOutput)
    {
        if (mat.texture_type == TEX_NONE) {
            return mat.diffuse_color;
        }

        const float scale = std::max(0.05f, mat.tex_scale);

        if (mat.texture_type == TEX_CHECKER) {
            const int cx = static_cast<int>(std::floor(point.x * scale));
            const int cy = static_cast<int>(std::floor(point.y * scale));
            const int cz = static_cast<int>(std::floor(point.z * scale));
            return ((cx + cy + cz) & 1) ? mat.secondary_color : mat.diffuse_color;
        }

        if (mat.texture_type == TEX_STRIPES) {
            const float wave = std::sin((point.x + point.y) * scale * 3.14159265f);
            return wave >= 0.0f ? mat.diffuse_color : mat.secondary_color;
        }

        if (mat.texture_type == TEX_MARBLE) {
            const float px = point.x * scale;
            const float py = point.y * scale;
            const float pz = point.z * scale;
            float turb = 0.0f;
            float amp = 0.5f;
            float freq = 1.0f;
            for (int oct = 0; oct < 4; ++oct) {
                turb += amp * valueNoise3D(px * freq, py * freq, pz * freq);
                freq *= 2.02f;
                amp *= 0.5f;
            }
            const float t = 0.5f + 0.5f * std::sin(px * 2.2f + turb * 6.5f);
            return mat.diffuse_color * (1.0f - t) + mat.secondary_color * t;
        }

        if (mat.texture_type == TEX_IMAGE) {
            if (mat.texture_id >= 0 && static_cast<size_t>(mat.texture_id) < textures.size()) {
                const TextureBuffer& tex = textures[static_cast<size_t>(mat.texture_id)];
                if (tex.isValid()) {
                    return tex.sampleBilinear(u * scale, v * scale, linearOutput, true);
                }
            }
            return mat.diffuse_color;
        }

        return mat.diffuse_color;
    }
}

#endif // TEXTURE_H