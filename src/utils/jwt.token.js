const jwt = require("jsonwebtoken");

const generateToken = (data) => {
  const encodedToken = jwt.sign(
    {
      email: data.email,
      id: data.id,
      role: data.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
  return encodedToken;
};

const decodeToken = async (token) => {
  const decodedToken = await jwt.verify(token, process.env.JWT_SECRET);
  return decodedToken;
};

module.exports = {
  generateToken,
  decodeToken,
};

