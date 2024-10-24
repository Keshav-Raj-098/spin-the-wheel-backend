import express from "express"
import {  updateUserPoints, markOption, getFormById, getUncompletedForm, UserAuth,createFeedback } from "../controllers/user.controller.js"






const router = express.Router()

router.route("/auth/:adminId").post(UserAuth)
router.route("/updatePoints/:id").post(updateUserPoints)
router.route("/getForm/:formId/:userId").get(getFormById)
router.route("/getFormId/:adminId/:userId").get(getUncompletedForm)
router.route("/feedback/:adminId/:userId").post(createFeedback)
router.route("/mark/:userId").post(markOption)


export default router