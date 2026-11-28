#include <iostream>
#include <vector>
#include <cstdint>
#include <cmath>
#include <algorithm>
#include <chrono>
#include <emscripten/bind.h>
#include <emscripten/val.h>

#include "src/ray_math.h"
#include "src/path_math.h"
#include "src/dist_math.h"
#include "src/mesh.h"
#include "src/render_metrics.h"
#include "src/texture.h"

using namespace RayTracing;
using namespace PathTracing;
using namespace DistributionRayTracing;

class RayTracer {
private:
    int width;
    int height;
    std::vector<unsigned char> rgbaBuffer;
    RenderMetrics lastMetrics;
    EnvironmentMap envMap;
    std::vector<TextureBuffer> sceneTextures;

public:
    RayTracer(int w, int h) : width(w), height(h) {
        rgbaBuffer.resize(static_cast<size_t>(width) * static_cast<size_t>(height) * 4);
    }

    void setEnvironmentMap(int w, int h, emscripten::val rgbaUint8) {
        if (w <= 0 || h <= 0) return;
        std::vector<uint8_t> pixels = emscripten::vecFromJSArray<uint8_t>(rgbaUint8);
        if (pixels.size() < static_cast<size_t>(w) * static_cast<size_t>(h) * 4) return;
        envMap.texture.setPixels(w, h, std::move(pixels));
        envMap.enabled = true;
    }

    void setEnvironmentParams(bool enabled, float intensity, float rotationDeg) {
        envMap.enabled = enabled && envMap.texture.isValid();
        envMap.intensity = std::max(0.0f, intensity);
        envMap.rotationRad = rotationDeg * (3.14159265359f / 180.0f);
    }

    void clearEnvironmentMap() {
        envMap.enabled = false;
        envMap.texture.clear();
    }

    void uploadTexture(int slotId, int w, int h, emscripten::val rgbaUint8) {
        if (slotId < 0 || slotId > 64 || w <= 0 || h <= 0) return;
        std::vector<uint8_t> pixels = emscripten::vecFromJSArray<uint8_t>(rgbaUint8);
        if (pixels.size() < static_cast<size_t>(w) * static_cast<size_t>(h) * 4) return;
        if (static_cast<size_t>(slotId) >= sceneTextures.size()) {
            sceneTextures.resize(static_cast<size_t>(slotId) + 1);
        }
        sceneTextures[static_cast<size_t>(slotId)].setPixels(w, h, std::move(pixels));
    }

    void renderScene(float fov, Vec3f backg, int current_step, const std::vector<Sphere>& spheres, const std::vector<Light>& lights)
    {
        static const std::vector<Mesh> emptyMeshes;
        renderSceneWithMeshes(fov, backg, current_step, spheres, emptyMeshes, lights);
    }

    void renderSceneWithMeshes(
        float fov,
        Vec3f backg,
        int current_step,
        const std::vector<Sphere>& spheres,
        const std::vector<Mesh>& meshes,
        const std::vector<Light>& lights)
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
                Vec3f pixelColor = cast_ray_step_dispatcher(
                    cameraOrig, dir, backg, spheres, meshes, lights, 0, current_step, metrics, envMap, sceneTextures
                );
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

class PathTracer {
private:
    int width;
    int height;
    uint32_t baseSeed;
    uint32_t accumulatedSamples;
    std::vector<Vec3f> accumBuffer;
    std::vector<unsigned char> rgbaBuffer;
    RenderMetrics accumulatedMetrics;
    EnvironmentMap envMap;
    std::vector<TextureBuffer> sceneTextures;

    static inline unsigned char linearToSrgbByte(float linearVal) {
        float clamped = std::max(0.0f, linearVal);
        if (clamped > 1.0f) {
            clamped = 1.0f - std::exp(-clamped);
        }
        float srgb = std::pow(std::min(1.0f, clamped), 1.0f / 2.2f);
        return static_cast<unsigned char>(255.0f * srgb + 0.5f);
    }

public:
    PathTracer(int w, int h)
        : width(w), height(h), baseSeed(42u), accumulatedSamples(0u)
    {
        const size_t pixelCount = static_cast<size_t>(width) * static_cast<size_t>(height);
        accumBuffer.assign(pixelCount, Vec3f(0.f, 0.f, 0.f));
        rgbaBuffer.resize(pixelCount * 4, 0);
    }

    void setEnvironmentMap(int w, int h, emscripten::val rgbaUint8) {
        if (w <= 0 || h <= 0) return;
        std::vector<uint8_t> pixels = emscripten::vecFromJSArray<uint8_t>(rgbaUint8);
        if (pixels.size() < static_cast<size_t>(w) * static_cast<size_t>(h) * 4) return;
        envMap.texture.setPixels(w, h, std::move(pixels));
        envMap.enabled = true;
    }

    void setEnvironmentParams(bool enabled, float intensity, float rotationDeg) {
        envMap.enabled = enabled && envMap.texture.isValid();
        envMap.intensity = std::max(0.0f, intensity);
        envMap.rotationRad = rotationDeg * (3.14159265359f / 180.0f);
    }

    void clearEnvironmentMap() {
        envMap.enabled = false;
        envMap.texture.clear();
    }

    void uploadTexture(int slotId, int w, int h, emscripten::val rgbaUint8) {
        if (slotId < 0 || slotId > 64 || w <= 0 || h <= 0) return;
        std::vector<uint8_t> pixels = emscripten::vecFromJSArray<uint8_t>(rgbaUint8);
        if (pixels.size() < static_cast<size_t>(w) * static_cast<size_t>(h) * 4) return;
        if (static_cast<size_t>(slotId) >= sceneTextures.size()) {
            sceneTextures.resize(static_cast<size_t>(slotId) + 1);
        }
        sceneTextures[static_cast<size_t>(slotId)].setPixels(w, h, std::move(pixels));
    }

    void reset() {
        std::fill(accumBuffer.begin(), accumBuffer.end(), Vec3f(0.f, 0.f, 0.f));
        accumulatedSamples = 0u;
        accumulatedMetrics = RenderMetrics{};
    }

    void setSeed(uint32_t seed) {
        baseSeed = seed ? seed : 1u;
    }

    uint32_t getAccumulatedSamples() const {
        return accumulatedSamples;
    }

    void renderPass(
        int samplesPerPass,
        float fov,
        Vec3f backg,
        int current_step,
        const std::vector<Sphere>& spheres,
        const std::vector<Light>& lights)
    {
        static const std::vector<Mesh> emptyMeshes;
        renderPassWithMeshes(samplesPerPass, fov, backg, current_step, spheres, emptyMeshes, lights);
    }

    void renderPassWithMeshes(
        int samplesPerPass,
        float fov,
        Vec3f backg,
        int current_step,
        const std::vector<Sphere>& spheres,
        const std::vector<Mesh>& meshes,
        const std::vector<Light>& lights)
    {
        if (samplesPerPass <= 0) return;

        auto tStart = std::chrono::high_resolution_clock::now();

        RenderMetrics passMetrics;
        const uint32_t passSpp = static_cast<uint32_t>(samplesPerPass);
        passMetrics.spp = passSpp;
        passMetrics.primaryRays = static_cast<uint32_t>(width * height) * passSpp;

        const float tanHalfFov = std::tan(fov * 0.5f);
        const float aspectRatio = static_cast<float>(width) / static_cast<float>(height);
        const float invWidth = 1.0f / static_cast<float>(width);
        const float invHeight = 1.0f / static_cast<float>(height);
        const Vec3f cameraOrig(0.f, 0.f, 0.f);

        const uint32_t startSample = accumulatedSamples;
        const uint32_t nextTotalSamples = accumulatedSamples + passSpp;
        const float invTotalSamples = 1.0f / static_cast<float>(nextTotalSamples);

        for (int j = 0; j < height; j++) {
            for (int i = 0; i < width; i++) {
                const uint32_t pixelIdx = static_cast<uint32_t>(i + j * width);
                Vec3f sumColor = accumBuffer[pixelIdx];

                for (uint32_t s = 0; s < passSpp; s++) {
                    const uint32_t globalSampleIdx = startSample + s;
                    RngState rng(hash_seed(pixelIdx, globalSampleIdx, baseSeed));

                    const float jx = (globalSampleIdx == 0) ? 0.5f : rng.nextFloat();
                    const float jy = (globalSampleIdx == 0) ? 0.5f : rng.nextFloat();

                    const float x = (2.f * (i + jx) * invWidth - 1.f) * tanHalfFov * aspectRatio;
                    const float y = -(2.f * (j + jy) * invHeight - 1.f) * tanHalfFov;

                    Vec3f dir = Vec3f(x, y, -1.f).normalize();
                    Vec3f sampleColor = trace_path_step_dispatcher(
                        cameraOrig, dir, backg, spheres, meshes, lights, current_step, rng, passMetrics, envMap, sceneTextures
                    );

                    sumColor = sumColor + sampleColor;
                }

                accumBuffer[pixelIdx] = sumColor;

                const Vec3f avgLinear = sumColor * invTotalSamples;
                const size_t rgbaIndex = static_cast<size_t>(pixelIdx) * 4;
                rgbaBuffer[rgbaIndex]     = linearToSrgbByte(avgLinear.x);
                rgbaBuffer[rgbaIndex + 1] = linearToSrgbByte(avgLinear.y);
                rgbaBuffer[rgbaIndex + 2] = linearToSrgbByte(avgLinear.z);
                rgbaBuffer[rgbaIndex + 3] = 255;
            }
        }

        auto tEnd = std::chrono::high_resolution_clock::now();
        const double elapsedMs = std::chrono::duration<double, std::milli>(tEnd - tStart).count();

        accumulatedSamples = nextTotalSamples;
        accumulatedMetrics.spp = accumulatedSamples;
        accumulatedMetrics.renderTimeMs += elapsedMs;
        accumulatedMetrics.primaryRays += passMetrics.primaryRays;
        accumulatedMetrics.shadowRays += passMetrics.shadowRays;
        accumulatedMetrics.secondaryRays += passMetrics.secondaryRays;
        accumulatedMetrics.intersectionTests += passMetrics.intersectionTests;
        accumulatedMetrics.aabbTests += passMetrics.aabbTests;
        accumulatedMetrics.triangleTests += passMetrics.triangleTests;
        accumulatedMetrics.envLookups += passMetrics.envLookups;
        accumulatedMetrics.totalRays =
            accumulatedMetrics.primaryRays +
            accumulatedMetrics.shadowRays +
            accumulatedMetrics.secondaryRays;
    }

    uintptr_t getBufferPointer() {
        return reinterpret_cast<uintptr_t>(rgbaBuffer.data());
    }

    RenderMetrics getLastMetrics() const {
        return accumulatedMetrics;
    }
};

class DistributionRayTracer {
private:
    int width;
    int height;
    uint32_t baseSeed;
    uint32_t accumulatedSamples;
    float lensAperture;
    float focalDistance;
    std::vector<Vec3f> accumBuffer;
    std::vector<unsigned char> rgbaBuffer;
    RenderMetrics accumulatedMetrics;
    EnvironmentMap envMap;
    std::vector<TextureBuffer> sceneTextures;

    static inline unsigned char linearToSrgbByte(float linearVal) {
        float clamped = std::max(0.0f, linearVal);
        if (clamped > 1.0f) {
            clamped = 1.0f - std::exp(-clamped);
        }
        float srgb = std::pow(std::min(1.0f, clamped), 1.0f / 2.2f);
        return static_cast<unsigned char>(255.0f * srgb + 0.5f);
    }

public:
    DistributionRayTracer(int w, int h)
        : width(w), height(h), baseSeed(42u), accumulatedSamples(0u),
          lensAperture(0.18f), focalDistance(10.0f)
    {
        const size_t pixelCount = static_cast<size_t>(width) * static_cast<size_t>(height);
        accumBuffer.assign(pixelCount, Vec3f(0.f, 0.f, 0.f));
        rgbaBuffer.resize(pixelCount * 4, 0);
    }

    void setEnvironmentMap(int w, int h, emscripten::val rgbaUint8) {
        if (w <= 0 || h <= 0) return;
        std::vector<uint8_t> pixels = emscripten::vecFromJSArray<uint8_t>(rgbaUint8);
        if (pixels.size() < static_cast<size_t>(w) * static_cast<size_t>(h) * 4) return;
        envMap.texture.setPixels(w, h, std::move(pixels));
        envMap.enabled = true;
    }

    void setEnvironmentParams(bool enabled, float intensity, float rotationDeg) {
        envMap.enabled = enabled && envMap.texture.isValid();
        envMap.intensity = std::max(0.0f, intensity);
        envMap.rotationRad = rotationDeg * (3.14159265359f / 180.0f);
    }

    void clearEnvironmentMap() {
        envMap.enabled = false;
        envMap.texture.clear();
    }

    void uploadTexture(int slotId, int w, int h, emscripten::val rgbaUint8) {
        if (slotId < 0 || slotId > 64 || w <= 0 || h <= 0) return;
        std::vector<uint8_t> pixels = emscripten::vecFromJSArray<uint8_t>(rgbaUint8);
        if (pixels.size() < static_cast<size_t>(w) * static_cast<size_t>(h) * 4) return;
        if (static_cast<size_t>(slotId) >= sceneTextures.size()) {
            sceneTextures.resize(static_cast<size_t>(slotId) + 1);
        }
        sceneTextures[static_cast<size_t>(slotId)].setPixels(w, h, std::move(pixels));
    }

    void setCameraLens(float aperture, float focusDist) {
        lensAperture = std::max(0.0f, aperture);
        focalDistance = std::max(0.5f, focusDist);
    }

    void reset() {
        std::fill(accumBuffer.begin(), accumBuffer.end(), Vec3f(0.f, 0.f, 0.f));
        accumulatedSamples = 0u;
        accumulatedMetrics = RenderMetrics{};
    }

    void setSeed(uint32_t seed) {
        baseSeed = seed ? seed : 1u;
    }

    uint32_t getAccumulatedSamples() const {
        return accumulatedSamples;
    }

    void renderPass(
        int samplesPerPass,
        float fov,
        Vec3f backg,
        int current_step,
        const std::vector<Sphere>& spheres,
        const std::vector<Light>& lights)
    {
        static const std::vector<Mesh> emptyMeshes;
        renderPassWithMeshes(samplesPerPass, fov, backg, current_step, spheres, emptyMeshes, lights);
    }

    void renderPassWithMeshes(
        int samplesPerPass,
        float fov,
        Vec3f backg,
        int current_step,
        const std::vector<Sphere>& spheres,
        const std::vector<Mesh>& meshes,
        const std::vector<Light>& lights)
    {
        if (samplesPerPass <= 0) return;

        auto tStart = std::chrono::high_resolution_clock::now();

        RenderMetrics passMetrics;
        const uint32_t passSpp = static_cast<uint32_t>(samplesPerPass);
        passMetrics.spp = passSpp;
        passMetrics.primaryRays = static_cast<uint32_t>(width * height) * passSpp;

        const float tanHalfFov = std::tan(fov * 0.5f);
        const float aspectRatio = static_cast<float>(width) / static_cast<float>(height);
        const float invWidth = 1.0f / static_cast<float>(width);
        const float invHeight = 1.0f / static_cast<float>(height);
        const bool enableDof = (static_cast<DistributionTraceStep>(current_step) >= DistributionTraceStep::DEPTH_OF_FIELD)
                               && (lensAperture > 1e-5f);

        const uint32_t startSample = accumulatedSamples;
        const uint32_t nextTotalSamples = accumulatedSamples + passSpp;
        const float invTotalSamples = 1.0f / static_cast<float>(nextTotalSamples);

        for (int j = 0; j < height; j++) {
            for (int i = 0; i < width; i++) {
                const uint32_t pixelIdx = static_cast<uint32_t>(i + j * width);
                Vec3f sumColor = accumBuffer[pixelIdx];

                for (uint32_t s = 0; s < passSpp; s++) {
                    const uint32_t globalSampleIdx = startSample + s;
                    DistRng rng(hash_pixel_seed(pixelIdx, globalSampleIdx, baseSeed));

                    const float jx = (globalSampleIdx == 0) ? 0.5f : rng.nextFloat();
                    const float jy = (globalSampleIdx == 0) ? 0.5f : rng.nextFloat();

                    const float x = (2.f * (i + jx) * invWidth - 1.f) * tanHalfFov * aspectRatio;
                    const float y = -(2.f * (j + jy) * invHeight - 1.f) * tanHalfFov;

                    Vec3f rayOrig(0.f, 0.f, 0.f);
                    Vec3f rayDir = Vec3f(x, y, -1.f).normalize();

                    if (enableDof && globalSampleIdx > 0) {
                        float diskX = 0.f, diskY = 0.f;
                        sample_concentric_disk(rng, diskX, diskY);
                        rayOrig = Vec3f(diskX * lensAperture, diskY * lensAperture, 0.f);

                        const float tFocus = focalDistance / std::max(1e-4f, -rayDir.z);
                        const Vec3f focalPoint = rayDir * tFocus;
                        rayDir = (focalPoint - rayOrig).normalize();
                    }

                    Vec3f sampleColor = trace_distribution_ray(
                        rayOrig, rayDir, backg, spheres, meshes, lights,
                        0, current_step, rng, passMetrics, envMap, sceneTextures
                    );

                    sumColor = sumColor + sampleColor;
                }

                accumBuffer[pixelIdx] = sumColor;

                const Vec3f avgLinear = sumColor * invTotalSamples;
                const size_t rgbaIndex = static_cast<size_t>(pixelIdx) * 4;
                rgbaBuffer[rgbaIndex]     = linearToSrgbByte(avgLinear.x);
                rgbaBuffer[rgbaIndex + 1] = linearToSrgbByte(avgLinear.y);
                rgbaBuffer[rgbaIndex + 2] = linearToSrgbByte(avgLinear.z);
                rgbaBuffer[rgbaIndex + 3] = 255;
            }
        }

        auto tEnd = std::chrono::high_resolution_clock::now();
        const double elapsedMs = std::chrono::duration<double, std::milli>(tEnd - tStart).count();

        accumulatedSamples = nextTotalSamples;
        accumulatedMetrics.spp = accumulatedSamples;
        accumulatedMetrics.renderTimeMs += elapsedMs;
        accumulatedMetrics.primaryRays += passMetrics.primaryRays;
        accumulatedMetrics.shadowRays += passMetrics.shadowRays;
        accumulatedMetrics.secondaryRays += passMetrics.secondaryRays;
        accumulatedMetrics.intersectionTests += passMetrics.intersectionTests;
        accumulatedMetrics.aabbTests += passMetrics.aabbTests;
        accumulatedMetrics.triangleTests += passMetrics.triangleTests;
        accumulatedMetrics.envLookups += passMetrics.envLookups;
        accumulatedMetrics.totalRays =
            accumulatedMetrics.primaryRays +
            accumulatedMetrics.shadowRays +
            accumulatedMetrics.secondaryRays;
    }

    uintptr_t getBufferPointer() {
        return reinterpret_cast<uintptr_t>(rgbaBuffer.data());
    }

    RenderMetrics getLastMetrics() const {
        return accumulatedMetrics;
    }
};

EMSCRIPTEN_BINDINGS(raytracing_engine) {
    emscripten::register_vector<float>("VectorFloat");
    emscripten::register_vector<int>("VectorInt");
    emscripten::register_vector<Sphere>("VectorSphere");
    emscripten::register_vector<Mesh>("VectorMesh");
    emscripten::register_vector<Light>("VectorLight");

    emscripten::value_object<RenderMetrics>("RenderMetrics")
        .field("renderTimeMs", &RenderMetrics::renderTimeMs)
        .field("primaryRays", &RenderMetrics::primaryRays)
        .field("shadowRays", &RenderMetrics::shadowRays)
        .field("secondaryRays", &RenderMetrics::secondaryRays)
        .field("totalRays", &RenderMetrics::totalRays)
        .field("intersectionTests", &RenderMetrics::intersectionTests)
        .field("aabbTests", &RenderMetrics::aabbTests)
        .field("triangleTests", &RenderMetrics::triangleTests)
        .field("envLookups", &RenderMetrics::envLookups)
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
        .property("roughness", &Material::roughness)
        .property("texture_type", &Material::texture_type)
        .property("secondary_color", &Material::secondary_color)
        .property("tex_scale", &Material::tex_scale)
        .property("texture_id", &Material::texture_id);

    emscripten::class_<Sphere>("Sphere")
        .constructor<>()
        .constructor<Vec3f, float>()
        .constructor<Vec3f, float, Material>()
        .property("center", &Sphere::center)
        .property("radius", &Sphere::radius)
        .property("material", &Sphere::material);

    emscripten::class_<Mesh>("Mesh")
        .constructor<>()
        .constructor<Material>()
        .function("setGeometry", &Mesh::setGeometry)
        .function("setTransform", &Mesh::setTransform)
        .function("triangleCount", &Mesh::triangleCount)
        .function("bvhNodeCount", &Mesh::bvhNodeCount)
        .property("material", &Mesh::material)
        .property("smoothShading", &Mesh::smoothShading)
        .property("position", &Mesh::position)
        .property("rotation", &Mesh::rotation)
        .property("scale", &Mesh::scale)
        .property("useBVH", &Mesh::useBVH);

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
        .function("setEnvironmentMap", &RayTracer::setEnvironmentMap)
        .function("setEnvironmentParams", &RayTracer::setEnvironmentParams)
        .function("clearEnvironmentMap", &RayTracer::clearEnvironmentMap)
        .function("uploadTexture", &RayTracer::uploadTexture)
        .function("renderScene", &RayTracer::renderScene)
        .function("renderSceneWithMeshes", &RayTracer::renderSceneWithMeshes)
        .function("getBufferPointer", &RayTracer::getBufferPointer)
        .function("getLastMetrics", &RayTracer::getLastMetrics);

    emscripten::class_<PathTracer>("PathTracer")
        .constructor<int, int>()
        .function("setEnvironmentMap", &PathTracer::setEnvironmentMap)
        .function("setEnvironmentParams", &PathTracer::setEnvironmentParams)
        .function("clearEnvironmentMap", &PathTracer::clearEnvironmentMap)
        .function("uploadTexture", &PathTracer::uploadTexture)
        .function("reset", &PathTracer::reset)
        .function("setSeed", &PathTracer::setSeed)
        .function("getAccumulatedSamples", &PathTracer::getAccumulatedSamples)
        .function("renderPass", &PathTracer::renderPass)
        .function("renderPassWithMeshes", &PathTracer::renderPassWithMeshes)
        .function("getBufferPointer", &PathTracer::getBufferPointer)
        .function("getLastMetrics", &PathTracer::getLastMetrics);

    emscripten::class_<DistributionRayTracer>("DistributionRayTracer")
        .constructor<int, int>()
        .function("setEnvironmentMap", &DistributionRayTracer::setEnvironmentMap)
        .function("setEnvironmentParams", &DistributionRayTracer::setEnvironmentParams)
        .function("clearEnvironmentMap", &DistributionRayTracer::clearEnvironmentMap)
        .function("uploadTexture", &DistributionRayTracer::uploadTexture)
        .function("setCameraLens", &DistributionRayTracer::setCameraLens)
        .function("reset", &DistributionRayTracer::reset)
        .function("setSeed", &DistributionRayTracer::setSeed)
        .function("getAccumulatedSamples", &DistributionRayTracer::getAccumulatedSamples)
        .function("renderPass", &DistributionRayTracer::renderPass)
        .function("renderPassWithMeshes", &DistributionRayTracer::renderPassWithMeshes)
        .function("getBufferPointer", &DistributionRayTracer::getBufferPointer)
        .function("getLastMetrics", &DistributionRayTracer::getLastMetrics);

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