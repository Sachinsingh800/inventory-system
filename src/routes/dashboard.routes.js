// routes/dashboard.routes.js
const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');

const router = Router();

// GET /api/dashboard/inventory-products
router.get('/inventory-products', auth(['ADMIN']), async (req, res) => {
  try {
    // 1) Get all active products
    const products = await Product.find({ isActive: true }).populate('categoryId');

    // 2) For each product, aggregate inventory
    const result = await Promise.all(
      products.map(async (p) => {
        const inventoryDocs = await Inventory.find({ productId: p._id }).sort({
          type: 1,
          designCode: 1,
        });

        const rawDoc = inventoryDocs.find((i) => i.type === 'RAW');
        const printedDocs = inventoryDocs.filter((i) => i.type === 'PRINTED');

        const rawQuantity = rawDoc?.quantity ?? 0;
        const minThreshold = rawDoc?.minThreshold ?? 0;
        const printedQuantity = printedDocs.reduce(
          (sum, doc) => sum + (doc.quantity ?? 0),
          0
        );

        return {
          id: p._id,
          name: p.name,
          categoryName: p.categoryId?.name ?? '',
          rawQuantity,
          printedQuantity,
          minThreshold,
        };
      })
    );

    res.json(result);
  } catch (err) {
    console.error('Dashboard inventory-products error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;