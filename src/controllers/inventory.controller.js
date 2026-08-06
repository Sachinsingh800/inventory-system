// src/controllers/inventoryController.js
const mongoose = require('mongoose');

const Inventory = require('../models/Inventory');
const ProductDesign = require('../models/ProductDesign');
const Barcode = require('../models/Barcode');

// POST /api/inventory/raw/design
// body: { productId, designId, quantity, minThreshold? }
const addDesignToRawInventory = async (req, res) => {
  try {
    const { productId, designId, quantity, minThreshold } = req.body;

    if (!productId || !designId) {
      return res.status(400).json({
        message: 'productId and designId are required',
      });
    }

    if (!quantity || Number(quantity) < 1) {
      return res.status(400).json({
        message: 'quantity must be greater than 0',
      });
    }

    const design = await ProductDesign.findOne({
      _id: designId,
      productId,
      isActive: true,
    });

    if (!design) {
      return res.status(400).json({
        message: 'Selected model/design does not belong to this product',
      });
    }

    const inventory = await Inventory.findOneAndUpdate(
      {
        productId,
        type: 'RAW',
        designCode: design.designCode,
      },
      {
        $inc: {
          quantity: Number(quantity),
        },
        $set: {
          isActive: true,
        },
        $setOnInsert: {
          productId,
          type: 'RAW',
          designCode: design.designCode,
          minThreshold: minThreshold ?? 0,
          barcodes: [],
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    return res.status(201).json({
      message: 'Model/design added to RAW inventory successfully',
      inventory,
    });
  } catch (err) {
    console.error('Add design raw inventory error:', err);

    return res.status(500).json({
      message: 'Server error',
    });
  }
};

// POST /api/inventory/transfer-to-printed
// body: { productId, designId, quantity }
const transferRawToPrintedInventory = async (req, res) => {
  try {
    const { productId, designId, quantity } = req.body;

    if (!productId || !designId) {
      return res.status(400).json({
        message: 'productId and designId are required',
      });
    }

    if (!quantity || Number(quantity) < 1) {
      return res.status(400).json({
        message: 'quantity must be greater than 0',
      });
    }

    const design = await ProductDesign.findOne({
      _id: designId,
      productId,
      isActive: true,
    });

    if (!design) {
      return res.status(400).json({
        message: 'Selected model/design does not belong to this product',
      });
    }

    const moveQuantity = Number(quantity);

    const rawInventory = await Inventory.findOneAndUpdate(
      {
        productId,
        type: 'RAW',
        designCode: design.designCode,
        quantity: { $gte: moveQuantity },
      },
      {
        $inc: {
          quantity: -moveQuantity,
        },
      },
      { new: true }
    );

    if (!rawInventory) {
      return res.status(400).json({
        message: 'Insufficient RAW inventory for this model/design',
      });
    }

    const printedInventory = await Inventory.findOneAndUpdate(
      {
        productId,
        type: 'PRINTED',
        designCode: design.designCode,
      },
      {
        $inc: {
          quantity: moveQuantity,
        },
        $set: {
          isActive: true,
        },
        $setOnInsert: {
          productId,
          type: 'PRINTED',
          designCode: design.designCode,
          minThreshold: 0,
          barcodes: [],
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    return res.json({
      message: 'RAW stock transferred to PRINTED stock successfully',
      rawInventory,
      printedInventory,
    });
  } catch (err) {
    console.error('Transfer RAW to PRINTED inventory error:', err);

    return res.status(500).json({
      message: 'Server error',
    });
  }
};

// GET /api/inventory/design/:productId
// Now includes designUrl from ProductDesign lookup
const getDesignInventoryByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        message: 'Invalid product ID',
      });
    }

    // Fetch active inventory with a design code
    const inventory = await Inventory.find({
      productId,
      designCode: { $ne: null },
      isActive: true,
    })
      .sort({ type: 1, designCode: 1 })
      .lean();

    // Barcode stats per designCode
    const barcodeStats = await Barcode.aggregate([
      {
        $match: {
          productId: new mongoose.Types.ObjectId(productId),
        },
      },
      {
        $group: {
          _id: '$designCode',
          totalBarcodes: { $sum: 1 },
          availableBarcodes: {
            $sum: { $cond: [{ $eq: ['$status', 'AVAILABLE'] }, 1, 0] },
          },
          usedBarcodes: {
            $sum: { $cond: [{ $eq: ['$status', 'USED'] }, 1, 0] },
          },
        },
      },
    ]);

    const barcodeStatsByDesign = {};
    barcodeStats.forEach((item) => {
      barcodeStatsByDesign[item._id] = {
        totalBarcodes: item.totalBarcodes,
        availableBarcodes: item.availableBarcodes,
        usedBarcodes: item.usedBarcodes,
      };
    });

    // Gather all unique designCodes to fetch designUrls
    const designCodes = [...new Set(inventory.map(row => row.designCode))];
    const designs = await ProductDesign.find({
      designCode: { $in: designCodes },
      isActive: true,
    })
      .select('designCode designUrl name mode')
      .lean();

    const designMap = {};
    designs.forEach(d => {
      designMap[d.designCode] = d;
    });

    // Build detailed response
    const detailedInventory = inventory.map((row) => {
      const stats = barcodeStatsByDesign[row.designCode] || {
        totalBarcodes: 0,
        availableBarcodes: 0,
        usedBarcodes: 0,
      };
      const design = designMap[row.designCode] || {};

      return {
        ...row,
        totalBarcodes: stats.totalBarcodes,
        availableBarcodes: stats.availableBarcodes,
        usedBarcodes: stats.usedBarcodes,
        designName: design.name || null,
        mode: design.mode || null,
        designUrl: design.designUrl || '',   // 🆕 designUrl from ProductDesign
      };
    });

    return res.json({
      inventory: detailedInventory,
    });
  } catch (err) {
    console.error('Get design inventory error:', err);

    return res.status(500).json({
      message: 'Server error',
    });
  }
};

// PATCH /api/inventory/:id – Update minThreshold
const updateInventoryThreshold = async (req, res) => {
  try {
    const { id } = req.params;
    const { minThreshold } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid inventory ID' });
    }

    const threshold = Number(minThreshold);
    if (minThreshold === undefined || isNaN(threshold) || threshold < 0) {
      return res.status(400).json({ message: 'minThreshold must be a non-negative number' });
    }

    const updated = await Inventory.findByIdAndUpdate(
      id,
      { $set: { minThreshold: threshold } },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Inventory record not found' });
    }

    return res.json({ message: 'Threshold updated', inventory: updated });
  } catch (err) {
    console.error('Update inventory threshold error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/inventory/low-stock
// Already includes designUrl in the $project (as shown in the original code)
const getLowStockInventory = async (req, res) => {
  try {
    const lowStockItems = await Inventory.aggregate([
      {
        $match: {
          isActive: true,
          minThreshold: { $gt: 0 },
          $expr: { $lte: ['$quantity', '$minThreshold'] },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'productdesigns',
          let: { code: '$designCode' },
          pipeline: [
            { $match: { $expr: { $eq: ['$designCode', '$$code'] } } },
            { $project: { name: 1, mode: 1, designCode: 1, designUrl: 1 } },
          ],
          as: 'design',
        },
      },
      { $unwind: { path: '$design', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          productId: 1,
          productName: '$product.name',
          designCode: 1,
          designName: '$design.name',
          mode: '$design.mode',
          designUrl: '$design.designUrl',   // ✅ designUrl already present
          quantity: 1,
          minThreshold: 1,
          deficit: { $subtract: ['$minThreshold', '$quantity'] },
          type: 1,
        },
      },
      { $sort: { deficit: -1 } },
    ]);

    return res.json({ lowStockItems });
  } catch (err) {
    console.error('Low-stock query error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  addDesignToRawInventory,
  transferRawToPrintedInventory,
  getDesignInventoryByProduct,
  updateInventoryThreshold,
  getLowStockInventory,
};