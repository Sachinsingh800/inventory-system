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
const getDesignInventoryByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        message: 'Invalid product ID',
      });
    }

    const inventory = await Inventory.find({
      productId,
      designCode: { $ne: null },
      isActive: true,
    })
      .sort({ type: 1, designCode: 1 })
      .lean();

    // Barcode status comes from Barcode collection.
    const barcodeStats = await Barcode.aggregate([
      {
        $match: {
          productId: new mongoose.Types.ObjectId(productId),
        },
      },
      {
        $group: {
          _id: '$designCode',
          totalBarcodes: {
            $sum: 1,
          },
          availableBarcodes: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'AVAILABLE'] },
                1,
                0,
              ],
            },
          },
          usedBarcodes: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'USED'] },
                1,
                0,
              ],
            },
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

    const detailedInventory = inventory.map((row) => {
      const stats = barcodeStatsByDesign[row.designCode] || {
        totalBarcodes: 0,
        availableBarcodes: 0,
        usedBarcodes: 0,
      };

      return {
        ...row,
        totalBarcodes: stats.totalBarcodes,
        availableBarcodes: stats.availableBarcodes,
        usedBarcodes: stats.usedBarcodes,
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

module.exports = {
  addDesignToRawInventory,
  transferRawToPrintedInventory,
  getDesignInventoryByProduct,
};