const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // dynamic attributes keyed by category.metaFields (e.g. brand, model, materialType, sizeVariant)
    attributes: {
      type: Object,
      required: true,
    },
    skuBase: {
      type: String,
      required: true,
      unique: true, // base SKU for raw/printed inventory
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);