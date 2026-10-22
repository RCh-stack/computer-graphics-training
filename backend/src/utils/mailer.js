const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

/**
 * @param {string} toEmail
 * @param {string} code
 */
async function sendResetCodeEmail(toEmail, code) {
    const htmlTemplate = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #030712; color: #f3f4f6; padding: 32px 20px; border-radius: 16px; max-width: 480px; margin: 0 auto; border: 1px solid #374151;">
            <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #ec4899; font-size: 24px; margin: 0; font-weight: 800;">VirtualLab <span style="color: #f472b6;">Edu</span></h1>
                <p style="color: #9ca3af; font-size: 13px; margin-top: 4px;">Обучающая система по алгоритмам рендеринга</p>
            </div>

            <div style="background-color: #111827; padding: 24px; border-radius: 12px; border: 1px solid #1f2937;">
                <h2 style="font-size: 16px; color: #f3f4f6; margin-top: 0; margin-bottom: 12px;">Восстановление доступа</h2>
                <p style="font-size: 13px; color: #9ca3af; line-height: 1.5; margin-bottom: 20px;">
                    Вы запросили сброс пароля для вашей учетной записи. Используйте приведенный ниже код для подтверждения смены пароля:
                </p>

                <!-- Блок с кодом -->
                <div style="background-color: #1f2937; padding: 16px; border-radius: 10px; text-align: center; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; border: 1px border #374151; margin: 20px 0;">
                    ${code}
                </div>

                <p style="font-size: 11px; color: #6b7280; margin-bottom: 0; text-align: center;">
                    Код действителен в течение <strong>15 минут</strong>.
                </p>
            </div>

            <div style="text-align: center; margin-top: 24px; border-top: 1px solid #1f2937; padding-top: 16px;">
                <p style="font-size: 11px; color: #4b5563; margin: 0;">
                    Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.
                </p>
            </div>
        </div>
    `;

    return await transporter.sendMail({
        from: process.env.SMTP_FROM || `"VirtualLab Edu" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: `${code} — Код сброса пароля | VirtualLab Edu`,
        html: htmlTemplate,
    });
}

module.exports = { sendResetCodeEmail };