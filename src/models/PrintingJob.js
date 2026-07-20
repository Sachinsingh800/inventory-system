// models/PrintingJob.js
const mongoose = require('mongoose');

const printingItemSchema = new mongoose.Schema(
  {
    designCode: {
      type: String,
      required: true, // e.g. "BUTTERFLY", "BOW_HEART"
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const printingJobSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    items: {
      type: [printingItemSchema],
      required: true,
    },
    totalDemand: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PrintingJob', printingJobSchema);