const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const authenticateUser = require('../middleware/auth');

const router = express.Router();

// Multer setup for avatar upload (optional)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/avatars/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Register
router.post('/register', upload.single('avatar'), async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const avatar = req.file ? `/avatars/${req.file.filename}` : undefined;
    const user = new User({ name, email, password, avatar });
    await user.save();
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const userObj = user.toObject();
    delete userObj.password;
    res.status(201).json({ user: userObj, token });
  } catch (err) {
    res.status(400).json({ error: 'Registration failed', details: err });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const userObj = user.toObject();
    delete userObj.password;
    res.json({ user: userObj, token });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Google Auth (if you want it)
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, name, avatar: picture, password: Math.random().toString(36) });
      await user.save();
    }

    const jwtToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const userObj = user.toObject();
    delete userObj.password;
    res.json({ user: userObj, token: jwtToken });
  } catch (err) {
    res.status(401).json({ error: 'Google authentication failed', details: err.message });
  }
});

// Profile Update
router.put('/profile', authenticateUser, upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.userId;
    const updates = req.body;
    if (req.file) {
      updates.avatar = `/avatars/${req.file.filename}`;
    }
    const user = await User.findByIdAndUpdate(userId, updates, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const userObj = user.toObject();
    delete userObj.password;
    res.json(userObj);
  } catch (err) {
    res.status(400).json({ error: 'Profile update failed', details: err.message });
  }
});

// Dummy Logout (optional, for frontend compatibility)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out' });
});

module.exports = router;
