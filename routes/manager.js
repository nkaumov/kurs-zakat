// File: routes/manager.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Middleware проверки роли
function ensureManager(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  if (req.session.user.role !== 'manager') {
    return res.status(403).send('Доступ запрещён');
  }
  next();
}

// GET /manager - страница менеджера (dashboard)
router.get('/', ensureManager, (req, res) => {
  // Можно отрисовать отдельный шаблон
  res.render('dashboard_manager', { user: req.session.user });
});

// Пример: менеджер меняет статус заявки
router.post('/update-status', ensureManager, async (req, res) => {
  const { request_id, new_status } = req.body;
  try {
    await pool.query(
      `UPDATE requests SET status = ? WHERE request_id = ?`,
      [new_status, request_id]
    );
    res.redirect('/manager/requests');
  } catch (err) {
    console.error(err);
    res.send('Ошибка при обновлении статуса');
  }
});

// Пример: список заявок для менеджера
router.get('/requests', ensureManager, async (req, res) => {
  try {
    const [requests] = await pool.query(
      `SELECT * FROM requests ORDER BY created_at DESC`
    );
    res.render('dashboard_manager', { user: req.session.user, requests });
  } catch (err) {
    console.error(err);
    res.send('Ошибка при получении заявок');
  }
});

// Аналогично реализовать логику для "Персонала", "Графика", "Отчётов" и т.д.

module.exports = router;
