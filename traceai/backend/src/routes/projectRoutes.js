const express = require('express')
const { body } = require('express-validator')
const { getProjects, getProject, createProject, updateProject, deleteProject } = require('../controllers/projectController')
const { protect } = require('../middleware/authMiddleware')
const { validate } = require('../middleware/validationMiddleware')

const router = express.Router()
router.use(protect)

router.route('/')
  .get(getProjects)
  .post(
    [body('name').trim().notEmpty().withMessage('Project name is required')],
    validate,
    createProject
  )

router.route('/:id')
  .get(getProject)
  .put(updateProject)
  .delete(deleteProject)

module.exports = router
