const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const {
  generateBarcodes,
  listBarcodesByProduct,
  updateBarcodeStatus,
  getBarcodeTodayReport,
  getPackedBarcodes,
} = require('../controllers/barcode.controller');

const router = Router();

router.post('/', auth(['ADMIN', 'PRINTER']), generateBarcodes);
router.get('/packed', auth(['ADMIN', 'PRINTER']), getPackedBarcodes);
router.get('/report/today', auth(['ADMIN', 'PRINTER']), getBarcodeTodayReport);
router.get('/manage/:productId', auth(['ADMIN', 'PRINTER']), listBarcodesByProduct);
router.patch('/:id/status', auth(['ADMIN', 'PRINTER']), updateBarcodeStatus);


module.exports = router;
