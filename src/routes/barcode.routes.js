const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const {
  generateBarcodes,
  listBarcodesByProduct,
  updateBarcodeStatus,
  getBarcodeTodayReport,
} = require('../controllers/barcode.controller');

const router = Router();

router.post('/', auth(['ADMIN', 'PRINTER']), generateBarcodes);
router.get('/manage/:productId', auth(['ADMIN', 'PRINTER']), listBarcodesByProduct);
router.patch('/:id/status', auth(['ADMIN', 'PRINTER']), updateBarcodeStatus);
router.get('/report/today', auth(['ADMIN', 'PRINTER']), getBarcodeTodayReport);

module.exports = router;