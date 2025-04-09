// File: routes/requests.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Middleware для проверки, что пользователь залогинен и что он шеф или менеджер
function ensureAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
}

// GET /requests - список всех заявок
router.get('/', ensureAuth, async (req, res) => {
  try {
    const [requests] = await pool.query(
      `SELECT * FROM requests ORDER BY created_at DESC`
    );

    // Пример: на фронте можно фильтровать заявки конкретного шефа или показывать все
    // Если нужно показывать только те, что созданы этим шефом:
    // WHERE created_by = ?

    res.render('dashboard_chef', {
      user: req.session.user,
      requests
    });
  } catch (err) {
    console.error(err);
    res.send('Ошибка при получении заявок');
  }
});

// GET /requests/create - форма создания заявки
router.get('/create', ensureAuth, (req, res) => {
  res.render('dashboard_chef', {
    user: req.session.user,
    createMode: true
  });
});

// POST /requests/create - обработка создания заявки
router.post('/create', ensureAuth, async (req, res) => {
  // Предположим, что formData передаёт массив продуктов, etc.
  // Пример простого варианта: product_name, quantity
  // или массив вида positions = [{product_name, quantity}, {...}]
  const { positions } = req.body; 
  // positions может быть JSON-строкой, которую парсим и т. д.

  try {
    // 1) Создаём "шапку" заявки
    const requestNumber = `REQ-${Date.now()}`; // упрощённо
    const [result] = await pool.query(
      `INSERT INTO requests (request_number, created_by) VALUES (?, ?)`,
      [requestNumber, req.session.user.user_id]
    );
    const requestId = result.insertId;

    // 2) Создаём позиции
    if (Array.isArray(positions)) {
      for (const item of positions) {
        await pool.query(
          `INSERT INTO request_items (request_id, product_name, quantity)
           VALUES (?, ?, ?)`,
          [requestId, item.product_name, item.quantity]
        );
      }
    }

    res.redirect('/requests');
  } catch (err) {
    console.error(err);
    res.send('Ошибка при создании заявки');
  }
});

module.exports = router;
