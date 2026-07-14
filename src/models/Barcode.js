const mongoose = require('mongoose');

const barcodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,   // actual barcode/QR string
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
    packingSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PackingSession',
      default: null,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Barcode', barcodeSchema);