#include <iostream>
#include <vector>
#include <cmath>
#include <algorithm>
#include <chrono>
#include <emscripten/bind.h>

#include "src/ray_math.h"
#include "src/render_metrics.h"

using namespace RayTracing;

class RayTracer {
private:
    int width;
    int height;
    std::vector<unsigned char> rgbaBuffer;
    RenderMetrics lastMetrics;

public:
    RayTracer(int w, int h) : width(w), height(h) {
        rgbaBuffer.resize(static_cast<size_t>(width) * static_cast<size_t>(height) * 4);
    }

    void renderScene(float fov, Vec3f backg, int current_step, const std::vector<Sphere>& spheres, const std::vector<Light>& lights)
    {
        auto tStart = std::chrono::high_resolution_clock::now();

        RenderMetrics metrics;
        metrics.spp = 1;
        metrics.primaryRays = static_cast<uint32_t>(width * height);

        const float tanHalfFov = std::tan(fov * 0.5f);
        const float aspectRatio = static_cast<float>(width) / static_cast<float>(height);
        const float invWidth = 1.0f / static_cast<float>(width);
        const float invHeight = 1.0f / static_cast<float>(height);
        const Vec3f cameraOrig(0.f, 0.f, 0.f);

        for (int j = 0; j < height; j++) {
            const float y = -(2.f * (j + 0.5f) * invHeight - 1.f) * tanHalfFov;

            for (int i = 0; i < width; i++) {
                const float x = (2.f * (i + 0.5f) * invWidth - 1.f) * tanHalfFov * aspectRatio;

                Vec3f dir = Vec3f(x, y, -1.f).normalize();
                Vec3f pixelColor = cast_ray_step_dispatcher(cameraOrig, dir, backg, spheres, lights, 0, current_step, metrics);
                size_t rgbaIndex = static_cast<size_t>(i + j * width) * 4;

                rgbaBuffer[rgbaIndex]     = static_cast<unsigned char>(255.f * std::max(0.f, std::min(1.f, pixelColor[0])));
                rgbaBuffer[rgbaIndex + 1] = static_cast<unsigned char>(255.f * std::max(0.f, std::min(1.f, pixelColor[1])));
                rgbaBuffer[rgbaIndex + 2] = static_cast<unsigned char>(255.f * std::max(0.f, std::min(1.f, pixelColor[2])));
                rgbaBuffer[rgbaIndex + 3] = 255;
            }
        }

        auto tEnd = std::chrono::high_resolution_clock::now();
        metrics.renderTimeMs = std::chrono::duration<double, std::milli>(tEnd - tStart).count();
        metrics.totalRays = metrics.primaryRays + metrics.shadowRays + metrics.secondaryRays;
        lastMetrics = metrics;
    }

    uintptr_t getBufferPointer() {
        return reinterpret_cast<uintptr_t>(rgbaBuffer.data());
    }

    RenderMetrics getLastMetrics() const {
        return lastMetrics;
    }
};

EMSCRIPTEN_BINDINGS(raytracing_engine) {
    emscripten::register_vector<Sphere>("VectorSphere");
    emscripten::register_vector<Light>("VectorLight");

    emscripten::value_object<RenderMetrics>("RenderMetrics")
        .field("renderTimeMs", &RenderMetrics::renderTimeMs)
        .field("primaryRays", &RenderMetrics::primaryRays)
        .field("shadowRays", &RenderMetrics::shadowRays)
        .field("secondaryRays", &RenderMetrics::secondaryRays)
        .field("totalRays", &RenderMetrics::totalRays)
        .field("intersectionTests", &RenderMetrics::intersectionTests)
        .field("spp", &RenderMetrics::spp);

    emscripten::class_<Material>("Material")
        .constructor<>()
        .constructor<Vec3f>()
        .constructor<Vec4f, Vec3f, float>()
        .constructor<Vec4f, Vec3f, float, float>()
        .constructor<Vec4f, Vec3f, float, float, Vec3f, float>()
        .property("diffuse_color", &Material::diffuse_color)
        .property("albedo", &Material::albedo)
        .property("specular_exponent", &Material::specular_exponent)
        .property("refractive_index", &Material::refractive_index)
        .property("emission", &Material::emission)
        .property("roughness", &Material::roughness);

    emscripten::class_<Sphere>("Sphere")
        .constructor<>()
        .constructor<Vec3f, float>()
        .constructor<Vec3f, float, Material>()
        .property("center", &Sphere::center)
        .property("radius", &Sphere::radius)
        .property("material", &Sphere::material);

    emscripten::class_<Light>("Light")
        .constructor<>()
        .constructor<Vec3f, float>()
        .constructor<Vec3f, float, float>()
        .constructor<Vec3f, float, float, Vec3f>()
        .property("position", &Light::stand)
        .property("intensity", &Light::depth)
        .property("radius", &Light::radius)
        .property("color", &Light::color);

    emscripten::class_<RayTracer>("RayTracer")
        .constructor<int, int>()
        .function("renderScene", &RayTracer::renderScene)
        .function("getBufferPointer", &RayTracer::getBufferPointer)
        .function("getLastMetrics", &RayTracer::getLastMetrics);

    emscripten::value_object<Vec3f>("Vec3f")
        .field("x", +[](const Vec3f& v) -> float { return v[0]; }, +[](Vec3f& v, float val) { v[0] = val; })
        .field("y", +[](const Vec3f& v) -> float { return v[1]; }, +[](Vec3f& v, float val) { v[1] = val; })
        .field("z", +[](const Vec3f& v) -> float { return v[2]; }, +[](Vec3f& v, float val) { v[2] = val; });

    emscripten::value_object<Vec4f>("Vec4f")
        .field("x", +[](const Vec4f& v) -> float { return v[0]; }, +[](Vec4f& v, float val) { v[0] = val; })
        .field("y", +[](const Vec4f& v) -> float { return v[1]; }, +[](Vec4f& v, float val) { v[1] = val; })
        .field("z", +[](const Vec4f& v) -> float { return v[2]; }, +[](Vec4f& v, float val) { v[2] = val; })
        .field("w", +[](const Vec4f& v) -> float { return v[3]; }, +[](Vec4f& v, float val) { v[3] = val; });
}