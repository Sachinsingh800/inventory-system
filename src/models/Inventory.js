const mongoose = require('mongoose');

// RAW stock belongs to a product/model. PRINTED stock belongs to a product/model
// plus one design. A RAW record must therefore always have designCode: null.
const inventorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    type: {
      type: String,
      enum: ['RAW', 'PRINTED'],
      required: true,
    },
    designCode: {
      type: String,
      default: null,
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    // Number of AVAILABLE labels currently assigned to this PRINTED row.
    // It prevents two barcode-generation requests from labelling more items
    // than are actually in printed stock.
    activeBarcodeCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    minThreshold: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Retained for backward compatibility only. Barcode documents are the
    // authoritative label history, so this array is not updated by the module.
    barcodes: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// This gives one RAW row per product and one PRINTED row per product + design.
inventorySchema.index(
  { productId: 1, type: 1, designCode: 1 },
  { unique: true }
);

module.exports = mongoose.model('Inventory', inventorySchema);
