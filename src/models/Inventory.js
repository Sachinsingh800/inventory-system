// models/Inventory.js
const mongoose = require('mongoose');

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
    // null for RAW, set for PRINTED (e.g. "BUTTERFLY", "BOW_HEART")
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
    minThreshold: {
      type: Number,
      default: 0, // for alerts
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // optional: you can leave this or remove it; our join code does not rely on it
    barcodes: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// Ensure unique combination per inventory line
inventorySchema.index(
  { productId: 1, type: 1, designCode: 1 },
  { unique: true }
);

module.exports = mongoose.model('Inventory', inventorySchema);