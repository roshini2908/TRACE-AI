const express = require('express')
const { body } = require('express-validator')
const {
  getRequirements, getRequirement, createRequirement, updateRequirement, deleteRequirement,
  addVersion, listVersions, compareReqVersions,
} = require('../controllers/requirementController')
const { protect } = require('../middleware/authMiddleware')
const { validate } = require('../middleware/validationMiddleware')

const router = express.Router()
router.use(protect)

router.route('/')
  .get(getRequirements)
  .post(
    [
      body('projectId').notEmpty().withMessage('projectId required'),
      body('reqId').notEmpty().withMessage('reqId required'),
      body('title').notEmpty().withMessage('title required'),
      body('description').notEmpty().withMessage('description required'),
    ],
    validate,
    createRequirement
  )

router.route('/:id').get(getRequirement).put(updateRequirement).delete(deleteRequirement)

router.route('/:id/versions').get(listVersions).post(addVersion)
router.get('/:id/compare/:oldVer/:newVer', compareReqVersions)

module.exports = router
