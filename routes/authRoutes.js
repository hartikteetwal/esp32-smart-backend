const express = require('express');
const router = express.Router();
const { login, updatePublicPass } = require('../controllers/authController');
const { broadcast } = require('../sockets/socketManager');

router.post('/login', login);
router.post('/update-public-pass', updatePublicPass(broadcast));

module.exports = router;