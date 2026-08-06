const mongoose = require("mongoose");

const printingJobSchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    designId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductDesign",
      required: true,
    },
    designCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "CANCELLED"],
      default: "PENDING",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    inventoryAdded: {
      type: Boolean,
      default: false,
    },
    minThreshold: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PrintingJob", printingJobSchema);
