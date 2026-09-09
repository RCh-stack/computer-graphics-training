// src/widgets/widget-registry.js

window.WidgetRegistry = {
    widgets: {},

    // Метод регистрации нового виджета из внешнего JS-файла
    register(id, initFunction) {
        this.widgets[id] = initFunction;
    },

    // Метод монтирования виджета в указанный контейнер/canvas
    mount(id, containerElement, configData = {}) {
        if (!this.widgets[id]) {
            console.warn(`Виджет "${id}" не найден в реестре.`);
            return null;
        }
        // Запускаем инициализацию конкретного виджета
        return this.widgets[id](containerElement, configData);
    }
};