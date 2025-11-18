const express = require('express');
const router = express.Router();
const { getProviderDetails } = require('../../controllers/providerController');




router.get('/:id', getProviderDetails);

module.exports = router;
