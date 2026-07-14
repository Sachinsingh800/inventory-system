const PrintingJob = require('../models/PrintingJob');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');

// POST /api/printing-jobs  (ADMIN / PRINTER)
const createPrintingJob = async (req, res) => {
  try {
    const { productId, items } = req.body;
    const userId = req.user?.id;

    if (!productId) {
      return res.status(400).json({ message: 'productId is required' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items array is required' });
    }

    for (const item of items) {
      if (!item.designCode || !item.quantity || item.quantity <= 0) {
        return res
          .status(400)
          .json({ message: 'Each item must have designCode and quantity > 0' });
      }
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(400).json({ message: 'Invalid or inactive product' });
    }

    // calculate total demand
    const totalDemand = items.reduce((sum, item) => sum + item.quantity, 0);

    // get raw inventory for this product
    const rawInv = await Inventory.findOne({
      productId,
      type: 'RAW',
      designCode: null,
    });

    if (!rawInv || rawInv.quantity < totalDemand) {
      return res.status(400).json({
        message: 'Insufficient raw stock for printing',
        currentRaw: rawInv ? rawInv.quantity : 0,
        required: totalDemand,
      });
    }

    // BRD logic:
    // 1. Raw stock deducted: newRaw = oldRaw - totalDemand
    rawInv.quantity -= totalDemand;
    await rawInv.save();

    // 2. Printed stock increments per design
    for (const item of items) {
      const { designCode, quantity } = item;

      let printedInv = await Inventory.findOne({
        productId,
        type: 'PRINTED',
        designCode,
      });

      if (!printedInv) {
        printedInv = await Inventory.create({
          productId,
          type: 'PRINTED',
          designCode,
          quantity: quantity,
          minThreshold: 0,
          isActive: true,
        });
      } else {
        printedInv.quantity += quantity;
        await printedInv.save();
      }
    }

    // save printing job record
    const job = await PrintingJob.create({
      productId,
      items,
      totalDemand,
      status: 'COMPLETED',
      createdBy: userId,
    });

    res.status(201).json({
      message: 'Printing job completed; inventory updated',
      printingJob: job,
    });
  } catch (err) {
    console.error('Create printing job error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createPrintingJob };