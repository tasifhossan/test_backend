const bcrypt = require("bcrypt");

async function hashPassword(password) {
  const hashedPassword = await bcrypt.hash(password, 10);
  return hashedPassword;
}

async function verifyPassword(userPassword, dbPassword) {
  const isMatch = await bcrypt.compare(userPassword, dbPassword);
  return isMatch;
}

module.exports = {
  hashPassword,
  verifyPassword,
};

