const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');


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
        return res
          .status(400)
          .json({ message: 'Each item must have productId and orderedQty > 0' });
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


// POST /api/purchase-orders/:id/verify  (ADMIN)
// Raw Stock Formula from BRD:
// New Raw Stock = Current Raw Stock + Fresh Arrived Stock
const verifyPurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body; // [{ productId, receivedQty }]

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items array is required' });
    }

    const po = await PurchaseOrder.findById(id);
    if (!po) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    if (po.status !== 'CREATED' && po.status !== 'PARTIAL') {
      return res
        .status(400)
        .json({ message: 'Purchase order already fully verified' });
    }

    // Map receivedQty by productId for quick lookup
    const receivedMap = new Map();
    for (const item of items) {
      if (!item.productId || item.receivedQty == null || item.receivedQty < 0) {
        return res
          .status(400)
          .json({ message: 'Each item must have productId and receivedQty >= 0' });
      }
      receivedMap.set(String(item.productId), item.receivedQty);
    }

    let allMatched = true;

    // Loop through PO items, update receivedQty and raw inventory
    for (const item of po.items) {
      const key = String(item.productId);

      if (!receivedMap.has(key)) {
        // if not provided in this verify call, skip for now
        if (item.receivedQty < item.orderedQty) {
          allMatched = false;
        }
        continue;
      }

      const receivedQty = receivedMap.get(key);

      // update receivedQty in PO line
      item.receivedQty += receivedQty;

      // if still less than ordered, PO remains PARTIAL
      if (item.receivedQty < item.orderedQty) {
        allMatched = false;
      }

      // RAW STOCK FORMULA:
      // New Raw Stock = Current Raw Stock + Fresh Arrived Stock
      const rawInv = await Inventory.findOne({
        productId: item.productId,
        type: 'RAW',
        designCode: null,
      });

      if (rawInv) {
        rawInv.quantity += receivedQty;
        await rawInv.save();
      } else {
        await Inventory.create({
          productId: item.productId,
          type: 'RAW',
          designCode: null,
          quantity: receivedQty,
          minThreshold: 0,
          isActive: true,
        });
      }
    }

    po.status = allMatched ? 'VERIFIED' : 'PARTIAL';
    await po.save();

    res.json({
      message: 'Purchase order verified and raw stock updated',
      purchaseOrder: po,
    });
  } catch (err) {
    console.error('Verify purchase order error', err);
    res.status(500).json({ message: 'Server error' });
  }
};


module.exports = {
  createPurchaseOrder,
  verifyPurchaseOrder,
};