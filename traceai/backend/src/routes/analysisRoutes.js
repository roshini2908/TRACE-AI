const express = require('express')
const { body } = require('express-validator')
const { createAnalysis, getAnalyses, getAnalysis, getHistory, rerunAnalysis, verifyComponent } = require('../controllers/analysisController')
const { protect } = require('../middleware/authMiddleware')
const { validate } = require('../middleware/validationMiddleware')

const router = express.Router()
router.use(protect)

router.route('/')
  .get(getAnalyses)
  .post(
    [
      body('requirementId').notEmpty().withMessage('requirementId required'),
      body('oldVersion').notEmpty().withMessage('oldVersion required'),
      body('newVersion').notEmpty().withMessage('newVersion required'),
    ],
    validate,
    createAnalysis
  )

router.get('/history/:projectId', getHistory)
router.route('/:id').get(getAnalysis)
router.post('/:id/rerun', rerunAnalysis)
router.put('/:analysisId/components/:componentId/verification',
  [body('verificationStatus').notEmpty().withMessage('verificationStatus required')],
  validate,
  verifyComponent
)

module.exports = router
