// import * as dotenv from 'dotenv'rs
// dotenv.config()

import express from 'express'
const app = express()



import cors from 'cors'
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {res.send('Spin The Wheel')})
    
    
import UserRouter from "./routes/user.routes.js"
app.use('/user', UserRouter);


import adminRouter from "./routes/admin.routes.js"
app.use('/admin', adminRouter);

    
const port = process.env.PORT || 3000

app.listen(port, () => {
    console.log(`App listening on port ${port}`)
})
