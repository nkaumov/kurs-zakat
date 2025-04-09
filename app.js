// File: app.js
require('dotenv').config(); // Подгружаем .env

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const exphbs = require('express-handlebars');

const session = require('./config/session'); // наш session.js
const authRoutes = require('./routes/auth');
const indexRoutes = require('./routes/index');
const requestsRoutes = require('./routes/requests');
const managerRoutes = require('./routes/manager');

const app = express();

// Используем body-parser (или встроенные методы) для парсинга формы:
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Подключаем статические файлы (Materialize, наш CSS/JS и т. д.)
app.use(express.static(path.join(__dirname, 'public')));

// Подключаем сессии
app.use(session);

// Настраиваем Handlebars как шаблонизатор
app.engine('hbs', exphbs.engine({
  extname: 'hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views', 'layouts'),
  partialsDir: path.join(__dirname, 'views', 'partials')
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Роуты
app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/requests', requestsRoutes);
app.use('/manager', managerRoutes);

// Запуск
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
