// File: routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const pool = require('../config/db');

// GET /auth/login
router.get('/login', (req, res) => {
  // Если уже залогинен, перенаправим
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
    // Проверяем пароль (bcrypt)
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render('login', { error: 'Неверные учетные данные' });
    }

    // Сохраняем пользователя в сессии
    req.session.user = {
      user_id: user.user_id,
      username: user.username,
      role: user.role
    };

    // Редирект в зависимости от роли
    if (user.role === 'chef') {
      res.redirect('/requests');
    } else {
      res.redirect('/manager');
    }
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Ошибка сервера' });
  }
});

// GET /auth/logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.log(err);
    res.redirect('/auth/login');
  });
});

// Пример регистрации
// GET /auth/register
router.get('/register', (req, res) => {
  res.render('register');
});

// POST /auth/register
router.post('/register', async (req, res) => {
  const { username, password, role } = req.body; 
  // role может быть 'chef' или 'manager'

  try {
    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Сохраняем нового пользователя
    await pool.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role]
    );

    res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    res.render('register', { error: 'Ошибка при регистрации' });
  }
});

module.exports = router;
