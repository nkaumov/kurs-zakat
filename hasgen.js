// hashgen.js
const bcrypt = require('bcrypt');

(async () => {
  const plainChef = 'chef';
  const hashedChef = await bcrypt.hash(plainChef, 10);
  console.log(`Chef password hash: ${hashedChef}`);

  const plainManager = 'manager';
  const hashedManager = await bcrypt.hash(plainManager, 10);
  console.log(`Manager password hash: ${hashedManager}`);
})();
