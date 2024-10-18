import express from "express"
import { UserRegister,UserLogin,updateUserPoints,getForms, markOption } from "../controllers/user.controller.js"






const router = express.Router()



router.route("/register").post(UserRegister)
router.route("/login").post(UserLogin)
router.route("/updatePoints/:id").post(updateUserPoints)

router.route("/getForm/:adminId").get(getForms)
router.route("/mark/:userId/:optionId").post(markOption)


export default router