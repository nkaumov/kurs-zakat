// File: routes/index.js
const express = require('express');
const router = express.Router();

// GET /
router.get('/', (req, res) => {
  // Если пользователь уже авторизован, можно редиректить его на нужный дашборд
  if (req.session.user) {
    if (req.session.user.role === 'chef') {
      return res.redirect('/requests'); 
    } else {
      return res.redirect('/manager');
    }
  }
  // Иначе идём на страницу логина
  res.redirect('/auth/login');
});

module.exports = router;
