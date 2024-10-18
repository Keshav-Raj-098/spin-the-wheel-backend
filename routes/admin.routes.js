import express from "express"
import { loginAdmin, registerAdmin,resetLeaderBoard,getAllUsers,addForm, deleteForm, getForms, updateQuestion, updateOption } from "../controllers/admin.controller.js"


const router = express.Router()



router.route("/register").post(registerAdmin)
router.route("/login").post(loginAdmin)
router.route("/resetLeaderBoard").post(resetLeaderBoard)
router.route("/getAllusers/:adminId").get(getAllUsers)
router.route("/addForm/:adminId").post(addForm)
router.route("/getForm/:adminId").get(getForms)
router.route("/updateQuestion").put(updateQuestion)
router.route("/updateOption").put(updateOption)
router.route("/delete/:formId").delete(deleteForm)



export default router