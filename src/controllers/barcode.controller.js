const crypto = require('crypto');
const mongoose = require('mongoose');

const Barcode = require('../models/Barcode');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const ProductDesign = require('../models/ProductDesign');

/* -------------------------------------------------------------------------- */
/* Barcode code                                                               */
/* -------------------------------------------------------------------------- */

const makeBarcodeCode = (designCode) => {
  const clean = String(designCode)
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toUpperCase();

  return `PR-${clean}-${crypto
    .randomUUID()
    .replace(/-/g, '')
    .slice(0, 10)
    .toUpperCase()}`;
};

/* -------------------------------------------------------------------------- */
/* Generate batch ID                                                          */
/* -------------------------------------------------------------------------- */

const makeGenerationBatchId = () => {
  return `BATCH-${crypto
    .randomUUID()
    .replace(/-/g, '')
    .slice(0, 16)
    .toUpperCase()}`;
};

/* -------------------------------------------------------------------------- */
/* Generate barcodes                                                          */
/* -------------------------------------------------------------------------- */
/*
 * IMPORTANT:
 *
 * We count ALL existing barcodes:
 *
 * AVAILABLE + USED
 *
 * because USED barcodes were already generated previously.
 *
 * Example:
 *
 * PRINTED STOCK = 100
 *
 * Existing barcodes:
 * AVAILABLE = 70
 * USED       = 20
 *
 * Total generated = 90
 *
 * New barcode count = 100 - 90 = 10
 *
 * We do NOT generate 30.
 */

const generateBarcodes = async (req, res) => {
  let session;

  try {
    const { productId, designId } = req.body;

    if (!productId || !designId) {
      return res.status(400).json({
        message: 'productId and designId are required',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        message: 'Invalid productId',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(designId)) {
      return res.status(400).json({
        message: 'Invalid designId',
      });
    }

    /*
     * Verify design belongs to selected product.
     */
    const design = await ProductDesign.findOne({
      _id: designId,
      productId,
      isActive: true,
    }).lean();

    if (!design) {
      return res.status(400).json({
        message:
          'Selected model/design does not belong to this product',
      });
    }

    session = await mongoose.startSession();

    let barcodes = [];
    let printedInventory = null;

    const generationBatchId = makeGenerationBatchId();

    /*
     * Same exact timestamp for every barcode in this generation request.
     */
    const generatedAt = new Date();

    await session.withTransaction(async () => {
      /* ------------------------------------------------------------------ */
      /* Find PRINTED inventory                                             */
      /* ------------------------------------------------------------------ */

      printedInventory = await Inventory.findOne({
        productId,
        type: 'PRINTED',
        designCode: design.designCode,
        isActive: true,
      }).session(session);

      if (!printedInventory) {
        throw new Error(
          'No PRINTED stock exists for this design',
        );
      }

      const printedQuantity =
        Number(printedInventory.quantity) || 0;

      if (printedQuantity < 1) {
        throw new Error(
          'No PRINTED stock exists for this design',
        );
      }

      /* ------------------------------------------------------------------ */
      /* Count ALL previously generated barcodes                            */
      /* ------------------------------------------------------------------ */

      const existingBarcodeCount =
        await Barcode.countDocuments({
          productId,
          designCode: design.designCode,
        }).session(session);

      /* ------------------------------------------------------------------ */
      /* Count currently AVAILABLE barcodes                                 */
      /* ------------------------------------------------------------------ */

      const availableBarcodeCount =
        await Barcode.countDocuments({
          productId,
          designCode: design.designCode,
          status: 'AVAILABLE',
        }).session(session);

      /* ------------------------------------------------------------------ */
      /* Calculate ONLY newly required barcodes                              */
      /* ------------------------------------------------------------------ */

      const newBarcodeCount =
        printedQuantity - existingBarcodeCount;

      /*
       * No new barcodes needed.
       *
       * IMPORTANT:
       * Even USED barcodes are counted above.
       */
      if (newBarcodeCount <= 0) {
        throw new Error(
          'All current PRINTED stock for this design already has barcodes',
        );
      }

      /* ------------------------------------------------------------------ */
      /* Create ONLY new barcode documents                                  */
      /* ------------------------------------------------------------------ */

      const barcodeDocuments = Array.from(
        { length: newBarcodeCount },
        () => ({
          code: makeBarcodeCode(
            design.designCode,
          ),

          productId,

          designCode: design.designCode,

          generationBatchId,

          generatedAt,

          status: 'AVAILABLE',

          usedAt: null,
        }),
      );

      barcodes = await Barcode.insertMany(
        barcodeDocuments,
        {
          session,
          ordered: true,
        },
      );

      /* ------------------------------------------------------------------ */
      /* Update inventory barcode counter                                   */
      /* ------------------------------------------------------------------ */
      /*
       * availableBarcodeCount = old available barcodes
       *
       * newBarcodeCount = newly generated AVAILABLE barcodes
       *
       * Therefore:
       *
       * activeBarcodeCount =
       * old available + newly generated
       *
       * USED barcodes are intentionally not included.
       */
      const newActiveBarcodeCount =
        availableBarcodeCount + newBarcodeCount;

      printedInventory =
        await Inventory.findOneAndUpdate(
          {
            _id: printedInventory._id,
            quantity: printedInventory.quantity,
          },
          {
            $set: {
              activeBarcodeCount:
                newActiveBarcodeCount,
            },
          },
          {
            new: true,
            session,
          },
        );

      if (!printedInventory) {
        throw new Error(
          'PRINTED inventory changed; please generate barcodes again',
        );
      }
    });

    return res.status(201).json({
      message:
        `${barcodes.length} barcode(s) generated from PRINTED stock`,

      generation: {
        batchId: generationBatchId,
        generatedAt,
        barcodeCount: barcodes.length,
      },

      design: {
        id: design._id,
        name: design.name,
        mode: design.mode,
        designCode: design.designCode,
      },

      printedInventory: {
        id: printedInventory._id,
        quantity: printedInventory.quantity,
        activeBarcodeCount:
          printedInventory.activeBarcodeCount,
      },

      barcodeCount: barcodes.length,

      barcodes,
    });
  } catch (error) {
    if (
      error.message.includes('PRINTED stock') ||
      error.message.includes(
        'already has barcodes',
      ) ||
      error.message.includes(
        'PRINTED inventory changed',
      )
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    console.error(
      'Generate barcodes error:',
      error,
    );

    return res.status(
      error.code === 11000 ? 409 : 500,
    ).json({
      message:
        error.code === 11000
          ? 'A duplicate barcode was generated. Please try again.'
          : 'Server error',
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

/* -------------------------------------------------------------------------- */
/* List barcodes by product                                                   */
/* -------------------------------------------------------------------------- */

const listBarcodesByProduct = async (
  req,
  res,
) => {
  try {
    const filter = {
      productId: req.params.productId,
    };

    if (
      req.query.designCode
    ) {
      filter.designCode = String(
        req.query.designCode,
      ).trim();
    }

    if (
      req.query.generationBatchId
    ) {
      filter.generationBatchId =
        String(
          req.query.generationBatchId,
        ).trim();
    }

    if (req.query.status) {
      if (
        !['AVAILABLE', 'USED'].includes(
          String(req.query.status),
        )
      ) {
        return res.status(400).json({
          message:
            'status must be AVAILABLE or USED',
        });
      }

      filter.status = String(
        req.query.status,
      );
    }

    /* -------------------------------------------------------------------- */
    /* Date filter                                                          */
    /* -------------------------------------------------------------------- */

    if (
      req.query.from ||
      req.query.to
    ) {
      filter.createdAt = {};

      if (req.query.from) {
        const from = new Date(
          `${req.query.from}T00:00:00.000`,
        );

        if (
          Number.isNaN(from.getTime())
        ) {
          return res.status(400).json({
            message:
              'from must be YYYY-MM-DD',
          });
        }

        filter.createdAt.$gte = from;
      }

      if (req.query.to) {
        const to = new Date(
          `${req.query.to}T23:59:59.999`,
        );

        if (
          Number.isNaN(to.getTime())
        ) {
          return res.status(400).json({
            message:
              'to must be YYYY-MM-DD',
          });
        }

        filter.createdAt.$lte = to;
      }
    }

    /* -------------------------------------------------------------------- */
    /* Fetch                                                                */
    /* -------------------------------------------------------------------- */

    const barcodes = await Barcode.find(
      filter,
    )
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .lean();

    /* -------------------------------------------------------------------- */
    /* Group by design                                                      */
    /* -------------------------------------------------------------------- */

    const barcodesByDesign =
      barcodes.reduce(
        (result, barcode) => {
          const key =
            barcode.designCode ||
            'NO_DESIGN';

          if (!result[key]) {
            result[key] = [];
          }

          result[key].push(barcode);

          return result;
        },
        {},
      );

    /* -------------------------------------------------------------------- */
    /* Group by generation batch                                            */
    /* -------------------------------------------------------------------- */

    const barcodesByBatch =
      barcodes.reduce(
        (result, barcode) => {
          /*
           * New records have generationBatchId.
           *
           * Older records don't.
           * Put those into a fallback group based
           * on their creation date.
           */
          const key =
            barcode.generationBatchId ||
            `LEGACY-${barcode.createdAt
              ? new Date(
                  barcode.createdAt,
                )
                  .toISOString()
                  .slice(0, 10)
              : 'UNKNOWN'}`;

          if (!result[key]) {
            result[key] = [];
          }

          result[key].push(barcode);

          return result;
        },
        {},
      );

    /* -------------------------------------------------------------------- */
    /* Build batch summary                                                  */
    /* -------------------------------------------------------------------- */

    const generationBatches =
      Object.entries(
        barcodesByBatch,
      )
        .map(
          ([batchId, rows]) => {
            const first =
              rows[0];

            const availableCount =
              rows.filter(
                (row) =>
                  row.status ===
                  'AVAILABLE',
              ).length;

            const usedCount =
              rows.filter(
                (row) =>
                  row.status === 'USED',
              ).length;

            return {
              batchId,

              generatedAt:
                first?.generatedAt ||
                first?.createdAt ||
                null,

              barcodeCount:
                rows.length,

              availableCount,

              usedCount,

              barcodes: rows,
            };
          },
        )
        .sort((a, b) => {
          const timeA = a.generatedAt
            ? new Date(
                a.generatedAt,
              ).getTime()
            : 0;

          const timeB = b.generatedAt
            ? new Date(
                b.generatedAt,
              ).getTime()
            : 0;

          return timeB - timeA;
        });

    return res.json({
      total: barcodes.length,

      barcodes,

      barcodesByDesign,

      /*
       * Perfect for your frontend:
       *
       * Batch 10:30 AM -> 50 barcodes
       * Batch 02:15 PM -> 20 barcodes
       */
      generationBatches,
    });
  } catch (error) {
    console.error(
      'List barcodes error:',
      error,
    );

    return res.status(500).json({
      message: 'Server error',
    });
  }
};

/* -------------------------------------------------------------------------- */
/* Update barcode status                                                      */
/* -------------------------------------------------------------------------- */

const updateBarcodeStatus = async (
  req,
  res,
) => {
  try {
    const { status } = req.body;

    if (
      !['AVAILABLE', 'USED'].includes(
        status,
      )
    ) {
      return res.status(400).json({
        message:
          'status must be AVAILABLE or USED',
      });
    }

    const barcode =
      await Barcode.findById(
        req.params.id,
      );

    if (!barcode) {
      return res.status(404).json({
        message:
          'Barcode not found',
      });
    }

    barcode.status = status;

    barcode.usedAt =
      status === 'USED'
        ? new Date()
        : null;

    await barcode.save();

    return res.json({
      message:
        'Barcode status updated successfully',

      barcode,
    });
  } catch (error) {
    console.error(
      'Update barcode status error:',
      error,
    );

    return res.status(500).json({
      message: 'Server error',
    });
  }
};

/* -------------------------------------------------------------------------- */
/* Packed barcodes                                                            */
/* -------------------------------------------------------------------------- */

const getPackedBarcodes = async (
  req,
  res,
) => {
  try {
    const page = Math.max(
      Number.parseInt(
        req.query.page,
        10,
      ) || 1,
      1,
    );

    const limit = Math.min(
      Math.max(
        Number.parseInt(
          req.query.limit,
          10,
        ) || 50,
        1,
      ),
      200,
    );

    const filter = {
      status: 'USED',
      usedAt: {
        $ne: null,
      },
    };

    if (req.query.productId) {
      filter.productId =
        req.query.productId;
    }

    if (req.query.designCode) {
      filter.designCode = String(
        req.query.designCode,
      ).trim();
    }

    if (
      req.query.from ||
      req.query.to
    ) {
      filter.usedAt = {};

      if (req.query.from) {
        const from = new Date(
          `${req.query.from}T00:00:00.000`,
        );

        if (
          Number.isNaN(from.getTime())
        ) {
          return res.status(400).json({
            message:
              'from must be YYYY-MM-DD',
          });
        }

        filter.usedAt.$gte = from;
      }

      if (req.query.to) {
        const to = new Date(
          `${req.query.to}T23:59:59.999`,
        );

        if (
          Number.isNaN(to.getTime())
        ) {
          return res.status(400).json({
            message:
              'to must be YYYY-MM-DD',
          });
        }

        filter.usedAt.$lte = to;
      }
    }

    const [
      totalPacked,
      barcodes,
    ] = await Promise.all([
      Barcode.countDocuments(filter),

      Barcode.find(filter)
        .sort({
          usedAt: -1,
          _id: -1,
        })
        .skip(
          (page - 1) * limit,
        )
        .limit(limit)
        .lean(),
    ]);

    const productIds = [
      ...new Set(
        barcodes.map(
          (barcode) =>
            String(
              barcode.productId,
            ),
        ),
      ),
    ];

    const designPairs = [
      ...new Map(
        barcodes.map(
          (barcode) => [
            `${barcode.productId}:${barcode.designCode}`,
            {
              productId:
                barcode.productId,
              designCode:
                barcode.designCode,
            },
          ],
        ),
      ).values(),
    ];

    const [
      products,
      designs,
    ] = await Promise.all([
      Product.find({
        _id: {
          $in: productIds,
        },
      })
        .select(
          '_id name skuBase categoryId',
        )
        .lean(),

      designPairs.length
        ? ProductDesign.find({
            $or: designPairs,
          })
            .select(
              '_id productId name mode designCode designUrl',
            )
            .lean()
        : [],
    ]);

    const productMap =
      new Map(
        products.map(
          (product) => [
            String(product._id),
            product,
          ],
        ),
      );

    const designMap =
      new Map(
        designs.map(
          (design) => [
            `${design.productId}:${design.designCode}`,
            design,
          ],
        ),
      );

    const packedItems =
      barcodes.map(
        (barcode) => {
          const product =
            productMap.get(
              String(
                barcode.productId,
              ),
            );

          const design =
            designMap.get(
              `${barcode.productId}:${barcode.designCode}`,
            );

          return {
            barcodeId:
              barcode._id,

            barcode:
              barcode.code,

            status:
              barcode.status,

            packedAt:
              barcode.usedAt,

            generatedAt:
              barcode.generatedAt ||
              barcode.createdAt,

            generationBatchId:
              barcode.generationBatchId ||
              null,

            product: product
              ? {
                  id: product._id,
                  name: product.name,
                  skuBase:
                    product.skuBase,
                  categoryId:
                    product.categoryId,
                }
              : null,

            design: {
              id:
                design?._id ||
                null,

              name:
                design?.name ||
                barcode.designCode,

              mode:
                design?.mode ||
                null,

              code:
                barcode.designCode,

              image:
                design?.designUrl ||
                null,
            },
          };
        },
      );

    return res.json({
      totalPacked,

      page,

      limit,

      totalPages:
        Math.ceil(
          totalPacked / limit,
        ),

      packedItems,
    });
  } catch (error) {
    console.error(
      'Get packed barcodes error:',
      error,
    );

    return res.status(500).json({
      message: 'Server error',
    });
  }
};

/* -------------------------------------------------------------------------- */
/* Today's barcode report                                                     */
/* -------------------------------------------------------------------------- */

const getBarcodeTodayReport = async (
  req,
  res,
) => {
  try {
    const start = new Date();

    start.setHours(
      0,
      0,
      0,
      0,
    );

    const end = new Date();

    end.setHours(
      23,
      59,
      59,
      999,
    );

    const filter = {
      createdAt: {
        $gte: start,
        $lte: end,
      },
    };

    if (req.query.productId) {
      filter.productId =
        req.query.productId;
    }

    const report =
      await Barcode.aggregate([
        {
          $match: filter,
        },

        {
          $group: {
            _id: {
              productId:
                '$productId',

              designCode:
                '$designCode',

              status:
                '$status',
            },

            quantity: {
              $sum: 1,
            },
          },
        },

        {
          $sort: {
            '_id.designCode': 1,
            '_id.status': 1,
          },
        },
      ]);

    return res.json({
      totalGenerated:
        report.reduce(
          (sum, item) =>
            sum + item.quantity,
          0,
        ),

      report,
    });
  } catch (error) {
    console.error(
      'Get barcode today report error:',
      error,
    );

    return res.status(500).json({
      message: 'Server error',
    });
  }
};

/* -------------------------------------------------------------------------- */
/* Exports                                                                    */
/* -------------------------------------------------------------------------- */

module.exports = {
  generateBarcodes,
  listBarcodesByProduct,
  updateBarcodeStatus,
  getBarcodeTodayReport,
  getPackedBarcodes,
};