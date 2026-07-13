const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const router = require('./routes');

const app = express();

// middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// routes
app.use('/api', router);

module.exports = app;