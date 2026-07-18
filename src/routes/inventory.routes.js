// routes/inventory.routes.js
const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const Inventory = require('../models/Inventory');
const Barcode = require('../models/Barcode');
const { upsertRawInventory } = require('../controllers/inventory.controller');

const router = Router();

// upsert raw inventory for a product (admin)
router.post('/raw', auth(['ADMIN']), upsertRawInventory);

// existing simple GET /api/inventory/:productId
router.get(
  '/:productId',
  auth(['ADMIN', 'PRINTER', 'PACKER']),
  async (req, res) => {
    try {
      const { productId } = req.params;
      const inventory = await Inventory.find({ productId }).sort({
        type: 1,
        designCode: 1,
      });

      res.json({ inventory });
    } catch (err) {
      console.error('Get inventory error', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// NEW: GET /api/inventory/with-barcodes/:productId
router.get(
  '/with-barcodes/:productId',
  auth(['ADMIN', 'PRINTER', 'PACKER']),
  async (req, res) => {
    try {
      const { productId } = req.params;

      // 1) Base inventory
      const inventory = await Inventory.find({ productId }).sort({
        type: 1,
        designCode: 1,
      });

      // 2) All barcodes for this product
      const barcodes = await Barcode.find({ productId });

      // 3) Group barcodes by designCode
      const barcodeMap = new Map();
      for (const b of barcodes) {
        const key = b.designCode;
        if (!barcodeMap.has(key)) {
          barcodeMap.set(key, []);
        }
        barcodeMap.get(key).push(b.code);
      }

      // 4) Attach barcodes array to PRINTED rows
      const inventoryWithBarcodes = inventory.map((row) => {
        if (row.type === 'PRINTED' && row.designCode) {
          const codes = barcodeMap.get(row.designCode) || [];
          const obj = row.toObject();
          obj.barcodes = codes;
          return obj;
        }
        return row;
      });

      res.json({ inventory: inventoryWithBarcodes });
    } catch (err) {
      console.error('Get inventory with barcodes error', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;