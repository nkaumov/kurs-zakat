// config/session.js
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const options = {
  host: process.env.DB_HOST,
  port: 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
};

const sessionStore = new MySQLStore(options);

module.exports = session({
  key: 'kursovaya_session_cookie',
  secret: process.env.SESSION_SECRET || 'secret_key',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    // Пример: срок жизни cookie 1 час
    maxAge: 1000 * 60 * 60
  }
});
