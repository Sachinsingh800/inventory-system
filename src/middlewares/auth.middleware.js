const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

const auth = (allowedRoles = []) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = { id: decoded.userId, role: decoded.role };

      if (allowedRoles.length && !allowedRoles.includes(decoded.role)) {
        return res.status(403).json({ message: 'Forbidden: insufficient role' });
      }

      next();
    } catch (err) {
      console.error('Auth error', err);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  };
};

module.exports = auth;