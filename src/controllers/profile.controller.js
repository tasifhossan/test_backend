const profile = async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: "Valid JWT",
    email: req.email,
  });
};

module.exports = {
  profile,
};

