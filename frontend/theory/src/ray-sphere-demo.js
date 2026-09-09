(function() {
    // Указываем config = {} по умолчанию для защиты от undefined
    function initRaySphereWidget(container, config = {}) {
        if (!container) {
            console.error('ошибка: Контейнер для виджета RAY_SPHERE_2D не найден в DOM.');
            return;
        }

        // 1. Создаем интерфейс виджета
        container.innerHTML = `
            <div class="w-full h-56 bg-black rounded-xl border border-[var(--border-color)] relative overflow-hidden flex items-center justify-center">
                <canvas id="mini-demo-canvas" width="280" height="220" class="w-full h-full"></canvas>
            </div>

            <div class="space-y-3 text-xs flex-1">
                <div class="space-y-1">
                    <div class="flex justify-between text-[var(--text-muted)]">
                        <label>Параметр t (Длина):</label>
                        <span id="t-val" class="font-mono text-indigo-400">${config.t || 120}</span>
                    </div>
                    <input type="range" id="t-slider" min="10" max="200" value="${config.t || 120}" 
                            class="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500">
                    <div class="flex justify-between text-[var(--text-muted)]">
                        <label>Угол вектора D:</label>
                        <span id="angle-val" class="font-mono text-indigo-400">${config.angle || 0}°</span>
                    </div>
                    <input type="range" id="angle-slider" min="-45" max="45" value="${config.angle || 0}" 
                            class="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500">
                </div>

                <div class="p-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] font-mono text-[10px] space-y-1">
                    <div>Hit status: <span id="hit-status" class="text-emerald-400 font-bold">--</span></div>
                </div>
            </div>
        `;

        // 2. Инициализируем переменные ПОСЛЕ создания innerHTML
        const canvas = container.querySelector('#mini-demo-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const tSlider = container.querySelector('#t-slider');
        const tVal = container.querySelector('#t-val');
        const angleVal = container.querySelector('#angle-val');
        const angleSlider = container.querySelector("#angle-slider");

        // Локальное состояние виджета (State)
        const state = {
            t: parseInt(tSlider.value),
            angle: parseFloat(angleSlider.value) * (Math.PI / 180),
            origin: config.origin || { x: 30, y: 110 },
            sphere: config.sphere || { x: 180, y: 110, r: 35 }
        };

        function render() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const dir = { x: Math.cos(state.angle), y: Math.sin(state.angle) };
            const endP = { x: state.origin.x + dir.x * state.t, y: state.origin.y + dir.y * state.t };

            const dist = Math.hypot(endP.x - state.sphere.x, endP.y - state.sphere.y);
            const hitStatus = document.getElementById('hit-status');

            if (dist <= state.sphere.r) {
                hitStatus.innerText = 'Пересечение!';
                hitStatus.className = 'text-emerald-400 font-bold';
            } else {
                hitStatus.innerText = 'Нет касания';
                hitStatus.className = 'text-gray-500';
            }

            // Отрисовка сферы
            ctx.beginPath();
            ctx.arc(state.sphere.x, state.sphere.y, state.sphere.r, 0, Math.PI * 2);
            ctx.fillStyle = '#312e81';
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fill();

            // Отрисовка луча
            ctx.beginPath();
            ctx.moveTo(state.origin.x, state.origin.y);
            ctx.lineTo(endP.x, endP.y);
            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Точка Origin
            ctx.beginPath();
            ctx.arc(state.origin.x, state.origin.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#38bdf8';
            ctx.fill();

            // Точка P(t)
            ctx.beginPath();
            ctx.arc(endP.x, endP.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#f43f5e';
            ctx.fill();
        }

        // Обработчик изменения слайдера
        tSlider.addEventListener('input', (e) => {
            state.t = parseInt(e.target.value);
            if (tVal) tVal.innerText = state.t; // Обновляем индикатор
            render();
        });

        angleSlider.addEventListener('input', (e) => {
            const deg = parseFloat(e.target.value);    
            state.angle = deg * (Math.PI / 180);
    
            if (angleVal) angleVal.innerText = deg + '°';   
            render();
        });

        render(); // Первый рендер
    }

    // Регистрируем виджет в глобальном реестре
    if (window.WidgetRegistry) {
        window.WidgetRegistry.register('RAY_SPHERE_2D', initRaySphereWidget);
    }
})();