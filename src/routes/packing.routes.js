const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const {
  createPackingSession,
  scanBarcode,
} = require('../controllers/packing.controller');

const router = Router();

// create session (admin/packer)
router.post('/', auth(['ADMIN', 'PACKER']), createPackingSession);

// scan barcode (packer)
router.post('/:id/scan', auth(['ADMIN', 'PACKER']), scanBarcode);

module.exports = router;