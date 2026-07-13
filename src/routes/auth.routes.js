const { Router } = require('express');
const { register, login } = require('../controllers/auth.controller');

const router = Router();

// initial admin setup
router.post('/register', register);

// login for admin (and later printer/packer)
router.post('/login', login);

module.exports = router;