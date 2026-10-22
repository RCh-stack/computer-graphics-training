function resolveOptionText(rawVal, optionsJson) {
    if (rawVal === undefined || rawVal === null || rawVal === '') return '—';

    let data = optionsJson;

    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
        } catch (e) {
            data = null;
        }
    }

    if (!data) return rawVal;

    let optionsList = null;
    if (Array.isArray(data)) {
        optionsList = data;
    } else if (typeof data === 'object' && Array.isArray(data.options)) {
        optionsList = data.options;
    }

    if (optionsList) {
        const found = optionsList.find(o => 
            typeof o === 'object' && o !== null && 
            (String(o.id) === String(rawVal) || String(o.value) === String(rawVal) || String(o.key) === String(rawVal))
        );

        if (found) {
            return found.text !== undefined ? found.text : (found.label || found.value || rawVal);
        }

        const numIdx = Number(rawVal);
        if (!isNaN(numIdx) && optionsList[numIdx] !== undefined) {
            const item = optionsList[numIdx];
            return typeof item === 'object' ? (item.text || item.label || rawVal) : item;
        }

        if (optionsList.includes(rawVal)) return rawVal;
    } 
    else if (typeof data === 'object' && data[rawVal] !== undefined) {
        return data[rawVal];
    }

    return rawVal;
}

module.exports = { resolveOptionText };