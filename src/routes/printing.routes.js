const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const { createPrintingJob } = require('../controllers/printing.controller');

const router = Router();

// printing job creation (admin + printer role)
router.post('/', auth(['ADMIN', 'PRINTER']), createPrintingJob);

module.exports = router;