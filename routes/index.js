// routes/index.js
const express = require('express');
const router = express.Router();

// GET /
router.get('/', (req, res) => {
  // Если не авторизован — на страницу логина
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  // Если шеф
  if (req.session.user.role === 'chef') {
    return res.redirect('/requests');
  }
  // Если менеджер
  if (req.session.user.role === 'manager') {
    return res.redirect('/manager');
  }
  
  // На всякий случай:
  return res.redirect('/auth/login');
});

module.exports = router;
