// routes/packing.routes.js
const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const { scanBarcode } = require('../controllers/packing.controller');

const router = Router();

// direct scan barcode (admin/packer)
router.post('/scan', auth(['ADMIN', 'PACKER']), scanBarcode);

module.exports = router;