const crypto = require('crypto');

const Barcode = require('../models/Barcode');
const Inventory = require('../models/Inventory');
const ProductDesign = require('../models/ProductDesign');

const makeBarcodeCode = (designCode) => {
  const safeDesignCode = String(designCode)
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toUpperCase();

  const randomPart = crypto
    .randomUUID()
    .replace(/-/g, '')
    .slice(0, 10)
    .toUpperCase();

  return `PR-${safeDesignCode}-${randomPart}`;
};

// POST /api/barcodes
// body: { productId, designId, quantity }
//
// Flow:
// 1. Check RAW inventory
// 2. Decrease RAW quantity
// 3. Generate barcode records
// 4. Increase PRINTED quantity
const generateBarcodes = async (req, res) => {
  try {
    const { productId, designId, quantity } = req.body;

    if (!productId || !designId) {
      return res.status(400).json({
        message: 'productId and designId are required',
      });
    }

    const barcodeQuantity = Number(quantity);

    if (!Number.isInteger(barcodeQuantity) || barcodeQuantity < 1) {
      return res.status(400).json({
        message: 'quantity must be a whole number greater than 0',
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

    // Remove quantity from selected design RAW inventory.
    const rawInventory = await Inventory.findOneAndUpdate(
      {
        productId,
        type: 'RAW',
        designCode: design.designCode,
        quantity: { $gte: barcodeQuantity },
      },
      {
        $inc: {
          quantity: -barcodeQuantity,
        },
      },
      {
        new: true,
      }
    );

    if (!rawInventory) {
      return res.status(400).json({
        message: `Insufficient RAW stock for design: ${design.designCode}`,
      });
    }

    const barcodeDocuments = Array.from(
      { length: barcodeQuantity },
      () => ({
        code: makeBarcodeCode(design.designCode),
        productId,
        designCode: design.designCode,
        status: 'AVAILABLE',
      })
    );

    let createdBarcodes;

    try {
      createdBarcodes = await Barcode.insertMany(barcodeDocuments);
    } catch (barcodeError) {
      // Restore RAW quantity if barcode creation fails.
      await Inventory.findOneAndUpdate(
        {
          productId,
          type: 'RAW',
          designCode: design.designCode,
        },
        {
          $inc: {
            quantity: barcodeQuantity,
          },
        }
      );

      throw barcodeError;
    }

    const barcodeCodes = createdBarcodes.map((barcode) => barcode.code);

    const printedInventory = await Inventory.findOneAndUpdate(
      {
        productId,
        type: 'PRINTED',
        designCode: design.designCode,
      },
      {
        $inc: {
          quantity: barcodeQuantity,
        },
        $push: {
          barcodes: {
            $each: barcodeCodes,
          },
        },
        $set: {
          isActive: true,
        },
        $setOnInsert: {
          productId,
          type: 'PRINTED',
          designCode: design.designCode,
          minThreshold: 0,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    res.status(201).json({
      message: 'Barcodes generated and stock moved from RAW to PRINTED',
      design: {
        id: design._id,
        name: design.name,
        mode: design.mode,
        designCode: design.designCode,
      },
      rawInventory: {
        id: rawInventory._id,
        quantity: rawInventory.quantity,
      },
      printedInventory: {
        id: printedInventory._id,
        quantity: printedInventory.quantity,
      },
      barcodeCount: createdBarcodes.length,
      barcodes: createdBarcodes,
    });
  } catch (err) {
    console.error('Generate barcodes error:', err);

    if (err.code === 11000) {
      return res.status(409).json({
        message: 'A duplicate barcode was generated. Please try again.',
      });
    }

    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/barcodes/manage/:productId
// Optional query: ?designCode=BUTTERFLY_2
const listBarcodesByProduct = async (req, res) => {
  try {
    const filter = {
      productId: req.params.productId,
    };

    if (req.query.designCode) {
      filter.designCode = req.query.designCode;
    }

    const barcodes = await Barcode.find(filter).sort({ createdAt: -1 });

    const barcodesByDesign = barcodes.reduce((result, barcode) => {
      const designCode = barcode.designCode || 'NO_DESIGN';

      if (!result[designCode]) {
        result[designCode] = [];
      }

      result[designCode].push(barcode);
      return result;
    }, {});

    res.json({
      barcodes,
      barcodesByDesign,
    });
  } catch (err) {
    console.error('List barcodes error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/barcodes/:id/status
// body: { status: 'AVAILABLE' | 'USED' }
const updateBarcodeStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['AVAILABLE', 'USED'].includes(status)) {
      return res.status(400).json({
        message: 'status must be AVAILABLE or USED',
      });
    }

    const barcode = await Barcode.findById(req.params.id);

    if (!barcode) {
      return res.status(404).json({
        message: 'Barcode not found',
      });
    }

    barcode.status = status;
    barcode.usedAt = status === 'USED' ? new Date() : null;

    await barcode.save();

    res.json({
      message: 'Barcode status updated successfully',
      barcode,
    });
  } catch (err) {
    console.error('Update barcode status error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/barcodes/report/today?productId=optionalProductId
const getBarcodeTodayReport = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const filter = {
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    };

    if (req.query.productId) {
      filter.productId = req.query.productId;
    }

    const report = await Barcode.aggregate([
      {
        $match: filter,
      },
      {
        $group: {
          _id: {
            productId: '$productId',
            designCode: '$designCode',
            status: '$status',
          },
          quantity: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          '_id.designCode': 1,
          '_id.status': 1,
        },
      },
    ]);

    const totalGenerated = report.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    res.json({
      totalGenerated,
      report,
    });
  } catch (err) {
    console.error('Get barcode today report error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  generateBarcodes,
  listBarcodesByProduct,
  updateBarcodeStatus,
  getBarcodeTodayReport,
};