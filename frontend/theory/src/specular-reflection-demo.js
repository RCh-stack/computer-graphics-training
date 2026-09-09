// src/widgets/specular-reflection-demo.js

(function() {
    function initSpecularWidget(container, config = {}) {
        if (!container) {
            console.error('Ошибка: Контейнер для виджета SPECULAR_REFLECTION_2D не найден.');
            return;
        }

        // 1. Шаблон интерфейса
        container.innerHTML = `
            <div class="w-full h-56 bg-black rounded-xl border border-[var(--border-color)] relative overflow-hidden flex items-center justify-center">
                <canvas id="specular-canvas" width="280" height="220" class="w-full h-full"></canvas>
            </div>

            <div class="space-y-3 text-xs flex-1">
                <div class="space-y-1">
                    <div class="flex justify-between text-[var(--text-muted)]">
                        <label>Угол источника света (L):</label>
                        <span id="light-angle-val" class="font-mono text-indigo-400">${config.lightAngle || -40}°</span>
                    </div>
                    <input type="range" id="light-angle-slider" min="-80" max="0" value="${config.lightAngle || -40}" 
                           class="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500">
                    
                    <div class="flex justify-between text-[var(--text-muted)]">
                        <label>Угол наблюдателя (V):</label>
                        <span id="view-angle-val" class="font-mono text-indigo-400">${config.viewAngle || 35}°</span>
                    </div>
                    <input type="range" id="view-angle-slider" min="0" max="80" value="${config.viewAngle || 35}" 
                           class="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500">
                </div>

                <div class="p-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] font-mono text-[10px] space-y-1">
                    <div>R · V (dot product): <span id="rv-dot-val" class="text-indigo-300 font-bold">0.00</span></div>
                    <div>Блик (Specular): <span id="spec-val" class="text-rose-400 font-bold">0%</span></div>
                </div>
            </div>
        `;

        const canvas = container.querySelector('#specular-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const lightSlider = container.querySelector('#light-angle-slider');
        const viewSlider = container.querySelector('#view-angle-slider');
        const lightAngleVal = container.querySelector('#light-angle-val');
        const viewAngleVal = container.querySelector('#view-angle-val');
        const rvDotVal = container.querySelector('#rv-dot-val');
        const specVal = container.querySelector('#spec-val');

        // State виджета
        const state = {
            lightAngleDeg: parseFloat(lightSlider.value),
            viewAngleDeg: parseFloat(viewSlider.value),
            hitPoint: { x: 140, y: 160 },
            vecLen: 65,
            shininess: 16 // Коэффициент блеска
        };

        function render() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 1. Нормаль N (направлена вверх)
            const N = { x: 0, y: -1 };

            // 2. Вектор падающего света L (из точки к источнику)
            const lRad = (state.lightAngleDeg - 90) * (Math.PI / 180);
            const L = { x: Math.cos(lRad), y: Math.sin(lRad) };

            // 3. Вектор отражения R = 2*(N·L)*N - L
            const dotNL = N.x * L.x + N.y * L.y;
            const R = {
                x: 2 * dotNL * N.x - L.x,
                y: 2 * dotNL * N.y - L.y
            };

            // 4. Вектор взгляда V (из точки к наблюдателю/камере)
            const vRad = (state.viewAngleDeg - 90) * (Math.PI / 180);
            const V = { x: Math.cos(vRad), y: Math.sin(vRad) };

            // 5. Скалярное произведение R · V и расчет зеркального блика (R · V)^n
            const dotRV = Math.max(0, R.x * V.x + R.y * V.y);
            const specular = Math.pow(dotRV, state.shininess);

            // Обновление UI элементов
            if (rvDotVal) rvDotVal.innerText = dotRV.toFixed(2);
            if (specVal) specVal.innerText = Math.round(specular * 100) + '%';

            // --- ОТРИСОВКА ---

            // Поверхность
            ctx.beginPath();
            ctx.arc(state.hitPoint.x, state.hitPoint.y + 100, 100, Math.PI, 0, false);
            ctx.fillStyle = '#1e1b4b';
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();

            // Вектор Normal (Зеленый)
            drawVector(ctx, state.hitPoint, { x: state.hitPoint.x + N.x * state.vecLen, y: state.hitPoint.y + N.y * state.vecLen }, '#10b981', 'N');

            // Вектор Light (Желтый)
            drawVector(ctx, state.hitPoint, { x: state.hitPoint.x + L.x * state.vecLen, y: state.hitPoint.y + L.y * state.vecLen }, '#f59e0b', 'L');

            // Вектор Reflection (Розовый/Красный)
            drawVector(ctx, state.hitPoint, { x: state.hitPoint.x + R.x * state.vecLen, y: state.hitPoint.y + R.y * state.vecLen }, '#f43f5e', 'R');

            // Вектор View (Голубой)
            drawVector(ctx, state.hitPoint, { x: state.hitPoint.x + V.x * state.vecLen, y: state.hitPoint.y + V.y * state.vecLen }, '#38bdf8', 'V');

            // Визуализация блика в точке пересечения
            ctx.beginPath();
            ctx.arc(state.hitPoint.x, state.hitPoint.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.2, specular)})`;
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = specular * 15;
            ctx.fill();
            ctx.shadowBlur = 0; // Сброс тени
        }

        function drawVector(context, from, to, color, label) {
            context.beginPath();
            context.moveTo(from.x, from.y);
            context.lineTo(to.x, to.y);
            context.strokeStyle = color;
            context.lineWidth = 2;
            context.stroke();

            context.fillStyle = color;
            context.font = 'bold 11px monospace';
            context.fillText(label, to.x + (to.x >= from.x ? 6 : -12), to.y - 4);
        }

        // Обработчики событий
        lightSlider.addEventListener('input', (e) => {
            state.lightAngleDeg = parseFloat(e.target.value);
            if (lightAngleVal) lightAngleVal.innerText = state.lightAngleDeg + '°';
            render();
        });

        viewSlider.addEventListener('input', (e) => {
            state.viewAngleDeg = parseFloat(e.target.value);
            if (viewAngleVal) viewAngleVal.innerText = state.viewAngleDeg + '°';
            render();
        });

        render();
    }

    if (window.WidgetRegistry) {
        window.WidgetRegistry.register('SPECULAR_REFLECTION_2D', initSpecularWidget);
    }
})();