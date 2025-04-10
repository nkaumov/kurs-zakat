// routes/requests.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Проверка на авторизацию
function ensureAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
}

// (Можно добавить: ensureChef — если хотим, чтобы создавать заявки мог только шеф)

router.get('/', ensureAuth, async (req, res) => {
  try {
    // Если хотим показывать заявки, созданные именно этим шефом:
    //   WHERE created_by = req.session.user.user_id
    // Пока покажем все, чтобы было проще тестировать
    const [requests] = await pool.query(
      'SELECT * FROM requests ORDER BY created_at DESC'
    );

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
  // Проверим роль (при желании)
  // if (req.session.user.role !== 'chef') {
  //   return res.send('Только шеф может создавать заявки');
  // }

  res.render('dashboard_chef', {
    user: req.session.user,
    createMode: true
  });
});

// POST /requests/create
router.post('/create', ensureAuth, async (req, res) => {
  let product_names = req.body['product_name[]'] || req.body.product_name;
  let quantities = req.body['quantity[]'] || req.body.quantity;

  // Приводим к массиву
  if (!Array.isArray(product_names)) product_names = [product_names];
  if (!Array.isArray(quantities)) quantities = [quantities];

  // Собираем позиции и убираем пустые
  const positions = product_names.map((name, index) => ({
    product_name: name.trim(),
    quantity: parseInt(quantities[index], 10) || 0
  })).filter(p => p.product_name !== '' && p.quantity > 0);

  try {
    const requestNumber = `REQ-${Date.now()}`;
    const [result] = await pool.query(
      `INSERT INTO requests (request_number, created_by)
       VALUES (?, ?)`,
      [requestNumber, req.session.user.user_id]
    );
    const requestId = result.insertId;

    // Вставляем позиции заявки
    for (const item of positions) {
      await pool.query(`
        INSERT INTO request_items (request_id, product_name, quantity)
        VALUES (?, ?, ?)
      `, [requestId, item.product_name, item.quantity]);
    }

    res.redirect('/requests');
  } catch (err) {
    console.error(err);
    res.send('Ошибка при создании заявки');
  }
});

// GET /requests/:id — просмотр состава заявки (только просмотр, без изменений)
router.get('/:id', ensureAuth, async (req, res) => {
  const requestId = req.params.id;

  try {
    const [[request]] = await pool.query(
      `SELECT * FROM requests WHERE request_id = ?`,
      [requestId]
    );

    if (!request) {
      return res.send('Заявка не найдена');
    }

    const [items] = await pool.query(
      `SELECT * FROM request_items WHERE request_id = ?`,
      [requestId]
    );

    res.render('chef_request_details', {
      user: req.session.user,
      request,
      items
    });
  } catch (err) {
    console.error(err);
    res.send('Ошибка при загрузке состава заявки');
  }
});


module.exports = router;
