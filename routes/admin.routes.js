import express from "express"
import { loginAdmin, registerAdmin, resetLeaderBoard, getAllUsers, addForm, deleteForm, getForms, updateQuestion, updateOption, getFormsWithIds, getUsersAfterTaskStart,getAdminTaskDetails,resetResponse,downloadData} from "../controllers/admin.controller.js"
import { putTimer } from "../controllers/scehduleFunctions.js"
import getAdmin from "../middleware/getAmin.middleware.js"

const router = express.Router()



router.route("/register").post(registerAdmin)
router.route("/login").post(loginAdmin)


router.route("/resetLeaderBoard/:adminId").post(resetLeaderBoard)



router.route("/getAdmin/:adminId").get(getAdminTaskDetails)
router.route("/getAllusers/:adminId").get(getAllUsers)
router.route("/getSessionusers/:functionName/:adminId").get(getUsersAfterTaskStart)


// Timer
router.route("/putTimer/:adminId").post(putTimer)

router.route("/addForm/:adminId").post(addForm)


router.route("/getForm/:adminId").get(getForms)
router.route("/getFormWithId/:adminId").get(getFormsWithIds)

router.route("/download/:adminId").get(downloadData)

router.route("/resetResponse/:formId").delete(resetResponse)
router.route("/updateQuestion").put(updateQuestion)
router.route("/updateOption").put(updateOption)
router.route("/delete/:formId").delete(deleteForm)



export default router