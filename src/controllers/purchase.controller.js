const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');

const allowedStatuses = ['PENDING', 'CREATED', 'VERIFIED', 'PARTIAL'];

const buildTextSummary = async (items) => {
  const parts = [];

  for (const item of items) {
    const product = await Product.findById(item.productId).select('name');
    const name = product ? product.name : 'Unknown Product';
    parts.push(`${name} - ${item.orderedQty}pcs`);
  }

  return parts.join(', ');
};

const createPurchaseOrder = async (req, res) => {
  try {
    const { supplierName, notes, items, status, purchaseDate } = req.body;
    const userId = req.user?.id;

    if (!supplierName || typeof supplierName !== 'string') {
      return res.status(400).json({ message: 'supplierName is required' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items array is required' });
    }

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid status',
        allowedStatuses,
      });
    }

    for (const item of items) {
      if (!item.productId || !item.orderedQty || item.orderedQty <= 0) {
        return res.status(400).json({
          message: 'Each item must have productId and orderedQty > 0',
        });
      }
    }

    const textSummary = await buildTextSummary(items);

    const po = await PurchaseOrder.create({
      supplierName: supplierName.trim(),
      notes: notes ? String(notes).trim() : '',
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      items,
      status: status || 'PENDING',
      textSummary,
      createdBy: userId || undefined,
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

const verifyPurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

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

    const receivedMap = new Map();
    for (const item of items) {
      if (!item.productId || item.receivedQty == null || item.receivedQty < 0) {
        return res.status(400).json({
          message: 'Each item must have productId and receivedQty >= 0',
        });
      }
      receivedMap.set(String(item.productId), item.receivedQty);
    }

    let allMatched = true;

    for (const item of po.items) {
      const key = String(item.productId);

      if (!receivedMap.has(key)) {
        if (item.receivedQty < item.orderedQty) {
          allMatched = false;
        }
        continue;
      }

      const receivedQty = receivedMap.get(key);
      item.receivedQty += receivedQty;

      if (item.receivedQty < item.orderedQty) {
        allMatched = false;
      }

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

const listPurchaseOrders = async (req, res) => {
  try {
    const pos = await PurchaseOrder.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ purchaseOrders: pos });
  } catch (err) {
    console.error('List purchase orders error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const updatePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, purchaseDate, supplierName, notes } = req.body;

    const po = await PurchaseOrder.findById(id);
    if (!po) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    if (status !== undefined) {
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          message: 'Invalid status',
          allowedStatuses,
        });
      }
      po.status = status;
    }

    if (purchaseDate !== undefined) {
      const d = new Date(purchaseDate);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ message: 'Invalid purchaseDate' });
      }
      po.purchaseDate = d;
    }

    if (supplierName !== undefined) {
      po.supplierName = String(supplierName).trim();
    }

    if (notes !== undefined) {
      po.notes = String(notes).trim();
    }

    await po.save();

    res.json({
      message: 'Purchase order updated successfully',
      purchaseOrder: po,
    });
  } catch (err) {
    console.error('Update purchase order error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createPurchaseOrder,
  verifyPurchaseOrder,
  listPurchaseOrders,
  updatePurchaseOrder,
};