const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');

const {
  addDesignToRawInventory,
  transferRawToPrintedInventory,
  getDesignInventoryByProduct,
} = require('../controllers/inventory.controller');

const router = Router();

// Add selected model/design to RAW inventory
router.post(
  '/raw/design',
  auth(['ADMIN', 'PRINTER']),
  addDesignToRawInventory
);

// Optional compatibility route.
// Frontend can use /api/inventory/raw with the same body.
router.post(
  '/raw',
  auth(['ADMIN', 'PRINTER']),
  addDesignToRawInventory
);

// Move selected model/design quantity from RAW to PRINTED
router.post(
  '/transfer-to-printed',
  auth(['ADMIN', 'PRINTER']),
  transferRawToPrintedInventory
);

// New design inventory endpoint
router.get(
  '/design/:productId',
  auth(['ADMIN', 'PRINTER', 'PACKER']),
  getDesignInventoryByProduct
);

// Compatibility with your old dashboard endpoint
router.get(
  '/with-barcodes/:productId',
  auth(['ADMIN', 'PRINTER', 'PACKER']),
  getDesignInventoryByProduct
);

// Compatibility with /api/inventory/:productId
router.get(
  '/:productId',
  auth(['ADMIN', 'PRINTER', 'PACKER']),
  getDesignInventoryByProduct
);

module.exports = router;