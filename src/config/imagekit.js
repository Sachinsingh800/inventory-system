const ImageKit = require("@imagekit/nodejs");

const imagekit = new ImageKit({
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,

  // Don't wait 1 minute while debugging
  timeout: 20000,

  // Don't retry while debugging
  maxRetries: 0,
});

module.exports = imagekit;