const express = require('express')
const { body } = require('express-validator')
const { getComponents, getComponent, createComponent, updateComponent, deleteComponent } = require('../controllers/componentController')
const { protect } = require('../middleware/authMiddleware')
const { validate } = require('../middleware/validationMiddleware')

const router = express.Router()
router.use(protect)

router.route('/')
  .get(getComponents)
  .post(
    [
      body('projectId').notEmpty().withMessage('projectId required'),
      body('componentId').notEmpty().withMessage('componentId required'),
      body('name').notEmpty().withMessage('name required'),
      body('type').notEmpty().withMessage('type required'),
    ],
    validate,
    createComponent
  )

router.route('/:id').get(getComponent).put(updateComponent).delete(deleteComponent)

module.exports = router
