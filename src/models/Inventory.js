// src/models/Inventory.js
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
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    barcodes: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

inventorySchema.index(
  { productId: 1, type: 1, designCode: 1 },
  { unique: true }
);

module.exports = mongoose.model('Inventory', inventorySchema);