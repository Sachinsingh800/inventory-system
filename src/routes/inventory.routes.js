const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const Inventory = require('../models/Inventory');
const { upsertRawInventory } = require('../controllers/inventory.controller');

const router = Router();

// upsert raw inventory for a product (admin)
router.post('/raw', auth(['ADMIN']), upsertRawInventory);

// existing GET /:productId
router.get('/:productId', auth(['ADMIN', 'PRINTER', 'PACKER']), async (req, res) => {
  try {
    const { productId } = req.params;
    const inventory = await Inventory.find({ productId }).sort({ type: 1, designCode: 1 });

    res.json({ inventory });
  } catch (err) {
    console.error('Get inventory error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;