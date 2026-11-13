function update2FAStatusUI(isEnabled) {
    const badge = document.getElementById('2fa-status-badge');
    const setupBtn = document.getElementById('btn-setup-2fa');
    const disableBtn = document.getElementById('btn-disable-2fa');
    const setupPanel = document.getElementById('2fa-setup-panel');

    setupPanel?.classList.add('hidden');

    if (isEnabled) {
        if (badge) {
            badge.textContent = 'Включена';
            badge.className = 'text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium';
        }
        setupBtn?.classList.add('hidden');
        disableBtn?.classList.remove('hidden');
    } else {
        if (badge) {
            badge.textContent = 'Отключена';
            badge.className = 'text-[11px] px-2.5 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 font-medium';
        }
        disableBtn?.classList.add('hidden');
        setupBtn?.classList.remove('hidden');
    }

    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.is2faEnabled = Boolean(isEnabled);
        localStorage.setItem('user', JSON.stringify(user));
    } catch {}
}

document.addEventListener('DOMContentLoaded', () => {
    const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (typeof cachedUser.is2faEnabled === 'boolean') {
        update2FAStatusUI(cachedUser.is2faEnabled);
    }

    sync2FAStatusFromServer();

    const confirmInput = document.getElementById('2fa-confirm-code');
    confirmInput?.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });

    document.getElementById('btn-setup-2fa')?.addEventListener('click', async () => {
        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch('/api/v1/auth/2fa/setup', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (!res.ok) {
                Swal.fire('Ошибка', data.message || 'Не удалось начать настройку 2FA', 'error');
                return;
            }

            document.getElementById('2fa-qr-image').src = data.qrCode;
            document.getElementById('2fa-manual-secret').textContent = data.secret;
            document.getElementById('2fa-confirm-code').value = '';
            document.getElementById('2fa-setup-panel')?.classList.remove('hidden');
            document.getElementById('2fa-confirm-code')?.focus();
        } catch (err) {
            console.error('Ошибка генерации QR-кода 2FA:', err);
            Swal.fire('Ошибка сети', 'Не удалось получить QR-код', 'error');
        }
    });

    document.getElementById('btn-cancel-setup-2fa')?.addEventListener('click', () => {
        document.getElementById('2fa-setup-panel')?.classList.add('hidden');
    });

    document.getElementById('btn-copy-2fa-secret')?.addEventListener('click', async () => {
        const secret = document.getElementById('2fa-manual-secret')?.textContent;
        if (!secret) return;
        await navigator.clipboard.writeText(secret);
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Ключ скопирован',
            showConfirmButton: false,
            timer: 2000
        });
    });

    document.getElementById('btn-confirm-enable-2fa')?.addEventListener('click', async () => {
        const code = document.getElementById('2fa-confirm-code')?.value.trim();

        if (!code || code.length !== 6) {
            Swal.fire('Введите код', 'Укажите 6-значный код из приложения', 'warning');
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch('/api/v1/auth/2fa/enable', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code })
            });
            const data = await res.json();

            if (!res.ok) {
                Swal.fire('Неверный код', data.message || 'Проверьте код и время на устройстве', 'error');
                return;
            }

            update2FAStatusUI(true);
            Swal.fire('Готово!', 'Двухфакторная аутентификация включена', 'success');
        } catch (err) {
            console.error('Ошибка активации 2FA:', err);
            Swal.fire('Ошибка сети', 'Не удалось активировать 2FA', 'error');
        }
    });

    document.getElementById('btn-disable-2fa')?.addEventListener('click', async () => {
        const { value: password } = await Swal.fire({
            title: 'Отключение 2FA',
            text: 'Для подтверждения введите ваш текущий пароль от аккаунта:',
            input: 'password',
            inputPlaceholder: 'Текущий пароль',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#374151',
            confirmButtonText: 'Отключить 2FA',
            cancelButtonText: 'Отмена',
            inputValidator: (value) => {
                if (!value) return 'Введите пароль';
            }
        });

        if (!password) return;

        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch('/api/v1/auth/2fa/disable', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ password })
            });
            const data = await res.json();

            if (!res.ok) {
                Swal.fire('Ошибка', data.message || 'Не удалось отключить 2FA', 'error');
                return;
            }

            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const map = JSON.parse(localStorage.getItem('trustedDeviceTokens') || '{}');
                if (user.email) {
                    delete map[user.email.toLowerCase()];
                    localStorage.setItem('trustedDeviceTokens', JSON.stringify(map));
                }
            } catch {}

            update2FAStatusUI(false);
            Swal.fire('Отключено', 'Двухфакторная аутентификация выключена', 'info');
        } catch (err) {
            console.error('Ошибка отключения 2FA:', err);
            Swal.fire('Ошибка сети', 'Не удалось отключить 2FA', 'error');
        }
    });
});

async function sync2FAStatusFromServer() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) return;

        const res = await fetch('/api/v1/users/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;

        const data = await res.json();
        if (data.user && typeof data.user.is_2fa_enabled === 'boolean') {
            update2FAStatusUI(data.user.is_2fa_enabled);
        }
    } catch (e) {
        console.error('Не удалось синхронизировать статус 2FA:', e);
    }
}