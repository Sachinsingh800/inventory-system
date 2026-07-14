const Inventory = require('../models/Inventory');

// POST /api/inventory/raw  (ADMIN)
// body: { productId, quantity, minThreshold }
const upsertRawInventory = async (req, res) => {
  try {
    const { productId, quantity, minThreshold } = req.body;

    if (!productId) {
      return res.status(400).json({ message: 'productId is required' });
    }
    if (quantity == null || quantity < 0) {
      return res.status(400).json({ message: 'quantity >= 0 is required' });
    }

    let inv = await Inventory.findOne({
      productId,
      type: 'RAW',
      designCode: null,
    });

    if (!inv) {
      inv = await Inventory.create({
        productId,
        type: 'RAW',
        designCode: null,
        quantity,
        minThreshold: minThreshold ?? 0,
        isActive: true,
      });
    } else {
      inv.quantity = quantity;
      if (minThreshold != null) {
        inv.minThreshold = minThreshold;
      }
      await inv.save();
    }

    res.status(201).json({
      message: 'Raw inventory upserted successfully',
      inventory: inv,
    });
  } catch (err) {
    console.error('Upsert raw inventory error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { upsertRawInventory };