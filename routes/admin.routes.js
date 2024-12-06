import express from "express"
import { loginAdmin, registerAdmin, resetLeaderBoard, getAllUsers, addForm, deleteForm, getForms, updateQuestion, updateOption, getFormsWithIds, getUsersAfterTaskStart,getAdminTaskDetails,resetResponse,downloadData} from "../controllers/admin.controller.js"
import { putTimer } from "../controllers/scehduleFunctions.js"
import getAdmin from "../middleware/getAmin.middleware.js"

const router = express.Router()



router.route("/register").post(registerAdmin)
router.route("/login").post(loginAdmin)


router.route("/resetLeaderBoard").post(getAdmin,resetLeaderBoard)



router.route("/getAdmin").get(getAdmin,getAdminTaskDetails)
router.route("/getAllusers").get(getAdmin,getAllUsers)
router.route("/getSessionusers/:functionName").get(getAdmin,getUsersAfterTaskStart)


// Timer
router.route("/putTimer").post(getAdmin,putTimer)

router.route("/addForm").post(getAdmin,addForm)


router.route("/getForm").get(getAdmin,getForms)
router.route("/getFormWithId").get(getAdmin,getFormsWithIds)

router.route("/download").get(getAdmin,downloadData)

router.route("/resetResponse/:formId").delete(getAdmin,resetResponse)
router.route("/updateQuestion").put(updateQuestion)
router.route("/updateOption").put(updateOption)
router.route("/delete/:formId").delete(deleteForm)



export default router