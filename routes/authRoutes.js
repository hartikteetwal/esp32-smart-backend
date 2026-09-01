const express = require('express');
const router = express.Router();
const { login, updatePublicPass } = require('../controllers/authController');

router.post('/login', login);
router.post('/update-public-pass', updatePublicPass);

module.exports = router;