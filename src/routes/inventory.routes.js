const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const Inventory = require('../models/Inventory');

const router = Router();

// GET /api/inventory/:productId  (see RAW + PRINTED for a product)
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