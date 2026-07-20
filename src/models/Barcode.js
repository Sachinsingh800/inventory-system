const mongoose = require('mongoose');

const barcodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    designCode: {
      type: String,
      required: true,
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
  },
  { timestamps: true }
);

module.exports = mongoose.model('Barcode', barcodeSchema);