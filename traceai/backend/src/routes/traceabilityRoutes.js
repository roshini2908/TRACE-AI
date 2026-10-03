const express = require('express')
const { body } = require('express-validator')
const { getLinks, getLink, createLink, updateLink, deleteLink, getCoverage } = require('../controllers/traceabilityController')
const { protect } = require('../middleware/authMiddleware')
const { validate } = require('../middleware/validationMiddleware')

const router = express.Router()
router.use(protect)

router.route('/')
  .get(getLinks)
  .post(
    [
      body('projectId').notEmpty().withMessage('projectId required'),
      body('requirementId').notEmpty().withMessage('requirementId required'),
      body('componentId').notEmpty().withMessage('componentId required'),
    ],
    validate,
    createLink
  )

// Specific named routes BEFORE wildcard /:id
router.get('/coverage/:projectId', getCoverage)

router.route('/:id').get(getLink).put(updateLink).delete(deleteLink)

module.exports = router
