(function (global) {
    const MAX_VISIBLE_TOASTS = 5;
    const DEFAULT_DURATION = 3500;

    const VARIANTS = {
        success: {
            icon: 'fa-circle-check',
            iconBox: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
            hoverBorder: 'hover:border-emerald-500/40',
            progress: 'bg-emerald-500',
        },
        error: {
            icon: 'fa-circle-exclamation',
            iconBox: 'text-red-400 bg-red-500/10 border-red-500/20',
            hoverBorder: 'hover:border-red-500/40',
            progress: 'bg-red-500',
        },
        warning: {
            icon: 'fa-triangle-exclamation',
            iconBox: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
            hoverBorder: 'hover:border-amber-500/40',
            progress: 'bg-amber-500',
        },
        info: {
            icon: 'fa-circle-info',
            iconBox: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
            hoverBorder: 'hover:border-pink-500/40',
            progress: 'bg-pink-500',
        },
    };

    function getOrCreateContainer() {
        let container = document.getElementById('global-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'global-toast-container';
            container.setAttribute('aria-live', 'polite');
            container.className =
                'fixed top-5 right-5 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none px-4 sm:px-0';
            document.body.appendChild(container);
        }
        return container;
    }

    function parseArgs(titleOrMessage, messageOrOptions, maybeOptions) {
        if (typeof messageOrOptions === 'string') {
            return {
                title: titleOrMessage,
                message: messageOrOptions,
                options: maybeOptions || {},
            };
        }
        return {
            title: titleOrMessage,
            message: '',
            options: messageOrOptions || {},
        };
    }

    function createToastElement(type, title, message, duration) {
        const variant = VARIANTS[type] || VARIANTS.info;

        const card = document.createElement('div');
        card.setAttribute('role', 'status');
        card.className = [
            'pointer-events-auto relative overflow-hidden rounded-xl',
            'bg-[var(--bg-panel)] border border-[var(--border-color)] shadow-2xl',
            variant.hoverBorder,
            'transition-all duration-300 ease-out transform opacity-0 translate-x-8 scale-95',
        ].join(' ');

        const body = document.createElement('div');
        body.className = 'p-3.5 flex items-start gap-3';

        const iconWrapper = document.createElement('div');
        iconWrapper.className = `w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${variant.iconBox}`;
        const icon = document.createElement('i');
        icon.className = `fa-solid ${variant.icon} text-sm`;
        iconWrapper.appendChild(icon);

        const textWrapper = document.createElement('div');
        textWrapper.className = 'flex-1 min-w-0 pt-0.5';

        const titleEl = document.createElement('p');
        titleEl.className = message
            ? 'text-xs font-bold text-[var(--text-main)] leading-snug'
            : 'text-xs font-semibold text-[var(--text-main)] leading-snug pt-1';
        titleEl.textContent = title;
        textWrapper.appendChild(titleEl);

        if (message) {
            const msgEl = document.createElement('p');
            msgEl.className = 'text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed';
            msgEl.textContent = message;
            textWrapper.appendChild(msgEl);
        }

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Закрыть уведомление');
        closeBtn.className =
            'w-6 h-6 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)] transition shrink-0';
        const closeIcon = document.createElement('i');
        closeIcon.className = 'fa-solid fa-xmark text-xs pointer-events-none';
        closeBtn.appendChild(closeIcon);

        body.appendChild(iconWrapper);
        body.appendChild(textWrapper);
        body.appendChild(closeBtn);
        card.appendChild(body);

        let progressBar = null;
        if (duration > 0) {
            const track = document.createElement('div');
            track.className = 'h-0.5 w-full bg-[var(--border-color)]/40';

            progressBar = document.createElement('div');
            progressBar.className = `h-full w-full ${variant.progress}`;

            track.appendChild(progressBar);
            card.appendChild(track);
        }

        let remaining = duration;
        let startTime = Date.now();
        let timerId = null;
        let isDismissed = false;

        function dismiss() {
            if (isDismissed) return;
            isDismissed = true;
            clearTimeout(timerId);

            card.classList.remove('opacity-100', 'translate-x-0', 'scale-100');
            card.classList.add('opacity-0', 'translate-x-8', 'scale-95');

            setTimeout(() => {
                card.remove();
            }, 280);
        }

        function startTimer() {
            if (duration <= 0 || isDismissed) return;
            startTime = Date.now();

            if (progressBar) {
                requestAnimationFrame(() => {
                    progressBar.style.transition = `width ${remaining}ms linear`;
                    progressBar.style.width = '0%';
                });
            }

            timerId = setTimeout(dismiss, remaining);
        }

        function pauseTimer() {
            if (duration <= 0 || isDismissed) return;
            clearTimeout(timerId);

            const elapsed = Date.now() - startTime;
            remaining = Math.max(0, remaining - elapsed);

            if (progressBar && progressBar.parentElement) {
                const parentWidth = progressBar.parentElement.getBoundingClientRect().width;
                const currentWidth = progressBar.getBoundingClientRect().width;
                const currentPercent = parentWidth > 0 ? (currentWidth / parentWidth) * 100 : 0;

                progressBar.style.transition = 'none';
                progressBar.style.width = `${currentPercent}%`;
            }
        }

        closeBtn.addEventListener('click', dismiss);
        card.addEventListener('mouseenter', pauseTimer);
        card.addEventListener('mouseleave', startTimer);

        card._dismiss = dismiss;
        card._startTimer = startTimer;

        return card;
    }

    const Toast = {
        show(type, titleOrMessage, messageOrOptions, maybeOptions) {
            if (!document.body) {
                document.addEventListener('DOMContentLoaded', () => {
                    this.show(type, titleOrMessage, messageOrOptions, maybeOptions);
                });
                return null;
            }

            const { title, message, options } = parseArgs(
                titleOrMessage,
                messageOrOptions,
                maybeOptions
            );
            const duration =
                typeof options.duration === 'number' ? options.duration : DEFAULT_DURATION;

            const container = getOrCreateContainer();

            while (container.children.length >= MAX_VISIBLE_TOASTS) {
                const oldest = container.firstElementChild;
                if (oldest && typeof oldest._dismiss === 'function') {
                    oldest._dismiss();
                }
                oldest?.remove();
            }

            const toastEl = createToastElement(type, title, message, duration);
            container.appendChild(toastEl);

            requestAnimationFrame(() => {
                toastEl.classList.remove('opacity-0', 'translate-x-8', 'scale-95');
                toastEl.classList.add('opacity-100', 'translate-x-0', 'scale-100');
                toastEl._startTimer();
            });

            return {
                dismiss: () => toastEl._dismiss(),
            };
        },

        success(titleOrMessage, messageOrOptions, maybeOptions) {
            return this.show('success', titleOrMessage, messageOrOptions, maybeOptions);
        },

        error(titleOrMessage, messageOrOptions, maybeOptions) {
            return this.show('error', titleOrMessage, messageOrOptions, maybeOptions);
        },

        warning(titleOrMessage, messageOrOptions, maybeOptions) {
            return this.show('warning', titleOrMessage, messageOrOptions, maybeOptions);
        },

        info(titleOrMessage, messageOrOptions, maybeOptions) {
            return this.show('info', titleOrMessage, messageOrOptions, maybeOptions);
        },

        dismissAll() {
            const container = document.getElementById('global-toast-container');
            if (!container) return;
            Array.from(container.children).forEach((el) => {
                if (typeof el._dismiss === 'function') {
                    el._dismiss();
                } else {
                    el.remove();
                }
            });
        },
    };

    global.Toast = Toast;
})(window);