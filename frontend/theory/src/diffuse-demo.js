// src/widgets/lambert-diffuse-demo.js

(function() {
    function initLambertWidget(container, config = {}) {
        if (!container) {
            console.error('Ошибка: Контейнер для виджета LAMBERT_DIFFUSE_2D не найден.');
            return;
        }

        // 1. Интерфейс виджета
        container.innerHTML = `
            <div class="w-full h-56 bg-black rounded-xl border border-[var(--border-color)] relative overflow-hidden flex items-center justify-center">
                <canvas id="lambert-canvas" width="280" height="220" class="w-full h-full"></canvas>
            </div>

            <div class="space-y-3 text-xs flex-1">
                <div class="space-y-1">
                    <div class="flex justify-between text-[var(--text-muted)]">
                        <label>Угол источника света (L):</label>
                        <span id="light-angle-val" class="font-mono text-indigo-400">${config.lightAngle || 45}°</span>
                    </div>
                    <input type="range" id="light-angle-slider" min="-85" max="85" value="${config.lightAngle || 45}" 
                           class="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500">
                </div>

                <div class="p-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] font-mono text-[10px] space-y-1">
                    <div>N · L (dot product): <span id="dot-val" class="text-indigo-300 font-bold">0.00</span></div>
                    <div>Интенсивность (I): <span id="intensity-val" class="text-amber-400 font-bold">0%</span></div>
                </div>
            </div>
        `;

        const canvas = container.querySelector('#lambert-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const lightSlider = container.querySelector('#light-angle-slider');
        const lightAngleVal = container.querySelector('#light-angle-val');
        const dotVal = container.querySelector('#dot-val');
        const intensityVal = container.querySelector('#intensity-val');

        // State виджета
        const state = {
            lightAngleDeg: parseFloat(lightSlider.value),
            hitPoint: { x: 140, y: 160 },
            normalLen: 60,
            lightLen: 70,
            surfaceRadius: 100
        };

        function render() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 1. Нормаль N (направлена строго вверх в точке касания)
            const N = { x: 0, y: -1 };

            // 2. Вектор света L (расчет по углу со слайдера)
            const angleRad = (state.lightAngleDeg - 90) * (Math.PI / 180);
            const L = { x: Math.cos(angleRad), y: Math.sin(angleRad) };

            // 3. Скалярное произведение N · L
            const dot = N.x * L.x + N.y * L.y;
            const intensity = Math.max(0, dot); // Law of Lambert

            // Обновление текстовых значений в UI
            if (dotVal) dotVal.innerText = dot.toFixed(2);
            if (intensityVal) intensityVal.innerText = Math.round(intensity * 100) + '%';

            // --- ОТРИСОВКА ---

            // Поверхность (дуга/полусфера)
            ctx.beginPath();
            ctx.arc(state.hitPoint.x, state.hitPoint.y + state.surfaceRadius, state.surfaceRadius, Math.PI, 0, false);
            // Цвет поверхности меняется динамически от интенсивности
            const colorVal = Math.round(49 + intensity * (220 - 49));
            ctx.fillStyle = `rgb(${Math.round(colorVal * 0.4)}, ${Math.round(colorVal * 0.4)}, ${colorVal})`;
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();

            // Вектор Normal (Зеленый)
            const nEnd = {
                x: state.hitPoint.x + N.x * state.normalLen,
                y: state.hitPoint.y + N.y * state.normalLen
            };
            drawVector(ctx, state.hitPoint, nEnd, '#10b981', 'N');

            // Вектор Light (Желтый)
            const lEnd = {
                x: state.hitPoint.x + L.x * state.lightLen,
                y: state.hitPoint.y + L.y * state.lightLen
            };
            drawVector(ctx, state.hitPoint, lEnd, '#f59e0b', 'L');

            // Точка касания
            ctx.beginPath();
            ctx.arc(state.hitPoint.x, state.hitPoint.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }

        // Вспомогательная функция для стрелок векторов
        function drawVector(context, from, to, color, label) {
            context.beginPath();
            context.moveTo(from.x, from.y);
            context.lineTo(to.x, to.y);
            context.strokeStyle = color;
            context.lineWidth = 2;
            context.stroke();

            // Подпись вектора
            context.fillStyle = color;
            context.font = 'bold 11px monospace';
            context.fillText(label, to.x + (to.x >= from.x ? 6 : -14), to.y - 4);
        }

        // Обработчик события
        lightSlider.addEventListener('input', (e) => {
            state.lightAngleDeg = parseFloat(e.target.value);
            if (lightAngleVal) lightAngleVal.innerText = state.lightAngleDeg + '°';
            render();
        });

        render();
    }

    if (window.WidgetRegistry) {
        window.WidgetRegistry.register('LAMBERT_DIFFUSE_2D', initLambertWidget);
    }
})();