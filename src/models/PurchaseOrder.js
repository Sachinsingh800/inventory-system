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
    },
  },
  { _id: false }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    supplierName: {
      type: String,
      required: true,   // every PO must have supplier
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    items: {
      type: [purchaseItemSchema],
      required: true,
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one item is required in a purchase order',
      },
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
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);