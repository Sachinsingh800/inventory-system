// controllers/packing.controller.js
const Barcode = require('../models/Barcode');
const Inventory = require('../models/Inventory');

// POST /api/packing/scan  (ADMIN / PACKER)
// body: { code }
const scanBarcode = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user?.id; // optional, for audit if you want

    if (!code) {
      return res.status(400).json({ message: 'Barcode code is required' });
    }

    const barcode = await Barcode.findOne({ code });
    if (!barcode) {
      return res.status(404).json({ message: 'Barcode not found' });
    }

    if (barcode.status === 'USED') {
      return res.status(400).json({ message: 'Barcode already used' });
    }

    // find printed inventory for this SKU
    const printedInv = await Inventory.findOne({
      productId: barcode.productId,
      type: 'PRINTED',
      designCode: barcode.designCode,
    });

    if (!printedInv || printedInv.quantity <= 0) {
      return res.status(400).json({
        message: 'No printed stock available for this barcode SKU',
      });
    }

    // Deduct 1 from printed stock
    printedInv.quantity -= 1;
    await printedInv.save();

    // Mark barcode as USED
    barcode.status = 'USED';
    barcode.usedAt = new Date();
    // you can optionally store who packed it:
    if (userId) {
      barcode.usedBy = userId;
    }
    await barcode.save();

    res.json({
      message: 'Barcode scanned; printed stock decremented',
      barcode: {
        id: barcode._id,
        code: barcode.code,
        status: barcode.status,
        usedAt: barcode.usedAt,
      },
      inventory: {
        productId: printedInv.productId,
        designCode: printedInv.designCode,
        quantity: printedInv.quantity,
      },
    });
  } catch (err) {
    console.error('Scan barcode error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  scanBarcode,
};