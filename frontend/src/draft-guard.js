(function (global) {
    const STORAGE_PREFIX = 'cg_draft_v1_';

    function stableSerialize(value) {
        if (value === null || typeof value !== 'object') {
            return JSON.stringify(value);
        }
        if (Array.isArray(value)) {
            return '[' + value.map(stableSerialize).join(',') + ']';
        }
        const keys = Object.keys(value).sort();
        return '{' + keys.map(k => JSON.stringify(k) + ':' + stableSerialize(value[k])).join(',') + '}';
    }

    class DraftGuardController {
        constructor(options = {}) {
            this.debounceMs = options.debounceMs ?? 500;
            this.onSave = typeof options.onSave === 'function' ? options.onSave : null;
            this.interceptLinks = options.interceptLinks !== false;
            this.confirmTitle = options.confirmTitle || 'Есть несохранённые изменения';
            this.confirmText = options.confirmText || 'Если уйти со страницы сейчас, несохранённые правки останутся только в локальном черновике.';

            this.baselines = new Map();
            this.dirtyKeys = new Set();
            this.timers = new Map();
            this.isNavigating = false;

            this._handleBeforeUnload = this._handleBeforeUnload.bind(this);
            this._handleLinkClick = this._handleLinkClick.bind(this);

            window.addEventListener('beforeunload', this._handleBeforeUnload);
            if (this.interceptLinks) {
                document.addEventListener('click', this._handleLinkClick, true);
            }
        }

        _storageKey(key) {
            return `${STORAGE_PREFIX}${key}`;
        }

        setBaseline(key, data) {
            this.baselines.set(key, stableSerialize(data));
            this.dirtyKeys.delete(key);
        }

        markClean(key, newBaselineData = undefined) {
            const timer = this.timers.get(key);
            if (timer) {
                clearTimeout(timer);
                this.timers.delete(key);
            }

            if (newBaselineData !== undefined) {
                this.baselines.set(key, stableSerialize(newBaselineData));
            }
            this.dirtyKeys.delete(key);
            this.clear(key);
        }

        isDirty(key = null) {
            if (key) return this.dirtyKeys.has(key);
            return this.dirtyKeys.size > 0;
        }

        watch(key, data, meta = {}) {
            const serialized = stableSerialize(data);
            const baseline = this.baselines.get(key);

            if (baseline !== undefined && serialized === baseline) {
                const timer = this.timers.get(key);
                if (timer) {
                    clearTimeout(timer);
                    this.timers.delete(key);
                }
                this.dirtyKeys.delete(key);
                this.clear(key);
                return false;
            }

            this.dirtyKeys.add(key);

            const prevTimer = this.timers.get(key);
            if (prevTimer) clearTimeout(prevTimer);

            const timer = setTimeout(() => {
                this.timers.delete(key);
                this.saveNow(key, data, meta);
            }, this.debounceMs);

            this.timers.set(key, timer);
            return true;
        }

        saveNow(key, data, meta = {}) {
            try {
                const payload = {
                    data,
                    meta,
                    savedAt: Date.now()
                };
                localStorage.setItem(this._storageKey(key), JSON.stringify(payload));
            } catch (err) {
                console.warn('DraftGuard: не удалось записать черновик в localStorage:', err);
            }
        }

        load(key) {
            try {
                const raw = localStorage.getItem(this._storageKey(key));
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) return null;
                return parsed;
            } catch {
                return null;
            }
        }

        hasDiffFromBaseline(key, serverData) {
            const draft = this.load(key);
            if (!draft) return false;
            return stableSerialize(draft.data) !== stableSerialize(serverData);
        }

        clear(key) {
            try {
                localStorage.removeItem(this._storageKey(key));
            } catch {
            }
        }

        async confirmDiscard(customOptions = {}) {
            if (!this.isDirty() || this.isNavigating) return true;

            const title = customOptions.title || this.confirmTitle;
            const text = customOptions.text || this.confirmText;
            const saveHandler = customOptions.onSave || this.onSave;

            if (typeof window.Swal === 'undefined') {
                return window.confirm(`${title}\n\n${text}`);
            }

            if (saveHandler) {
                const result = await window.Swal.fire({
                    title,
                    text,
                    icon: 'warning',
                    showCancelButton: true,
                    showDenyButton: true,
                    confirmButtonText: 'Сохранить и перейти',
                    denyButtonText: 'Выйти без сохранения',
                    cancelButtonText: 'Остаться',
                    confirmButtonColor: '#10b981',
                    denyButtonColor: '#ef4444'
                });

                if (result.isConfirmed) {
                    const saved = await saveHandler();
                    return saved !== false;
                }
                return result.isDenied;
            }

            const result = await window.Swal.fire({
                title,
                text,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Выйти без сохранения',
                cancelButtonText: 'Остаться',
                confirmButtonColor: '#ef4444'
            });

            return result.isConfirmed;
        }

        _handleBeforeUnload(e) {
            if (this.isDirty() && !this.isNavigating) {
                e.preventDefault();
                e.returnValue = '';
            }
        }

        async _handleLinkClick(e) {
            if (!this.isDirty() || this.isNavigating) return;

            const link = e.target.closest('a[href]');
            if (!link) return;
            if (link.hasAttribute('data-no-guard')) return;

            const href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:') || link.target === '_blank') {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const allowed = await this.confirmDiscard();
            if (allowed) {
                this.isNavigating = true;
                window.location.href = link.href;
            }
        }

        destroy() {
            this.timers.forEach(t => clearTimeout(t));
            this.timers.clear();
            window.removeEventListener('beforeunload', this._handleBeforeUnload);
            document.removeEventListener('click', this._handleLinkClick, true);
        }
    }

    global.DraftGuard = {
        create(options) {
            return new DraftGuardController(options);
        }
    };
})(window);