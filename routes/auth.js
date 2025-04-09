// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const pool = require('../config/db');

// GET /auth/login
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('login');
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE username = ? LIMIT 1',
      [username]
    );

    if (rows.length === 0) {
      return res.render('login', { error: 'Неверные учетные данные' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render('login', { error: 'Неверные учетные данные' });
    }

    // Пишем в сессию
    req.session.user = {
      user_id: user.user_id,
      username: user.username,
      role: user.role
    };

    // Редирект по роли
    if (user.role === 'chef') {
      res.redirect('/requests');
    } else {
      res.redirect('/manager');
    }
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Ошибка сервера при входе' });
  }
});

// GET /auth/logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error(err);
    res.redirect('/auth/login');
  });
});

module.exports = router;
