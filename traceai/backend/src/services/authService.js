const User = require('../models/User')
const generateToken = require('../utils/generateToken')

const registerUser = async ({ name, email, password }) => {
  const exists = await User.findOne({ email })
  if (exists) throw Object.assign(new Error('Email already registered'), { statusCode: 409 })

  const user = await User.create({ name, email, password })
  const token = generateToken(user._id)
  return { user, token }
}

const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password')
  if (!user || !(await user.matchPassword(password))) {
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 })
  }
  const token = generateToken(user._id)
  // Strip password before returning
  const userObj = user.toJSON()
  return { user: userObj, token }
}

const getMe = async (userId) => {
  const user = await User.findById(userId)
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 })
  return user
}

module.exports = { registerUser, loginUser, getMe }
