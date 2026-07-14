const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const { generateBarcodes } = require('../controllers/barcode.controller');

const router = Router();

// generate labels (admin/printer)
router.post('/', auth(['ADMIN', 'PRINTER']), generateBarcodes);

module.exports = router;