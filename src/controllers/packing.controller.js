const Barcode = require('../models/Barcode');
const PackingSession = require('../models/PackingSession');
const Inventory = require('../models/Inventory');

// POST /api/packing-sessions  (ADMIN / PACKER)
// body: { date }
const createPackingSession = async (req, res) => {
  try {
    const { date } = req.body;
    const userId = req.user?.id;

    const session = await PackingSession.create({
      date: date ? new Date(date) : new Date(),
      createdBy: userId,
    });

    res.status(201).json({
      message: 'Packing session created',
      packingSession: session,
    });
  } catch (err) {
    console.error('Create packing session error', err);
    res.status(500).json({ message: 'Server error' });
  }
};


// POST /api/packing-sessions/:id/scan  (PACKER)
// body: { code }
const scanBarcode = async (req, res) => {
  try {
    const { id } = req.params; // packingSessionId
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Barcode code is required' });
    }

    const session = await PackingSession.findById(id);
    if (!session) {
      return res.status(404).json({ message: 'Packing session not found' });
    }

    const barcode = await Barcode.findOne({ code });
    if (!barcode) {
      return res.status(404).json({ message: 'Barcode not found' });
    }

    if (barcode.status === 'USED') {
      return res.status(400).json({ message: 'Barcode already used' });
    }

    // find printed inventory for this SKU
    const printedInv = await Inventory.findOne({
      productId: barcode.productId,
      type: 'PRINTED',
      designCode: barcode.designCode,
    });

    if (!printedInv || printedInv.quantity <= 0) {
      return res.status(400).json({
        message: 'No printed stock available for this barcode SKU',
      });
    }

    // Deduct 1 from printed stock (Printed Stock = Printed Stock - 1)
    printedInv.quantity -= 1;
    await printedInv.save();

    // Mark barcode as USED
    barcode.status = 'USED';
    barcode.usedAt = new Date();
    barcode.packingSessionId = session._id;
    await barcode.save();

    res.json({
      message: 'Barcode scanned; printed stock decremented',
      inventory: {
        productId: printedInv.productId,
        designCode: printedInv.designCode,
        quantity: printedInv.quantity,
      },
    });
  } catch (err) {
    console.error('Scan barcode error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createPackingSession,
  scanBarcode,
};