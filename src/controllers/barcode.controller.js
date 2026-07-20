const mongoose = require('mongoose');
const Barcode = require('../models/Barcode');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const { v4: uuidv4 } = require('uuid');

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
      const code = `${product.skuBase}-${designCode}-${uuidv4()}`;
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

const listBarcodesByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId || productId === 'undefined' || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid productId in URL' });
    }

    const barcodes = await Barcode.find({ productId }).sort({
      designCode: 1,
      createdAt: -1,
    });

    const byDesign = {};
    for (const b of barcodes) {
      if (!byDesign[b.designCode]) byDesign[b.designCode] = [];
      byDesign[b.designCode].push(b);
    }

    res.json({ barcodesByDesign: byDesign });
  } catch (err) {
    console.error('List barcodes by product error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateBarcodeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid barcode id' });
    }

    if (!['AVAILABLE', 'USED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const barcode = await Barcode.findById(id);
    if (!barcode) {
      return res.status(404).json({ message: 'Barcode not found' });
    }

    barcode.status = status;
    barcode.usedAt = status === 'USED' ? new Date() : null;
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

const getBarcodeTodayReport = async (req, res) => {
  try {
    const { productId } = req.query;

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const productMatch = {};
    if (productId) {
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid productId' });
      }
      productMatch.productId = new mongoose.Types.ObjectId(productId);
    }

    const generatedAgg = await Barcode.aggregate([
      { $match: productMatch },
      {
        $group: {
          _id: '$productId',
          generatedTotal: { $sum: 1 },
        },
      },
    ]);

    const usedTodayAgg = await Barcode.aggregate([
      {
        $match: {
          ...productMatch,
          status: 'USED',
          usedAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$productId',
          scannedToday: { $sum: 1 },
          barcodes: {
            $push: {
              id: '$_id',
              code: '$code',
              designCode: '$designCode',
              usedAt: '$usedAt',
            },
          },
        },
      },
    ]);

    const totalUsedAgg = await Barcode.aggregate([
      {
        $match: {
          ...productMatch,
          status: 'USED',
        },
      },
      {
        $group: {
          _id: '$productId',
          totalScanned: { $sum: 1 },
        },
      },
    ]);

    const productIds = [
      ...new Set([
        ...generatedAgg.map((x) => String(x._id)),
        ...usedTodayAgg.map((x) => String(x._id)),
        ...totalUsedAgg.map((x) => String(x._id)),
      ]),
    ];

    const products = await Product.find({ _id: { $in: productIds } })
      .select('name skuBase categoryId')
      .lean();

    const productMap = new Map(products.map((p) => [String(p._id), p]));
    const generatedMap = new Map(generatedAgg.map((x) => [String(x._id), x.generatedTotal]));
    const usedTodayMap = new Map(usedTodayAgg.map((x) => [String(x._id), x]));
    const totalUsedMap = new Map(totalUsedAgg.map((x) => [String(x._id), x.totalScanned]));

    const report = productIds.map((pid) => {
      const generatedTotal = generatedMap.get(pid) || 0;
      const todayObj = usedTodayMap.get(pid);
      const scannedToday = todayObj?.scannedToday || 0;
      const totalScanned = totalUsedMap.get(pid) || 0;
      const remaining = Math.max(generatedTotal - totalScanned, 0);
      const p = productMap.get(pid);

      return {
        productId: pid,
        productName: p?.name || 'Unknown Product',
        skuBase: p?.skuBase || '',
        categoryId: p?.categoryId || null,
        generatedTotal,
        scannedToday,
        totalScanned,
        remaining,
        todayScannedBarcodes: todayObj?.barcodes || [],
      };
    });

    report.sort((a, b) => b.scannedToday - a.scannedToday);

    res.json({
      date: 'today',
      scanDate: new Date().toISOString(),
      start,
      end,
      count: report.length,
      report,
    });
  } catch (err) {
    console.error('Get barcode today report error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  generateBarcodes,
  listBarcodesByProduct,
  updateBarcodeStatus,
  getBarcodeTodayReport,
};