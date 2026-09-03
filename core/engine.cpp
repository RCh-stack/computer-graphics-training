#include <iostream>
#include <vector>
#include <cmath>
#include <algorithm>
#include <emscripten/bind.h>

#include "src/ray_math.h"

using namespace RayTracing;

class RayTracer {
private:
    int width;
    int height;
    std::vector<unsigned char> rgbaBuffer; 

public:
    RayTracer(int w, int h) : width(w), height(h) {
        rgbaBuffer.resize(width * height * 4);
    }

    void renderScene(float fov, Vec3f backg, int current_step, const std::vector<Sphere>& spheres, const std::vector<Light>& lights) 
    {
        for (size_t j = 0; j < height; j++) {
            for (size_t i = 0; i < width; i++) {     
                float x = (2 * (i + 0.5) / (float)width - 1) * tan(fov / 2.) * width / (float)height;
                float y = -(2 * (j + 0.5) / (float)height - 1) * tan(fov / 2.);
                
                Vec3f dir = Vec3f(x, y, -1).normalize();
                Vec3f pixelColor = cast_ray_step_dispatcher(Vec3f(0, 0, 0), dir, backg, spheres, lights, 0, current_step);
                size_t rgbaIndex = (i + j * width) * 4;

                rgbaBuffer[rgbaIndex]     = static_cast<unsigned char>(255 * std::max(0.f, std::min(1.f, pixelColor[0]))); // R
                rgbaBuffer[rgbaIndex + 1] = static_cast<unsigned char>(255 * std::max(0.f, std::min(1.f, pixelColor[1]))); // G
                rgbaBuffer[rgbaIndex + 2] = static_cast<unsigned char>(255 * std::max(0.f, std::min(1.f, pixelColor[2]))); // B
                rgbaBuffer[rgbaIndex + 3] = 255; 
            }
        }
    }

    uintptr_t getBufferPointer() {
        return reinterpret_cast<uintptr_t>(rgbaBuffer.data());
    }
};

EMSCRIPTEN_BINDINGS(raytracing_engine) {
    emscripten::register_vector<Sphere>("VectorSphere");
    emscripten::register_vector<Light>("VectorLight");

    emscripten::class_<Material>("Material")
        .constructor<Vec3f>()
        .constructor<Vec4f, Vec3f, float>()
        .constructor<Vec4f, Vec3f, float, float>()
        .property("diffuse_color", &Material::diffuse_color)
        .property("albedo", &Material::albedo)
        .property("specular_exponent", &Material::specular_exponent)
        .property("refractive_index", &Material::refractive_index);

    emscripten::class_<Sphere>("Sphere")
        .constructor<Vec3f, float>()
        .constructor<Vec3f, float, Material>()
        .property("center", &Sphere::center)
        .property("radius", &Sphere::radius)
        .property("material", &Sphere::material);

    emscripten::class_<Light>("Light")
        .constructor<Vec3f, float>()
        .property("position", &Light::stand)
        .property("intensity", &Light::depth);

    emscripten::class_<RayTracer>("RayTracer")
        .constructor<int, int>()
        .function("renderScene", &RayTracer::renderScene)
        .function("getBufferPointer", &RayTracer::getBufferPointer);

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