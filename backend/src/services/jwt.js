const jwt = require('jsonwebtoken');
const { Client } = require('pg');

const JWT_SECRET = process.env.JWT_SECRET;

function getDbClient() {
  return new Client({ connectionString: process.env.DATABASE_URL });
}

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      status: 'TOKEN_MISSING',
      message: 'Токен авторизации отсутствует.'
    });
  }

  let client;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    client = getDbClient();
    await client.connect();

    const userRes = await client.query(
      `SELECT id, email, role, is_approved FROM "users" WHERE id = $1 LIMIT 1;`,
      [decoded.id]
    );

    const currentUser = userRes.rows[0];

    if (!currentUser || !currentUser.is_approved) {
      return res.status(401).json({
        status: 'ACCOUNT_DISABLED',
        message: 'Учетная запись заблокирована или не найдена.'
      });
    }

    if (decoded.role && decoded.role !== currentUser.role) {
      return res.status(401).json({
        status: 'ROLE_CHANGED',
        message: 'Ваши права доступа были изменены администратором. Войдите в систему заново.'
      });
    }

    req.user = currentUser;
    next();
  } catch (error) {
    console.error('JWT Authentication Error:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'TOKEN_EXPIRED',
        message: 'Срок действия сессии истек. Войдите заново.'
      });
    }

    return res.status(401).json({
      status: 'INVALID_TOKEN',
      message: 'Недействительный токен.'
    });
  } finally {
    if (client) {
      await client.end().catch(err => console.error('Ошибка закрытия клиента БД:', error));
    }
  }
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        status: 'FORBIDDEN', 
        message: 'У вас недостаточно прав для выполнения этого действия.' 
      });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET,
};