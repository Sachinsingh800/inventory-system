// routes/inventory.js
const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const {
  addDesignToRawInventory,
  transferRawToPrintedInventory,
  getDesignInventoryByProduct,
  updateInventoryThreshold,
  getLowStockInventory,            // <-- import
} = require('../controllers/inventory.controller');

const router = Router();

// POST routes
router.post('/raw/design', auth(['ADMIN', 'PRINTER']), addDesignToRawInventory);
router.post('/raw', auth(['ADMIN', 'PRINTER']), addDesignToRawInventory);
router.post('/transfer-to-printed', auth(['ADMIN', 'PRINTER']), transferRawToPrintedInventory);

// PATCH route (threshold update)
router.patch('/:id', auth(['ADMIN', 'PRINTER', 'PACKER']), updateInventoryThreshold);

// *** NEW: Low-stock report ***
router.get('/low-stock', auth(['ADMIN', 'PRINTER', 'PACKER']), getLowStockInventory);

// GET routes (dynamic :productId must be last)
router.get('/design/:productId', auth(['ADMIN', 'PRINTER', 'PACKER']), getDesignInventoryByProduct);
router.get('/with-barcodes/:productId', auth(['ADMIN', 'PRINTER', 'PACKER']), getDesignInventoryByProduct);
router.get('/:productId', auth(['ADMIN', 'PRINTER', 'PACKER']), getDesignInventoryByProduct);

module.exports = router;