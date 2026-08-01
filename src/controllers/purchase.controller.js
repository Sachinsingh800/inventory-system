const mongoose = require('mongoose');
const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');
const ProductDesign = require('../models/ProductDesign');
const Inventory = require('../models/Inventory');

// ---------- Helper: build text summary ----------
const buildTextSummary = async (items) => {
  const parts = [];
  for (const item of items) {
    const product = await Product.findById(item.productId).select('name');
    const design = await ProductDesign.findById(item.designId).select('name designCode');
    const pName = product ? product.name : 'Unknown Product';
    const dName = design ? `${design.name} (${design.designCode})` : 'Unknown Design';
    parts.push(`${pName} - ${dName} - ${item.orderedQty}pcs`);
  }
  return parts.join(', ');
};

// ---------- CREATE ----------
const createPurchaseOrder = async (req, res) => {
  try {
    const { supplierName, notes, items, purchaseDate } = req.body;
    const userId = req.user?.id;

    if (!supplierName || typeof supplierName !== 'string') {
      return res.status(400).json({ message: 'supplierName is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items array is required' });
    }

    for (const item of items) {
      if (!item.productId || !item.designId || !item.designCode) {
        return res.status(400).json({
          message: 'Each item must have productId, designId, designCode, and orderedQty',
        });
      }
      if (!item.orderedQty || item.orderedQty <= 0) {
        return res.status(400).json({
          message: 'orderedQty must be > 0 for each item',
        });
      }
      const design = await ProductDesign.findOne({
        _id: item.designId,
        productId: item.productId,
        isActive: true,
      });
      if (!design) {
        return res.status(400).json({
          message: `Design ${item.designId} is not valid for product ${item.productId}`,
        });
      }
    }

    const textSummary = await buildTextSummary(items);
    const po = await PurchaseOrder.create({
      supplierName: supplierName.trim(),
      notes: notes ? String(notes).trim() : '',
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      items,
      status: 'PENDING',
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

// ---------- VERIFY ----------
const verifyPurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body; // [{ productId, designCode, receivedQty }]

    console.log('🔍 Verification started for PO:', id);
    console.log('📦 Received items:', JSON.stringify(items, null, 2));

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items array is required' });
    }

    const po = await PurchaseOrder.findById(id);
    if (!po) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    if (po.status !== 'PENDING') {
      return res.status(400).json({ message: 'Order is already verified' });
    }

    // Build map (productId + designCode) -> receivedQty
    const receivedMap = new Map();
    for (const item of items) {
      if (!item.productId || item.receivedQty == null || item.receivedQty < 0) {
        return res.status(400).json({
          message: 'Each item must have productId and receivedQty >= 0',
        });
      }
      if (!item.designCode) {
        return res.status(400).json({ message: 'Each item must have designCode' });
      }
      const key = `${String(item.productId)}|${String(item.designCode).trim().toUpperCase()}`;
      receivedMap.set(key, Number(item.receivedQty));
    }

    console.log('🗺️ Received map:', Array.from(receivedMap.entries()));

    const affectedProductIds = new Set();

    // Process each order item
    for (const orderItem of po.items) {
      const orderDesignCode = String(orderItem.designCode).trim().toUpperCase();
      const key = `${String(orderItem.productId)}|${orderDesignCode}`;
      const receivedQty = receivedMap.get(key) || 0;

      console.log(`🔹 Processing: productId=${orderItem.productId}, designCode=${orderDesignCode}, receivedQty=${receivedQty}`);

      orderItem.receivedQty = receivedQty;

      if (receivedQty > 0) {
        // 1️⃣ Update / create design‑specific inventory (using returnDocument)
        const rawInventory = await Inventory.findOneAndUpdate(
          {
            productId: orderItem.productId,
            type: 'RAW',
            designCode: orderDesignCode,
          },
          {
            $inc: { quantity: receivedQty },
            $set: { isActive: true },
            $setOnInsert: {
              productId: orderItem.productId,
              type: 'RAW',
              designCode: orderDesignCode,
              minThreshold: 0,
              barcodes: [],
            },
          },
          {
            returnDocument: 'after',   // instead of new: true
            upsert: true,
            runValidators: true,
          }
        );
        console.log(`✅ Inventory updated: ${rawInventory._id} -> ${rawInventory.quantity}`);

        affectedProductIds.add(String(orderItem.productId));
      } else {
        console.log(`⚠️ receivedQty is 0, skipping inventory update.`);
      }
    }

    // 2️⃣ Recalculate product rawQuantity for all affected products
    for (const productId of affectedProductIds) {
      const totalRaw = await Inventory.aggregate([
        {
          $match: {
            productId: new mongoose.Types.ObjectId(productId),
            type: 'RAW',
          },
        },
        { $group: { _id: null, total: { $sum: '$quantity' } } },
      ]);

      const newTotal = totalRaw.length > 0 ? totalRaw[0].total : 0;

      const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        { $set: { rawQuantity: newTotal } },
        { new: true, upsert: false }
      );

      if (updatedProduct) {
        console.log(`✅ Product rawQuantity recalculated: ${updatedProduct.name} -> ${updatedProduct.rawQuantity}`);
      } else {
        console.warn(`⚠️ Product not found for ID: ${productId}`);
      }
    }

    po.status = 'VERIFIED';
    await po.save();

    res.json({
      message: 'Purchase order verified and stock updated (design + product aggregate)',
      purchaseOrder: po,
    });
  } catch (err) {
    console.error('❌ Verify error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- LIST ----------
const listPurchaseOrders = async (req, res) => {
  try {
    const pos = await PurchaseOrder.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('items.productId', 'name')
      .populate('items.designId', 'name designCode')
      .lean();
    res.json({ purchaseOrders: pos });
  } catch (err) {
    console.error('List purchase orders error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- UPDATE ----------
const updatePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { purchaseDate, supplierName, notes } = req.body;

    const po = await PurchaseOrder.findById(id);
    if (!po) return res.status(404).json({ message: 'Order not found' });

    if (po.status !== 'PENDING') {
      return res.status(400).json({ message: 'Only PENDING orders can be updated' });
    }

    if (purchaseDate) {
      const d = new Date(purchaseDate);
      if (isNaN(d.getTime())) return res.status(400).json({ message: 'Invalid date' });
      po.purchaseDate = d;
    }
    if (supplierName) po.supplierName = supplierName.trim();
    if (notes !== undefined) po.notes = notes.trim();

    await po.save();
    res.json({ message: 'Order updated', purchaseOrder: po });
  } catch (err) {
    console.error('Update error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createPurchaseOrder,
  verifyPurchaseOrder,
  listPurchaseOrders,
  updatePurchaseOrder,
};