const Barcode = require('../models/Barcode');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const { v4: uuidv4 } = require('uuid'); // install: npm install uuid

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

module.exports = { generateBarcodes };