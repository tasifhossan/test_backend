const pool = require("../config/db.js");
const { hashPassword } = require("../utils/validator.js");

const UserModel = {
  // Find by Email
  async findByEmail(email) {
    const datas = `
        SELECT  id,name,email,password,role,department_id
        FROM users
        WHERE email = $1;
        `;
    const result = await pool.query(datas, [email.toLowerCase()]);
    return result.rows[0] || null;
  },

  /*
    Insert a new user into DB(During Signup)
    returns Promise<object> the newly created user record
  */

  async createUser({ name, email, password, phone, department_id, role }) {
    const hashedPassword = await hashPassword(password);
    const queryText = `
  INSERT INTO users(name,email,phone,password,role,department_id)
  VALUES($1,$2,$3,$4,$5,$6)
  RETURNING id,name,email,role,phone,created_at;
  `;

    const result = await pool.query(queryText, [
      name,
      email.toLowerCase(),
      phone,
      hashedPassword,
      role,
      department_id,
    ]);

    return result.rows[0];
  },

  async loginUser({ email, password }) {
    const queryText = `
    SELECT id,email,password,role
    FROM users
    WHERE email = $1
    `;

    const result = await pool.query(queryText, [email]);
    return result.rows[0] || null;
  },

  //
};

module.exports = { UserModel };

