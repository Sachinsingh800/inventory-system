const crypto = require('crypto');
const mongoose = require('mongoose');
const Barcode = require('../models/Barcode');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const ProductDesign = require('../models/ProductDesign');

const makeBarcodeCode = (designCode) => {
  const clean = String(designCode).trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
  return `PR-${clean}-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
};

const generateBarcodes = async (req, res) => {
  let session;
  try {
    const { productId, designId } = req.body;
    if (!productId || !designId) {
      return res.status(400).json({ message: 'productId and designId are required' });
    }

    const design = await ProductDesign.findOne({
      _id: designId,
      productId,
      isActive: true,
    }).lean();
    if (!design) {
      return res.status(400).json({
        message: 'Selected model/design does not belong to this product',
      });
    }

    session = await mongoose.startSession();
    let barcodes;
    let printedInventory;

    await session.withTransaction(async () => {
      // Printing jobs already move stock from RAW to PRINTED. Barcode creation
      // only labels the remaining unlabelled PRINTED units; it never moves stock.
      printedInventory = await Inventory.findOne({
        productId,
        type: 'PRINTED',
        designCode: design.designCode,
        isActive: true,
      }).session(session);

      if (!printedInventory || printedInventory.quantity < 1) {
        throw new Error('No PRINTED stock exists for this design');
      }

      const availableCount = await Barcode.countDocuments({
        productId,
        designCode: design.designCode,
        status: 'AVAILABLE',
      }).session(session);
      const count = printedInventory.quantity - availableCount;

      if (count < 1) {
        throw new Error('All current PRINTED stock for this design already has barcodes');
      }

      barcodes = await Barcode.insertMany(
        Array.from({ length: count }, () => ({
          code: makeBarcodeCode(design.designCode),
          productId,
          designCode: design.designCode,
          status: 'AVAILABLE',
        })),
        { session, ordered: true },
      );

      // Keep the inventory label counter accurate for the barcode scan flow.
      // `availableCount` also supports barcode records created before this change.
      printedInventory = await Inventory.findOneAndUpdate(
        { _id: printedInventory._id, quantity: printedInventory.quantity },
        { $set: { activeBarcodeCount: availableCount + count } },
        { new: true, session },
      );
      if (!printedInventory) {
        throw new Error('PRINTED inventory changed; please generate barcodes again');
      }
    });

    return res.status(201).json({
      message: `${barcodes.length} barcode(s) generated from PRINTED stock`,
      design: {
        id: design._id,
        name: design.name,
        mode: design.mode,
        designCode: design.designCode,
      },
      printedInventory: {
        id: printedInventory._id,
        quantity: printedInventory.quantity,
      },
      barcodeCount: barcodes.length,
      barcodes,
    });
  } catch (error) {
    if (
      error.message.includes('PRINTED stock') ||
      error.message.includes('already has barcodes') ||
      error.message.includes('PRINTED inventory changed')
    ) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Generate barcodes error:', error);
    return res.status(error.code === 11000 ? 409 : 500).json({
      message:
        error.code === 11000
          ? 'A duplicate barcode was generated. Please try again.'
          : 'Server error',
    });
  } finally {
    if (session) await session.endSession();
  }
};
const listBarcodesByProduct = async (req, res) => {
  try {
    const filter = { productId: req.params.productId };
    if (req.query.designCode) filter.designCode = req.query.designCode;
    const barcodes = await Barcode.find(filter).sort({ createdAt: -1 });
    const barcodesByDesign = barcodes.reduce((result, barcode) => { const key = barcode.designCode || 'NO_DESIGN'; (result[key] ||= []).push(barcode); return result; }, {});
    res.json({ barcodes, barcodesByDesign });
  } catch (error) { console.error('List barcodes error:', error); res.status(500).json({ message: 'Server error' }); }
};

const updateBarcodeStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['AVAILABLE', 'USED'].includes(status)) return res.status(400).json({ message: 'status must be AVAILABLE or USED' });
    const barcode = await Barcode.findById(req.params.id);
    if (!barcode) return res.status(404).json({ message: 'Barcode not found' });
    barcode.status = status;
    barcode.usedAt = status === 'USED' ? new Date() : null;
    await barcode.save();
    res.json({ message: 'Barcode status updated successfully', barcode });
  } catch (error) { console.error('Update barcode status error:', error); res.status(500).json({ message: 'Server error' }); }
};

// GET /api/barcodes/packed?from=YYYY-MM-DD&to=YYYY-MM-DD&productId=...&page=1&limit=50
// "Packed" means the barcode status is USED. The date shown is usedAt.
const getPackedBarcodes = async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
    const filter = { status: 'USED', usedAt: { $ne: null } };
    if (req.query.productId) filter.productId = req.query.productId;
    if (req.query.designCode) filter.designCode = String(req.query.designCode).trim();
    if (req.query.from || req.query.to) {
      filter.usedAt = {};
      if (req.query.from) { const from = new Date(`${req.query.from}T00:00:00.000`); if (Number.isNaN(from.getTime())) return res.status(400).json({ message: 'from must be YYYY-MM-DD' }); filter.usedAt.$gte = from; }
      if (req.query.to) { const to = new Date(`${req.query.to}T23:59:59.999`); if (Number.isNaN(to.getTime())) return res.status(400).json({ message: 'to must be YYYY-MM-DD' }); filter.usedAt.$lte = to; }
    }
    const [totalPacked, barcodes] = await Promise.all([Barcode.countDocuments(filter), Barcode.find(filter).sort({ usedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean()]);
    const productIds = [...new Set(barcodes.map((barcode) => String(barcode.productId)))];
    const designPairs = [...new Map(barcodes.map((barcode) => [`${barcode.productId}:${barcode.designCode}`, { productId: barcode.productId, designCode: barcode.designCode }])).values()];
    const [products, designs] = await Promise.all([
      Product.find({ _id: { $in: productIds } }).select('_id name skuBase categoryId').lean(),
      designPairs.length ? ProductDesign.find({ $or: designPairs }).select('_id productId name mode designCode designUrl').lean() : [],
    ]);
    const productMap = new Map(products.map((product) => [String(product._id), product]));
    const designMap = new Map(designs.map((design) => [`${design.productId}:${design.designCode}`, design]));
    const packedItems = barcodes.map((barcode) => {
      const product = productMap.get(String(barcode.productId));
      const design = designMap.get(`${barcode.productId}:${barcode.designCode}`);
      return { barcodeId: barcode._id, barcode: barcode.code, status: barcode.status, packedAt: barcode.usedAt, product: product ? { id: product._id, name: product.name, skuBase: product.skuBase, categoryId: product.categoryId } : null, design: { id: design?._id || null, name: design?.name || barcode.designCode, mode: design?.mode || null, code: barcode.designCode, image: design?.designUrl || null } };
    });
    res.json({ totalPacked, page, limit, totalPages: Math.ceil(totalPacked / limit), packedItems });
  } catch (error) { console.error('Get packed barcodes error:', error); res.status(500).json({ message: 'Server error' }); }
};

const getBarcodeTodayReport = async (req, res) => {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const filter = { createdAt: { $gte: start, $lte: end } };
    if (req.query.productId) filter.productId = req.query.productId;
    const report = await Barcode.aggregate([{ $match: filter }, { $group: { _id: { productId: '$productId', designCode: '$designCode', status: '$status' }, quantity: { $sum: 1 } } }, { $sort: { '_id.designCode': 1, '_id.status': 1 } }]);
    res.json({ totalGenerated: report.reduce((sum, item) => sum + item.quantity, 0), report });
  } catch (error) { console.error('Get barcode today report error:', error); res.status(500).json({ message: 'Server error' }); }
};

module.exports = { generateBarcodes, listBarcodesByProduct, updateBarcodeStatus, getBarcodeTodayReport, getPackedBarcodes };
