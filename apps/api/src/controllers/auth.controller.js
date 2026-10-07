const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretjwtkey_tapbirr_123', {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      message: 'Request payload has missing or invalid fields',
      details: errors.array()
    });
  }

  try {
    const { fullName, email, phoneNumber, password } = req.body;

    // Check if user exists
    const userExists = await User.findOne({
      where: {
        [Op.or]: [{ email }, { phoneNumber }]
      }
    });

    if (userExists) {
      return res.status(409).json({
        success: false,
        errorCode: 'CONFLICT',
        message: 'User with this email or phone number already exists.',
        details: null
      });
    }

    // Create user
    const user = await User.create({
      fullName,
      email,
      phoneNumber,
      password
    });

    if (user) {
      res.status(201).json({
        success: true,
        token: generateToken(user.id),
        userId: user.id,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      message: 'Request payload has missing or invalid fields',
      details: errors.array()
    });
  }

  try {
    const { email, password } = req.body;

    // Check for user email
    const user = await User.findOne({ where: { email } });

    if (user && (await user.matchPassword(password))) {
      res.status(200).json({
        success: true,
        token: generateToken(user.id),
        userId: user.id,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber
        }
      });
    } else {
      res.status(401).json({
        success: false,
        errorCode: 'INVALID_CREDENTIALS',
        message: 'Incorrect email or password.',
        details: null
      });
    }
  } catch (error) {
    next(error);
  }
};
