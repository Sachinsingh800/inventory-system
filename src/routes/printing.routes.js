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

// Get available model/design list for a product.
router.get(
  '/designs/:productId',
  auth(['ADMIN', 'PRINTER', 'PACKER']),
  getPrintedDesignsByProduct
);

// Printing job CRUD.
router.post('/', auth(['ADMIN', 'PRINTER']), createPrintingJob);

router.get('/', auth(['ADMIN', 'PRINTER']), listPrintingJobs);

router.get('/:id', auth(['ADMIN', 'PRINTER']), getPrintingJobById);

router.put('/:id', auth(['ADMIN', 'PRINTER']), updatePrintingJob);

router.delete('/:id', auth(['ADMIN', 'PRINTER']), deletePrintingJob);

module.exports = router;