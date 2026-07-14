const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    orderedQty: {
      type: Number,
      required: true,
      min: 1,
    },
    receivedQty: {
      type: Number,
      default: 0,
      min: 0,
    }
  },
  { _id: false }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    supplierName: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    items: {
      type: [purchaseItemSchema],
      required: true,
    },
    status: {
      type: String,
      enum: ['CREATED', 'VERIFIED', 'PARTIAL'],
      default: 'CREATED',
    },
    // optional plain text summary for WhatsApp
    textSummary: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);