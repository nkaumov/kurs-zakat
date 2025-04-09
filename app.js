// app.js
require('dotenv').config(); // подгружаем .env

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const exphbs = require('express-handlebars');

// Подключение сессий
const session = require('./config/session');

// Роуты
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const requestsRoutes = require('./routes/requests');
const managerRoutes = require('./routes/manager');

const app = express();

// Парсеры (можно было использовать встроенные методы express.json/express.urlencoded)
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Папка со статикой (css, js, картинки)
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

// Сессии
app.use(session);

// Настраиваем Handlebars
// ...
const hbsHelpers = {
  eq: function(a, b) {
    return a === b;
  },
  range: function(from, to, options) {
    // Генерирует массив [from..to], чтобы использовать {{#each (range 1 31)}}
    let result = [];
    for (let i = from; i <= to; i++) {
      result.push(i);
    }
    return result;
  },
  lookup: function(obj, key) {
    // Возвращает obj[key] || ""
    if (!obj) return "";
    return obj[key] || "";
  }
};
// ...


app.engine('hbs', exphbs.engine({
  extname: 'hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views', 'layouts'),
  partialsDir: path.join(__dirname, 'views', 'partials'),
  helpers: hbsHelpers
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Подключаем роуты
app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/requests', requestsRoutes);
app.use('/manager', managerRoutes);

// Запуск
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
