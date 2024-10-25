import express from "express"
import {  updateUserPoints, markOption,getLeaderBoard,getFormById, getUncompletedForm, UserAuth,createFeedback } from "../controllers/user.controller.js"

import otpSend from "../controllers/otpSend.js"




const router = express.Router()

router.route("/auth/:adminId").post(UserAuth)
router.route("/updatePoints/:id").post(updateUserPoints)

router.route("/leaderboard/:userId/:adminId").get(getLeaderBoard)

router.route("/sendotp").post(otpSend)


router.route("/getForm/:formId/:userId").get(getFormById)
router.route("/getFormId/:adminId/:userId").get(getUncompletedForm)
router.route("/feedback/:adminId/:userId").post(createFeedback)
router.route("/mark/:userId/:adminId").post(markOption)


export default router