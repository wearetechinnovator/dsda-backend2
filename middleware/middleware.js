const jwt = require('jsonwebtoken');
const JWT_KEY = process.env.JWT_KEY;

const middleware = async (req, res, next) => {
  try {
    let token;

    if (req.method === "POST") {
      token = req.body?.token;
    } else {
      token = req.headers?.authorization?.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_KEY);
    req.user = decoded;
    next();

  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
  
};

module.exports = middleware;
