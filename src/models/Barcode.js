// models/Barcode.js
const mongoose = require('mongoose');

const barcodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true, // actual barcode/QR string
      trim: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    designCode: {
      type: String,
      required: true, // matches Inventory.designCode for PRINTED
      trim: true,
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'USED'],
      default: 'AVAILABLE',
    },
    usedAt: {
      type: Date,
      default: null,
    },
    // if you want to track who scanned it (optional):
    // usedBy: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: 'User',
    //   default: null,
    // },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Barcode', barcodeSchema);