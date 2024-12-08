import express from "express"
import getAdmin from "../middleware/getAmin.middleware.js"
import {  updateUserPoints,getAdminToken,markOption,getLeaderBoard,getUncompletedForm, UserAuth,createFeedback,checkUserFeedback } from "../controllers/user.controller.js"

import otpSend from "../controllers/otpSend.js"




const router = express.Router()

router.route("/auth").post(UserAuth)
router.route("/findAdmin/:uniqueCode").get(getAdminToken)
router.route("/updatePoints/:id").post(updateUserPoints)

router.route("/leaderboard/:userId").get(getAdmin,getLeaderBoard)

router.route("/sendotp").post(otpSend)

router.route("/getFormId/:userId").get(getAdmin,getUncompletedForm)
router.route("/feedback/:userId").post(getAdmin,createFeedback)
router.route("/checkFeedback/:userId").get(getAdmin,checkUserFeedback)
router.route("/mark/:userId").post(markOption)


export default router