const Sentry = require('@sentry/node');

const SENSITIVE_KEYS = [
  'password',
  'newpassword',
  'oldpassword',
  'token',
  'temptoken',
  'devicetoken',
  'twofactorsecret',
  'secret',
  'code',
];

function sanitizeData(data) {
  if (!data || typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized = { ...data };
  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = '[FILTERED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }
  return sanitized;
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 0,
    beforeSend(event) {
      if (event.request) {
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        if (event.request.data) {
          if (typeof event.request.data === 'string') {
            try {
              const parsed = JSON.parse(event.request.data);
              event.request.data = JSON.stringify(sanitizeData(parsed));
            } catch {
              event.request.data = '[UNPARSED_BODY]';
            }
          } else {
            event.request.data = sanitizeData(event.request.data);
          }
        }
      }
      return event;
    },
  });
}

module.exports = Sentry;