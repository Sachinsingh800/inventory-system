const PrintingJob = require("../models/PrintingJob");
const ProductDesign = require("../models/ProductDesign");
const Inventory = require("../models/Inventory");

// POST /api/printing-jobs
// Adds selected model/design quantity to RAW inventory.
const createPrintingJob = async (req, res) => {
  try {
    const {
      categoryId,
      productId,
      designId,
      quantity,
      status = "PENDING",
      notes = "",
      minThreshold, // optional, from client
    } = req.body;

    if (!categoryId || !productId || !designId) {
      return res.status(400).json({
        message: "productId and designId are required",
      });
    }

    if (!quantity || Number(quantity) < 1) {
      return res.status(400).json({
        message: "quantity must be greater than 0",
      });
    }

    if (!["PENDING", "COMPLETED", "CANCELLED"].includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
      });
    }

    // Validate and default minThreshold
    let threshold = 0;
    if (minThreshold !== undefined) {
      threshold = Number(minThreshold);
      if (isNaN(threshold) || threshold < 0) {
        return res.status(400).json({
          message: "minThreshold must be a non-negative number",
        });
      }
    }

    const design = await ProductDesign.findOne({
      _id: designId,
      productId,
      isActive: true,
    });

    if (!design) {
      return res.status(400).json({
        message: "Selected model/design is invalid for this product",
      });
    }

    // Add to RAW inventory only.
    const rawInventory = await Inventory.findOneAndUpdate(
      {
        productId,
        type: "RAW",
        designCode: design.designCode,
      },
      {
        $inc: {
          quantity: Number(quantity),
        },
        $set: {
          isActive: true,
          minThreshold: threshold, // use the validated value
        },
        $setOnInsert: {
          productId,
          type: "RAW",
          designCode: design.designCode,
          barcodes: [],
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      },
    );

    // Save history only.
    const printingJob = await PrintingJob.create({
      categoryId,
      productId,
      designId,
      designCode: design.designCode,
      quantity: Number(quantity),
      status,
      notes,
      inventoryAdded: false,
      minThreshold: threshold, // store for audit trail
      createdBy: req.user?._id || req.user?.id,
    });

    return res.status(201).json({
      message: "Model/design quantity added to RAW inventory successfully",
      printingJob,
      rawInventory,
    });
  } catch (err) {
    console.error("Create printing job error:", err);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// GET /api/printing-jobs
const listPrintingJobs = async (req, res) => {
  try {
    const printingJobs = await PrintingJob.find()
      .populate({
        path: "productId",
        select: "name skuBase categoryId",
        populate: { path: "categoryId", select: "name" },
      })
      .populate("designId", "name mode designCode")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return res.json({ printingJobs });
  } catch (err) {
    console.error("List printing jobs error:", err);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// GET /api/printing-jobs/:id
const getPrintingJobById = async (req, res) => {
  try {
    const printingJob = await PrintingJob.findById(req.params.id)
      .populate({
        path: "productId",
        select: "name skuBase categoryId",
        populate: { path: "categoryId", select: "name" },
      })
      .populate("designId", "name mode designCode")
      .populate("createdBy", "name email");

    if (!printingJob) {
      return res.status(404).json({
        message: "Printing job not found",
      });
    }

    return res.json({ printingJob });
  } catch (err) {
    console.error("Get printing job error:", err);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// PUT /api/printing-jobs/:id
// Updates history only. It never moves stock.
const updatePrintingJob = async (req, res) => {
  try {
    const printingJob = await PrintingJob.findById(req.params.id);

    if (!printingJob) {
      return res.status(404).json({
        message: "Printing job not found",
      });
    }

    const { status, notes, minThreshold } = req.body;

    if (status !== undefined) {
      if (!["PENDING", "COMPLETED", "CANCELLED"].includes(status)) {
        return res.status(400).json({
          message: "Invalid status",
        });
      }
      printingJob.status = status;
    }

    if (notes !== undefined) {
      printingJob.notes = notes;
    }

    // Allow updating the threshold on the history record (optional)
    if (minThreshold !== undefined) {
      const threshold = Number(minThreshold);
      if (isNaN(threshold) || threshold < 0) {
        return res.status(400).json({
          message: "minThreshold must be a non-negative number",
        });
      }
      printingJob.minThreshold = threshold;
    }

    // Never add PRINTED stock here.
    printingJob.inventoryAdded = false;

    await printingJob.save();

    return res.json({
      message: "Printing job updated successfully",
      printingJob,
    });
  } catch (err) {
    console.error("Update printing job error:", err);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// DELETE /api/printing-jobs/:id
const deletePrintingJob = async (req, res) => {
  try {
    const printingJob = await PrintingJob.findById(req.params.id);

    if (!printingJob) {
      return res.status(404).json({
        message: "Printing job not found",
      });
    }

    await printingJob.deleteOne();

    return res.json({
      message: "Printing job deleted successfully",
    });
  } catch (err) {
    console.error("Delete printing job error:", err);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// GET /api/printing-jobs/designs/:productId
const getPrintedDesignsByProduct = async (req, res) => {
  try {
    const designs = await ProductDesign.find({
      productId: req.params.productId,
      isActive: true,
    }).select("name mode designCode designUrl notes");

    return res.json({ designs });
  } catch (err) {
    console.error("Get product designs error:", err);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = {
  createPrintingJob,
  listPrintingJobs,
  getPrintingJobById,
  updatePrintingJob,
  deletePrintingJob,
  getPrintedDesignsByProduct,
};