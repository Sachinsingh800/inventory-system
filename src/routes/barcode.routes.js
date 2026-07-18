// src/routes/barcode.routes.js
const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const {
  generateBarcodes,
  listBarcodesByProduct,
  updateBarcodeStatus,
} = require('../controllers/barcode.controller');

const router = Router();

// generate labels (admin/printer)
router.post('/', auth(['ADMIN', 'PRINTER']), generateBarcodes);

// list barcodes for one product (grouped by design)
router.get(
  '/manage/:productId',
  auth(['ADMIN', 'PRINTER']),
  listBarcodesByProduct
);

// update single barcode status
router.patch(
  '/:id/status',
  auth(['ADMIN', 'PRINTER']),
  updateBarcodeStatus
);

module.exports = router;