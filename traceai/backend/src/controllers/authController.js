const { registerUser, loginUser, getMe } = require('../services/authService')

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body
    const { user, token } = await registerUser({ name, email, password })
    res.status(201).json({ success: true, message: 'Registration successful', data: { user, token } })
  } catch (err) {
    next(err)
  }
}

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body
    const { user, token } = await loginUser({ email, password })
    res.status(200).json({ success: true, message: 'Login successful', data: { user, token } })
  } catch (err) {
    next(err)
  }
}

const me = async (req, res, next) => {
  try {
    const user = await getMe(req.user._id)
    res.status(200).json({ success: true, data: { user } })
  } catch (err) {
    next(err)
  }
}

module.exports = { register, login, me }
