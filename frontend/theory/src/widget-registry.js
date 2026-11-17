window.WidgetRegistry = {
    widgets: {},

    register(id, initFunction) {
        this.widgets[id] = initFunction;
    },

    mount(id, containerElement, configData = {}) {
        if (!this.widgets[id]) {
            console.warn(`Виджет "${id}" не найден в реестре.`);
            return null;
        }

        return this.widgets[id](containerElement, configData);
    }
};