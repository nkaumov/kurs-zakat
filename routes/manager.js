// routes/manager.js
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const pool = require('../config/db');

// Middleware для проверки, что пользователь - менеджер
function ensureManager(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  if (req.session.user.role !== 'manager') {
    return res.status(403).send('Доступ запрещён: только менеджеру.');
  }
  next();
}

// ================== //
// 1) Кабинет менеджера
// ================== //

router.get('/', ensureManager, (req, res) => {
  // Рендерим "dashboard_manager.hbs" без доп. данных,
  // там будет меню (кнопки) для перехода к другим функциям.
  res.render('dashboard_manager', {
    user: req.session.user
  });
});

// ================== //
// 2) Заявки
// ================== //

// GET /manager/requests - список заявок
router.get('/requests', ensureManager, async (req, res) => {
  try {
    const [requests] = await pool.query(`
      SELECT * FROM requests
      ORDER BY created_at DESC
    `);
    res.render('dashboard_manager', {
      user: req.session.user,
      requests
    });
  } catch (err) {
    console.error(err);
    res.send('Ошибка при получении заявок');
  }
});

// GET /manager/requests/:id - просмотр заявки с деталями
router.get('/requests/:id', ensureManager, async (req, res) => {
  const requestId = req.params.id;

  try {
    const [[request]] = await pool.query(`
      SELECT * FROM requests WHERE request_id = ?
    `, [requestId]);

    if (!request) {
      return res.send('Заявка не найдена');
    }

    const [items] = await pool.query(`
      SELECT * FROM request_items WHERE request_id = ?
    `, [requestId]);

    res.render('manager_request_details', {
      user: req.session.user,
      request,
      items
    });
  } catch (err) {
    console.error(err);
    res.send('Ошибка при получении состава заявки');
  }
});


// POST /manager/update-status - смена статуса заявки
router.post('/update-status', ensureManager, async (req, res) => {
  const { request_id, new_status } = req.body;
  try {
    await pool.query(
      'UPDATE requests SET status = ? WHERE request_id = ?',
      [new_status, request_id]
    );
    res.redirect('/manager/requests');
  } catch (err) {
    console.error(err);
    res.send('Ошибка при обновлении статуса');
  }
});

// ================== //
// 3) Персонал
// ================== //

// GET /manager/employees - список персонала
// routes/manager.js
router.get('/employees', ensureManager, async (req, res) => {
  try {
    const [employees] = await pool.query(
      'SELECT * FROM employees WHERE is_deleted = FALSE OR is_deleted IS NULL ORDER BY employee_id DESC'
    );
    

    res.render('manager_employees', {
      user: req.session.user,
      employeesList: employees
    });
  } catch (err) {
    console.error(err);
    res.send('Ошибка при получении персонала');
  }
});


// POST /manager/employees/add - добавление сотрудника (без логина)
router.post('/employees/add', ensureManager, async (req, res) => {
  const { full_name, position, passport_data, phone_number } = req.body;
  try {
    await pool.query(`
      INSERT INTO employees (full_name, position, passport_data, phone_number)
      VALUES (?, ?, ?, ?)
    `, [full_name, position, passport_data, phone_number]);

    res.redirect('/manager/employees');
  } catch (err) {
    console.error(err);
    res.send('Ошибка при добавлении сотрудника');
  }
});

router.post('/employees/delete', ensureManager, async (req, res) => {
  const { employee_id } = req.body;

  try {
    await pool.query(`
      UPDATE employees SET is_deleted = TRUE WHERE employee_id = ?
    `, [employee_id]);

    res.redirect('/manager/employees');
  } catch (err) {
    console.error(err);
    res.send('Ошибка при удалении сотрудника');
  }
});

// ================== //
// 4) Создание новых учётных записей (шеф / менеджер)
// ================== //

router.get('/create-user', ensureManager, (req, res) => {
  res.render('manager_create_user', {
    user: req.session.user
  });
});

router.post('/create-user', ensureManager, async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(`
      INSERT INTO users (username, password, role)
      VALUES (?, ?, ?)
    `, [username, hashedPassword, role]);

    res.redirect('/manager');
  } catch (err) {
    console.error(err);
    res.send('Ошибка при создании нового пользователя');
  }
});

// ================== //
// 5) График (Work Schedule)
// ================== //

// GET /manager/schedule - форма выбора месяца/года,
//    + если в query есть month & year, показываем сам график (или создаём, если нет)
router.get('/schedule', ensureManager, async (req, res) => {
  const { month, year } = req.query;

  if (!month || !year) {
    // Просто форма выбора месяца/года
    return res.render('manager_schedule', {
      user: req.session.user,
      pickMonthYearMode: true
    });
  }

  // Преобразуем к числу
  const scheduleMonth = parseInt(month, 10);
  const scheduleYear = parseInt(year, 10);

  // 1) Проверяем, есть ли уже такой график
  let [rows] = await pool.query(
    `SELECT * FROM work_schedules
     WHERE schedule_month = ? AND schedule_year = ?
     LIMIT 1`,
    [scheduleMonth, scheduleYear]
  );

  let schedule;
  if (rows.length === 0) {
    // Не нашли, создаём новую "шапку" графика
    const [result] = await pool.query(`
      INSERT INTO work_schedules (schedule_month, schedule_year, status)
      VALUES (?, ?, 'open')
    `, [scheduleMonth, scheduleYear]);

    // Делаем повторный запрос, чтобы получить новую запись
    [rows] = await pool.query(`SELECT * FROM work_schedules WHERE schedule_id = ?`, [result.insertId]);
  }

  schedule = rows[0];

  // Если график "closed", то редактирование не даём
  const isClosed = (schedule.status === 'closed');

  // 2) Получаем список сотрудников
  let employees;

  if (schedule.status === 'open') {
    // Для новых графиков — только активные
    [employees] = await pool.query(`
      SELECT * FROM employees
      WHERE is_deleted = FALSE OR is_deleted IS NULL
      ORDER BY employee_id
    `);
  } else {
    // Для уже существующих графиков (в том числе закрытых) — всех, кто реально участвовал
    [employees] = await pool.query(`
      SELECT DISTINCT e.*
      FROM employees e
      JOIN work_schedule_details d ON d.employee_id = e.employee_id
      WHERE d.schedule_id = ?
      ORDER BY e.employee_id
    `, [schedule.schedule_id]);
  }
  
    
  // 3) Формируем список дней месяца (допустим, всегда 31, или определяем по реальным датам)
  //    Для упрощения – возьмём 31 (или можно динамически в зависимости от выбранного месяца)
  const daysInMonth = 31;

  // 4) Получаем уже существующие детали расписания
  const [details] = await pool.query(`
    SELECT * FROM work_schedule_details
    WHERE schedule_id = ?
  `, [schedule.schedule_id]);

  // Превратим это в структуру типа:
  //  hoursMap[employee_id][day_of_month] = hours
  const hoursMap = {};
  for (const d of details) {
    const empId = String(d.employee_id);
    const day = String(d.day_of_month);
    if (!hoursMap[empId]) {
      hoursMap[empId] = {};
    }
    hoursMap[empId][day] = d.hours;
  }
  

  // Отправляем во view
  res.render('manager_schedule', {
    user: req.session.user,
    schedule,
    employees,
    daysInMonth,
    hoursMap,
    isClosed
  });
});

// POST /manager/schedule - сохранение часов
router.post('/schedule', ensureManager, async (req, res) => {
  console.log("===> RAW BODY:", JSON.stringify(req.body, null, 2)); // отладка

  const { schedule_id } = req.body;

  // 👇 Парсим вручную вложенные ключи типа 'hours[1][3]'
  const hoursRaw = req.body;
  const hours = {};

  for (const key in hoursRaw) {
    const match = key.match(/^hours\[(\d+)]\[(\d+)]$/);
    if (match) {
      const empId = match[1];
      const day = match[2];
      const val = parseInt(hoursRaw[key], 10) || 0;

      if (!hours[empId]) {
        hours[empId] = {};
      }
      hours[empId][day] = val;
    }
  }

  if (!hours || Object.keys(hours).length === 0) {
    console.log("⚠️  hours пуст или не передан");
    return res.send('Ошибка: часы не переданы!');
  }

  try {
    const [schRows] = await pool.query(`
      SELECT * FROM work_schedules WHERE schedule_id = ?
    `, [schedule_id]);

    if (schRows.length === 0) {
      return res.send('График не найден');
    }

    const schedule = schRows[0];
    if (schedule.status === 'closed') {
      return res.send('График закрыт для редактирования');
    }

    for (const empId in hours) {
      for (const day in hours[empId]) {
        const val = hours[empId][day];

        const [exists] = await pool.query(`
          SELECT detail_id FROM work_schedule_details
          WHERE schedule_id = ? AND employee_id = ? AND day_of_month = ?
          LIMIT 1
        `, [schedule_id, empId, day]);

        if (exists.length === 0) {
          await pool.query(`
            INSERT INTO work_schedule_details (schedule_id, employee_id, day_of_month, hours)
            VALUES (?, ?, ?, ?)
          `, [schedule_id, empId, day, val]);
        } else {
          await pool.query(`
            UPDATE work_schedule_details
            SET hours = ?
            WHERE detail_id = ?
          `, [val, exists[0].detail_id]);
        }
      }
    }

    res.redirect(`/manager/schedule?month=${schedule.schedule_month}&year=${schedule.schedule_year}`);
  } catch (err) {
    console.error(err);
    res.send('Ошибка при сохранении графика');
  }
});



// POST /manager/schedule/close - закрытие графика
router.post('/schedule/close', ensureManager, async (req, res) => {
  const { schedule_id } = req.body;

  try {
    // Устанавливаем status = 'closed'
    await pool.query(`
      UPDATE work_schedules
      SET status = 'closed'
      WHERE schedule_id = ?
    `, [schedule_id]);

    // Получаем сам график, чтобы знать месяц/год
    const [rows] = await pool.query(`
      SELECT * FROM work_schedules WHERE schedule_id = ?
    `, [schedule_id]);
    if (rows.length === 0) {
      return res.send('График не найден.');
    }

    const sch = rows[0];
    res.redirect(`/manager/schedule?month=${sch.schedule_month}&year=${sch.schedule_year}`);
  } catch (err) {
    console.error(err);
    res.send('Ошибка при закрытии графика');
  }
});

// ================== //
// 6) Отчёты
// ================== //

/**
 * 6.1) Отчёт по отработанным часам:
 *      Менеджер выбирает месяц/год, получает CSV-файл вида:
 *      employee_id, full_name, total_hours
 */

// GET /manager/report/hours - форма выбора месяца/года
router.get('/report/hours', ensureManager, (req, res) => {
  res.render('manager_report_hours', {
    user: req.session.user
  });
});

// POST /manager/report/hours - формируем CSV
router.post('/report/hours', ensureManager, async (req, res) => {
  const { month, year } = req.body;
  if (!month || !year) {
    return res.send('Укажите месяц и год');
  }

  try {
    // Найдём все графики за данный месяц/год (обычно один)
    const [schRows] = await pool.query(`
      SELECT schedule_id FROM work_schedules
      WHERE schedule_month = ? AND schedule_year = ?
    `, [month, year]);

    if (schRows.length === 0) {
      return res.send('График не найден на выбранный месяц/год');
    }

    // Предположим, что один график (берём первый)
    const scheduleId = schRows[0].schedule_id;

    // Получаем суммарные часы по каждому сотруднику
    // JOIN employees, чтобы узнать ФИО
    const [rows] = await pool.query(`
      SELECT e.employee_id, e.full_name, SUM(d.hours) as total_hours
      FROM work_schedule_details d
      JOIN employees e ON d.employee_id = e.employee_id
      WHERE d.schedule_id = ?
      GROUP BY e.employee_id
    `, [scheduleId]);

    // Формируем CSV (можно сделать через res.setHeader + manual join)
    let csv = 'employee_id;full_name;total_hours\n';
    for (const r of rows) {
      csv += `${r.employee_id};${r.full_name};${r.total_hours}\n`;
    }

    // Отправляем как файл на скачивание
    const fileName = `hours_report_${month}_${year}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csv);

  } catch (err) {
    console.error(err);
    res.send('Ошибка при формировании отчёта по часам');
  }
});

/**
 * 6.2) Отчёт по поставкам:
 *      Менеджер выбирает месяц/год, получаем заявки, у которых status='completed'
 *      и created_at в выбранном месяце (или completed в выбранном месяце - зависит от требований).
 *      Формируем CSV: request_id, request_number, created_at, (можно добавить и суммарное кол-во)
 */

// GET /manager/report/requests - форма выбора месяца/года
router.get('/report/requests', ensureManager, (req, res) => {
  res.render('manager_report_requests', {
    user: req.session.user
  });
});

// POST /manager/report/requests - формируем CSV по поставкам
router.post('/report/requests', ensureManager, async (req, res) => {
  const { month, year } = req.body;
  if (!month || !year) {
    return res.send('Укажите месяц и год');
  }

  // Вариант: считать заявки завершёнными (status='completed') в этом месяце.
  // Можно по полю updated_at (когда статус поменялся) или по created_at.
  // Ниже пример - берём created_at в рамках (year-month).
  try {
    const [rows] = await pool.query(`
      SELECT request_id, request_number, created_at
      FROM requests
      WHERE status = 'completed'
        AND YEAR(created_at) = ?
        AND MONTH(created_at) = ?
      ORDER BY created_at
    `, [year, month]);

    let csv = 'request_id;request_number;created_at\n';
    for (const r of rows) {
      const [items] = await pool.query(`
        SELECT product_name, quantity FROM request_items
        WHERE request_id = ?
      `, [r.request_id]);
    
      const itemsString = items.map(i => `${i.product_name} (${i.quantity})`).join(', ');
    
      csv += `${r.request_id};${r.request_number};${r.created_at};${itemsString}\n`;
    }
    

    const fileName = `requests_report_${month}_${year}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csv);

  } catch (err) {
    console.error(err);
    res.send('Ошибка при формировании отчёта по поставкам');
  }
});

module.exports = router;
