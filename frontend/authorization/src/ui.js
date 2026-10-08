document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('register-form')?.addEventListener('submit', handleRegister);
    document.getElementById('reset-form')?.addEventListener('submit', handleResetPassword);
});

function showForm(formType) {
    hideAlert();
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

    try {
        const res = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = '../index.html';
        } else {
            if (data.status === 'pending_approval') {
                showAlert('Ваша заявка находится на рассмотрении у преподавателя.', 'error');
            } else {
                showAlert(data.message || 'Неверный логин или пароль');
            }
        }
    } catch (err) {
        showAlert('Ошибка подключения к серверу');
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
        showAlert('Ошибка обновления пароля');
    }
}