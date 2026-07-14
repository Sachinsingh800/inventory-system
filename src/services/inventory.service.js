const Inventory = require('../models/Inventory');

// Get or create RAW inventory record for a product
const getOrCreateRawInventory = async (productId) => {
  let inv = await Inventory.findOne({ productId, type: 'RAW', designCode: null });

  if (!inv) {
    inv = await Inventory.create({
      productId,
      type: 'RAW',
      designCode: null,
      quantity: 0,
      minThreshold: 0,
    });
  }

  return inv;
};

// Increment RAW stock (used in purchase verification)
const addRawStock = async (productId, qty) => {
  const inv = await getOrCreateRawInventory(productId);

  inv.quantity += qty;
  await inv.save();

  return inv;
};

// Deduct RAW stock (used in printing job)
const deductRawStock = async (productId, qty) => {
  const inv = await getOrCreateRawInventory(productId);

  if (inv.quantity < qty) {
    throw new Error('Insufficient raw stock');
  }

  inv.quantity -= qty;
  await inv.save();

  return inv;
};

// Get or create PRINTED inventory for product+design
const getOrCreatePrintedInventory = async (productId, designCode) => {
  let inv = await Inventory.findOne({ productId, type: 'PRINTED', designCode });

  if (!inv) {
    inv = await Inventory.create({
      productId,
      type: 'PRINTED',
      designCode,
      quantity: 0,
      minThreshold: 0,
    });
  }

  return inv;
};

// Increment PRINTED stock (used after printing job)
const addPrintedStock = async (productId, designCode, qty) => {
  const inv = await getOrCreatePrintedInventory(productId, designCode);
  inv.quantity += qty;
  await inv.save();
  return inv;
};

module.exports = {
  getOrCreateRawInventory,
  addRawStock,
  deductRawStock,
  getOrCreatePrintedInventory,
  addPrintedStock,
};