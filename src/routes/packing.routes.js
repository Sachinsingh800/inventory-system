// routes/packing.routes.js
const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const { scanBarcode, lookupBarcode } = require('../controllers/packing.controller');

const router = Router();

// NEW: just read barcode + product info, no stock update
router.post('/lookup', auth(['ADMIN', 'PACKER']), lookupBarcode);

// direct scan barcode (admin/packer) → commits packing
router.post('/scan', auth(['ADMIN', 'PACKER']), scanBarcode);

module.exports = router;