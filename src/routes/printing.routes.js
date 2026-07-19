// src/routes/printing.routes.js
const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const {
  createPrintingJob,
  listPrintingJobs,
  getPrintingJobById,
  updatePrintingJob,
  deletePrintingJob,
  getPrintedDesignsByProduct,
} = require('../controllers/printing.controller');

const router = Router();

// CRUD for printing jobs
router.post('/', auth(['ADMIN', 'PRINTER']), createPrintingJob);
router.get('/', auth(['ADMIN', 'PRINTER']), listPrintingJobs);
router.get('/:id', auth(['ADMIN', 'PRINTER']), getPrintingJobById);
router.put('/:id', auth(['ADMIN', 'PRINTER']), updatePrintingJob);
router.delete('/:id', auth(['ADMIN', 'PRINTER']), deletePrintingJob);

// designs for one product (for barcodes)
router.get(
  '/designs/:productId',
  auth(['ADMIN', 'PRINTER']),
  getPrintedDesignsByProduct
);

module.exports = router;