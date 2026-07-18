// controllers/printing.controller.js
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

    // 1. Raw stock deducted
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

    return res.status(201).json({
      message: 'Printing job completed; inventory updated',
      printingJob: job,
    });
  } catch (err) {
    console.error('Create printing job error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/printing-jobs  (list all, optional ?productId=)
const listPrintingJobs = async (req, res) => {
  try {
    const { productId } = req.query;
    const filter = {};
    if (productId) {
      filter.productId = productId;
    }

    const jobs = await PrintingJob.find(filter)
      .populate('productId', 'name')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({ jobs });
  } catch (err) {
    console.error('List printing jobs error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/printing-jobs/:id
const getPrintingJobById = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await PrintingJob.findById(id)
      .populate('productId', 'name')
      .populate('createdBy', 'name email');

    if (!job) {
      return res.status(404).json({ message: 'Printing job not found' });
    }

    return res.status(200).json({ printingJob: job });
  } catch (err) {
    console.error('Get printing job error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/printing-jobs/:id   (e.g. update status/notes)
const updatePrintingJob = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['status', 'notes'];
    const update = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        update[key] = req.body[key];
      }
    }

    const job = await PrintingJob.findByIdAndUpdate(id, update, {
      new: true,
    });

    if (!job) {
      return res.status(404).json({ message: 'Printing job not found' });
    }

    return res.status(200).json({ printingJob: job });
  } catch (err) {
    console.error('Update printing job error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/printing-jobs/:id
const deletePrintingJob = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await PrintingJob.findByIdAndDelete(id);

    if (!job) {
      return res.status(404).json({ message: 'Printing job not found' });
    }

    return res
      .status(200)
      .json({ message: 'Printing job deleted successfully' });
  } catch (err) {
    console.error('Delete printing job error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/printing-jobs/designs/:productId
// all PRINTED designs for one product (for barcode screen)
const getPrintedDesignsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({ message: 'Product not found or inactive' });
    }

    const designs = await Inventory.find({
      productId,
      type: 'PRINTED',
    }).select('designCode quantity minThreshold isActive');

    return res.status(200).json({
      productId,
      productName: product.name,
      designs,
    });
  } catch (err) {
    console.error('Get printed designs error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createPrintingJob,
  listPrintingJobs,
  getPrintingJobById,
  updatePrintingJob,
  deletePrintingJob,
  getPrintedDesignsByProduct,
};