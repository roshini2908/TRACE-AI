const express = require('express')
const { body } = require('express-validator')
const { register, login, me } = require('../controllers/authController')
const { protect } = require('../middleware/authMiddleware')
const { validate } = require('../middleware/validationMiddleware')

const router = express.Router()

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  register
)

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
)

router.get('/me', protect, me)

module.exports = router
