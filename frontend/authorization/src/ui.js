let pending2FATempToken = null;
let pending2FAEmail = null;

function getSavedDeviceToken(email) {
    try {
        const map = JSON.parse(localStorage.getItem('trustedDeviceTokens') || '{}');
        return map[String(email).trim().toLowerCase()] || null;
    } catch {
        return null;
    }
}

function saveDeviceToken(email, deviceToken) {
    if (!email || !deviceToken) return;
    try {
        const map = JSON.parse(localStorage.getItem('trustedDeviceTokens') || '{}');
        map[String(email).trim().toLowerCase()] = deviceToken;
        localStorage.setItem('trustedDeviceTokens', JSON.stringify(map));
    } catch (e) {
        console.error('Не удалось сохранить токен устройства:', e);
    }
}

function completeLoginSession(data) {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.href = '../index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('two-factor-step')?.addEventListener('submit', handleVerify2FA);
    document.getElementById('register-form')?.addEventListener('submit', handleRegister);
    document.getElementById('reset-form')?.addEventListener('submit', handleResetPassword);

    document.getElementById('btn-back-to-login')?.addEventListener('click', () => {
        showForm('login');
    });

    const codeInput = document.getElementById('login-2fa-code');
    codeInput?.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });
});

function showForm(formType) {
    hideAlert();
    pending2FATempToken = null;
    pending2FAEmail = null;

    document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));

    const subtitle = document.getElementById('form-subtitle');

    if (formType === 'login') {
        document.getElementById('login-form').classList.remove('hidden');
        subtitle.innerText = 'Вход в систему обучения Ray и Path Tracing';
    } else if (formType === 'register') {
        document.getElementById('register-form').classList.remove('hidden');
        subtitle.innerText = 'Регистрация нового студента';
    } else if (formType === 'reset') {
        document.getElementById('reset-form').classList.remove('hidden');
        document.getElementById('reset-step-1').classList.remove('hidden');
        document.getElementById('reset-step-2').classList.add('hidden');
        subtitle.innerText = 'Восстановление доступа к аккаунту';
    }
}

function switchTo2FAStep(tempToken, email) {
    hideAlert();
    pending2FATempToken = tempToken;
    pending2FAEmail = email;

    document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
    document.getElementById('two-factor-step')?.classList.remove('hidden');

    const subtitle = document.getElementById('form-subtitle');
    if (subtitle) {
        subtitle.innerText = 'Подтверждение входа в аккаунт';
    }

    const codeInput = document.getElementById('login-2fa-code');
    if (codeInput) {
        codeInput.value = '';
        codeInput.focus();
    }
}

function showAlert(message, type = 'error') {
    const box = document.getElementById('alert-box');
    const msg = document.getElementById('alert-message');
    const icon = document.getElementById('alert-icon');

    msg.innerText = message;
    box.classList.remove('hidden', 'bg-red-500/10', 'border-red-500', 'text-red-400', 'bg-emerald-500/10', 'border-emerald-500', 'text-emerald-400');

    if (type === 'error') {
        box.classList.add('bg-red-500/10', 'border', 'border-red-500', 'text-red-400');
        icon.className = 'fa-solid fa-circle-exclamation';
    } else {
        box.classList.add('bg-emerald-500/10', 'border', 'border-emerald-500', 'text-emerald-400');
        icon.className = 'fa-solid fa-circle-check';
    }
}

function hideAlert() {
    document.getElementById('alert-box').classList.add('hidden');
}

async function handleLogin(e) {
    e.preventDefault();
    hideAlert();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const deviceToken = getSavedDeviceToken(email);

    try {
        const res = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, deviceToken })
        });
        const data = await res.json();

        if (!res.ok) {
            if (data.status === 'pending_approval') {
                showAlert('Ваша заявка находится на рассмотрении у преподавателя.', 'error');
            } else {
                Swal.fire({
                    title: res.status === 429 ? 'Доступ временно ограничен' : 'Неверный логин или пароль',
                    text: data.message || 'Проверьте введенные данные',
                    icon: res.status === 429 ? 'warning' : 'error',
                    confirmButtonColor: '#ec4899'
                });
            }
            return;
        }

        if (data.status === '2fa_required' && data.tempToken) {
            switchTo2FAStep(data.tempToken, email);
            return;
        }

        completeLoginSession(data);
    } catch (error) {
        console.error('Ошибка подключения к серверу: ', error);
        showAlert('Ошибка подключения к серверу');
    }
}

async function handleVerify2FA(e) {
    e.preventDefault();
    hideAlert();

    const code = document.getElementById('login-2fa-code')?.value.trim();
    const rememberDevice = Boolean(document.getElementById('remember-device-checkbox')?.checked);

    if (!code || code.length !== 6) {
        showAlert('Введите 6-значный код из приложения-аутентификатора');
        return;
    }

    const submitBtn = document.getElementById('btn-verify-2fa');
    if (submitBtn) submitBtn.disabled = true;

    try {
        const res = await fetch('/api/v1/auth/2fa/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tempToken: pending2FATempToken,
                code,
                rememberDevice
            })
        });
        const data = await res.json();

        if (!res.ok) {
            if (data.code === 'TEMP_TOKEN_EXPIRED' || data.code === 'INVALID_TEMP_TOKEN') {
                showForm('login');
                showAlert(data.message || 'Сессия подтверждения истекла. Войдите заново.');
                return;
            }

            Swal.fire({
                title: res.status === 429 ? 'Слишком много попыток' : 'Неверный код подтверждения',
                text: data.message || 'Проверьте код в приложении и повторите попытку',
                icon: res.status === 429 ? 'warning' : 'error',
                confirmButtonColor: '#ec4899'
            });
            return;
        }

        if (data.deviceToken && pending2FAEmail) {
            saveDeviceToken(pending2FAEmail, data.deviceToken);
        }

        completeLoginSession(data);
    } catch (error) {
        console.error('Ошибка проверки 2FA: ', error);
        showAlert('Ошибка подключения к серверу');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function handleRegister(e) {
    e.preventDefault();
    hideAlert();

    const firstName = document.getElementById('reg-first-name').value.trim();
    const lastName = document.getElementById('reg-last-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    try {
        const res = await fetch('/api/v1/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName, email, password })
        });
        const data = await res.json();

        if (res.ok) {
            Swal.fire({
                title: 'Заявка отправлена!',
                text: 'Вы успешно зарегистрировались. Доступ к материалам откроется после подтверждения преподавателем.',
                icon: 'success',
                confirmButtonColor: '#ec4899'
            }).then(() => showForm('login'));
        } else {
            showAlert(data.message || 'Ошибка регистрации');
        }
    } catch (error) {
        console.error('Ошибка подключения к серверу: ', error);
        showAlert('Ошибка подключения к серверу');
    }
}

async function requestResetCode() {
    hideAlert();
    const email = document.getElementById('reset-email').value.trim();
    if (!email) {
        showAlert('Введите ваш Email');
        return;
    }

    try {
        const res = await fetch('/api/v1/auth/request-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (res.ok) {
            showAlert('Код отправлен на ваш email!', 'success');
            document.getElementById('reset-step-1').classList.add('hidden');
            document.getElementById('reset-step-2').classList.remove('hidden');
        } else {
            showAlert(data.message || 'Пользователь с таким email не найден');
        }
    } catch (error) {
        console.error('Ошибка отправки кода: ', error);
        showAlert('Ошибка отправки кода');
    }
}

async function handleResetPassword(e) {
    e.preventDefault();
    hideAlert();

    const email = document.getElementById('reset-email').value.trim();
    const code = document.getElementById('reset-code').value.trim();
    const newPassword = document.getElementById('reset-new-password').value;

    try {
        const res = await fetch('/api/v1/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code, newPassword })
        });
        const data = await res.json();

        if (res.ok) {
            Swal.fire({
                title: 'Пароль изменен!',
                text: 'Теперь вы можете войти с новым паролем.',
                icon: 'success',
                confirmButtonColor: '#10b981'
            }).then(() => showForm('login'));
        } else {
            showAlert(data.message || 'Неверный код подтверждения');
        }
    } catch (error) {
        console.error('Ошибка обновления пароля: ', error);
        showAlert('Ошибка обновления пароля');
    }
}