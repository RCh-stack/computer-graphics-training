const jwt = require('jsonwebtoken');
const { Client } = require('pg');
const AppError = require('../utils/appError');

const JWT_SECRET = process.env.JWT_SECRET;

function getDbClient() {
  return new Client({ connectionString: process.env.DATABASE_URL });
}

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(new AppError('Токен авторизации отсутствует.', 401, 'TOKEN_MISSING'));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose === '2fa_verify') {
      return next(new AppError('Требуется подтверждение двухфакторной аутентификации.', 401, 'TWO_FACTOR_REQUIRED'));
    }
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Срок действия сессии истек. Войдите заново.', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('Недействительный токен.', 401, 'INVALID_TOKEN'));
  }

  const client = getDbClient();
  try {
    await client.connect();

    const userRes = await client.query(
      `SELECT id, email, role, is_approved FROM "users" WHERE id = $1 LIMIT 1;`,
      [decoded.id]
    );

    const currentUser = userRes.rows[0];

    if (!currentUser || !currentUser.is_approved) {
      return next(new AppError('Учетная запись заблокирована или не найдена.', 401, 'ACCOUNT_DISABLED'));
    }

    if (decoded.role && decoded.role !== currentUser.role) {
      return next(
        new AppError(
          'Ваши права доступа были изменены администратором. Войдите в систему заново.',
          401,
          'ROLE_CHANGED'
        )
      );
    }

    req.user = currentUser;
    return next();
  } catch (dbError) {
    return next(dbError);
  } finally {
    await client.end().catch((err) => console.error('Ошибка закрытия клиента БД:', err));
  }
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError('У вас недостаточно прав для выполнения этого действия.', 403, 'FORBIDDEN'));
    }
    return next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET,
};