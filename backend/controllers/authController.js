const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../db/models");

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "7d" },
  );
};

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    console.log(`📝 Register attempt: ${username} | ${email}`);

    // 1. Check if EMAIL exists
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      console.log("❌ Email already exists");
      return res.status(400).json({ message: "Email already exists" });
    }

    // 2. Check if USERNAME exists
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      console.log("❌ Username already exists");
      return res.status(400).json({ message: "Username already taken" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create User
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    console.log(`✅ User created: ${newUser.id}`);

    const token = generateToken(newUser);

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        avatar: newUser.avatar,
      },
      token,
    });
  } catch (error) {
    console.error("🔥 CRITICAL REGISTER ERROR:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = generateToken(user);

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
      },
      token,
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { register, login };
