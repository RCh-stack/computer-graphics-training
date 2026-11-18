#ifndef RENDER_METRICS_H
#define RENDER_METRICS_H

#include <cstdint>

struct RenderMetrics
{
    double renderTimeMs = 0.0;
    uint32_t primaryRays = 0;
    uint32_t shadowRays = 0;
    uint32_t secondaryRays = 0;
    uint32_t totalRays = 0;
    double intersectionTests = 0.0;
    uint32_t spp = 1;
};

#endif // RENDER_METRICS_H