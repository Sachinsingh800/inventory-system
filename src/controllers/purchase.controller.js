const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');

// helper to build text summary like: "iPhone 16 - 350pcs, iPhone 11 - 50pcs"
const buildTextSummary = async (items) => {
  const parts = [];

  for (const item of items) {
    const product = await Product.findById(item.productId).select('name');
    const name = product ? product.name : 'Unknown Product';
    parts.push(`${name} - ${item.orderedQty}pcs`);
  }

  return parts.join(', ');
};

// POST /api/purchase-orders  (ADMIN)
const createPurchaseOrder = async (req, res) => {
  try {
    const { supplierName, notes, items } = req.body;
    const userId = req.user?.id; // comes from auth middleware

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items array is required' });
    }

    // basic validation
    for (const item of items) {
      if (!item.productId || !item.orderedQty || item.orderedQty <= 0) {
        return res.status(400).json({ message: 'Each item must have productId and orderedQty > 0' });
      }
    }

    const textSummary = await buildTextSummary(items);

    const po = await PurchaseOrder.create({
      supplierName,
      notes,
      items,
      status: 'CREATED',
      textSummary,
      createdBy: userId,
    });

    res.status(201).json({
      message: 'Purchase order created successfully',
      purchaseOrder: po,
    });
  } catch (err) {
    console.error('Create purchase order error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createPurchaseOrder };