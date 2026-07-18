// controllers/barcode.controller.js
const Barcode = require('../models/Barcode');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const { v4: uuidv4 } = require('uuid'); // npm install uuid

// POST /api/barcodes  (ADMIN / PRINTER)
// body: { productId, designCode, quantity }
const generateBarcodes = async (req, res) => {
  try {
    const { productId, designCode, quantity } = req.body;

    if (!productId || !designCode || !quantity || quantity <= 0) {
      return res.status(400).json({
        message: 'productId, designCode and quantity > 0 are required',
      });
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(400).json({ message: 'Invalid or inactive product' });
    }

    // optional: check there is printed stock for this SKU
    const printedInv = await Inventory.findOne({
      productId,
      type: 'PRINTED',
      designCode,
    });

    if (!printedInv || printedInv.quantity < quantity) {
      return res.status(400).json({
        message: 'Not enough printed stock to generate labels',
        available: printedInv ? printedInv.quantity : 0,
        requested: quantity,
      });
    }

    const barcodes = [];

    for (let i = 0; i < quantity; i++) {
      const code = `${product.skuBase}-${designCode}-${uuidv4()}`; // unique code

      const barcode = await Barcode.create({
        code,
        productId,
        designCode,
        status: 'AVAILABLE',
      });

      barcodes.push(barcode);
    }

    res.status(201).json({
      message: 'Barcodes generated successfully',
      barcodes,
    });
  } catch (err) {
    console.error('Generate barcodes error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/barcodes/manage/:productId  (ADMIN / PRINTER)
// returns barcodes grouped by designCode for one product
const listBarcodesByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    // Guard against missing/invalid productId
    if (!productId || productId === 'undefined') {
      console.error('listBarcodesByProduct invalid productId:', productId);
      return res.status(400).json({ message: 'Invalid productId in URL' });
    }

    const barcodes = await Barcode.find({ productId }).sort({
      designCode: 1,
      createdAt: -1,
    });

    // group by designCode
    const byDesign = {};
    for (const b of barcodes) {
      const key = b.designCode;
      if (!byDesign[key]) {
        byDesign[key] = [];
      }
      byDesign[key].push(b);
    }

    res.json({ barcodesByDesign: byDesign });
  } catch (err) {
    console.error('List barcodes by product error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/barcodes/:id/status  (ADMIN / PRINTER)
// body: { status: 'AVAILABLE' | 'USED' }
const updateBarcodeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['AVAILABLE', 'USED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const barcode = await Barcode.findById(id);
    if (!barcode) {
      return res.status(404).json({ message: 'Barcode not found' });
    }

    barcode.status = status;
    barcode.usedAt = status === 'USED' ? new Date() : null;
    // packingSessionId stays as-is; you can later link it from scan flow
    await barcode.save();

    res.json({
      message: 'Barcode status updated',
      barcode,
    });
  } catch (err) {
    console.error('Update barcode status error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  generateBarcodes,
  listBarcodesByProduct,
  updateBarcodeStatus,
};