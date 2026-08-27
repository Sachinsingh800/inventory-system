const mongoose = require('mongoose');
const Barcode = require('../models/Barcode');
const Inventory = require('../models/Inventory');
const PrintingJob = require('../models/PrintingJob');

const MONGO_URI = process.env.MONGO_URI;

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    // Do not accept traffic until the uniqueness rules that protect exact
    // barcode batches have been created. In particular, a printing job may
    // have only one label at each sequence number.
    await Promise.all([
      Barcode.init(),
      Inventory.init(),
      PrintingJob.init(),
    ]);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('DB connection error', err);
    process.exit(1);
  }
};

module.exports = { connectDB };
