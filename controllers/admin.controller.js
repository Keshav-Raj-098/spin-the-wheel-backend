import { prisma } from "../prisma/prisma.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import  dotenv from "dotenv";

dotenv.config();
// Function to generate a token
const generateToken = (adminId) => {
  const payload = { adminId };
  const options = {
    expiresIn: process.env.TOKEN_EXPIRY, // Token expires in 1 hour
  };

  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, options);
};

// Function to create an admin
const registerAdmin = async (req, res) => {
  const { username, password, uniqueCode } = req.body;

  if (!username || !password || !uniqueCode) {
    return res.status(400).json({ message: 'Username, password, and unique code are required' });
  }

  try {
    const existingAdmin = await prisma.admin.findUnique({
      where: { username },
    });

    if (existingAdmin) {
      return res.status(408).json({ message: 'Username already taken' });
    }
    const existingUniqueCode = await prisma.admin.findUnique({
      where: { uniqueCode },
    });

    if (existingUniqueCode) {
      return res.status(409).json({ message: 'Unique code already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new admin record
    const newAdmin = await prisma.admin.create({
      data: {
        username,
        password: hashedPassword,
        uniqueCode, // Add unique code here
      },
    });

    
    
    const token = generateToken(newAdmin.id);
    
     const timerTask1 = await prisma.task.create({
      data: {
        functionToRun:"setAllCareerPointsToZero",
        adminId:newAdmin.id,
      }
     })

     const timerTask2 = await prisma.task.create({
      data: {
        functionToRun:"sessionWinner",
        adminId:newAdmin.id,
      }
     })

     if(!timerTask1 || !timerTask2){
        return res.status(500).json({ message: 'Error creating timer tasks' });
     }


    res.status(201).json({ admin:newAdmin, token });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Function to log in an admin
const loginAdmin = async (req, res) => {
  const { username, password } = req.body;

  console.log(req.body); // Log incoming request body

  // Validate the presence of required fields
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required. *****' });
  }

  try {
    // Find the admin by username
    const admin = await prisma.admin.findUnique({
      where: { username },
    });

    // Check if admin exists and verify the password
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = generateToken(admin.id);

    console.log(token);
    

    // Successful login
    return res.status(200).json({ message: 'Login successful', admin, token });
  } catch (error) {
    console.error('Error logging in admin:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Reset Leaderboard **************************************
const resetLeaderBoard = async (req, res) => {
  const adminId = req.adminId
  try {
      const Forms = await prisma.admin.findMany({
      where:{adminId:adminId}

    }) 
    console.log(Forms);
   
    if(Forms.length === 0){ 
      res.status(404).json({ message: 'Create Form First' });
    }

    const formIds = Forms.map((form) => form.id);
    
    const uniqueUserIds = await prisma.userForm.findMany({
      where: {
        formId: { in: formIds },
      },
      select: {
        userId: true,
      },
      distinct:['userId']
    });
    
    // Extract unique userIds
    const userIds = [...new Set(uniqueUserIds.map(item => item.userId))];
    
    console.log(userIds);


    // Update all users' points to 0
    const resetStatus = await prisma.user.updateMany({
      where:{
        id:{in:userIds}
      },
      data: {
        points: 0,
      },
    });

    if (!resetStatus) {
      return res.status(502).json({ message: 'Error while resetting the leaderboard' });
    }

    return res.status(200).json({ message: 'Leaderboard reset successfully' });
  } catch (error) {
    console.error('Error resetting leaderboard:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// get all users ******************************************
const getAllUsers = async (req, res) => {
  const adminId  = req.adminId;

  console.log(adminId);
  
  try {
    const forms = await prisma.form.findMany({
      where: { adminId:adminId },
      select: {
        userForms: {
          select: {
            userId: true
          }
        }
      }
    });
 

    if(!forms){ 
      res.status(404).json({ message: 'Create Form First' });
    }

    const userIds = [...new Set(forms.flatMap(form => form.userForms.map(uf => uf.userId)))];
    
    console.log("getAllusers -> ",userIds);
    // Fetch all users from the database
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        name: true,    // Scalar fields like name
        gender: true,  // Optional scalar field
        age: true,     // Optional scalar field
        points: true,  // Scalar field
      },
      orderBy: {
        points: "desc"
      }
    });

    // Return the users in the response
    res.status(200).json(users);
  } catch (error) {
    console.error('Error retrieving users:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


const addForm = async (req, res) => {

  const adminId  = req.adminId;
  const { formData, isSurvey, formName } = req.body;
  
  console.log(adminId);
  
  console.log(req.body);

  try {
    // Validation
    if (!adminId || !formData || !Array.isArray(formData) || typeof isSurvey !== 'boolean' || !formName) {
      return res.status(400).json({
        message: "Invalid input: adminId, formData array, isSurvey, and formName are required"
      });
    }

    // Validate formData structure
    const isValidFormData = formData.every(item =>
      item.question &&
      Array.isArray(item.options) &&
      item.options.length > 0
    );

    if (!isValidFormData) {
      return res.status(400).json({
        message: "Invalid formData structure: each item must have a question and non-empty options array"
      });
    }


    if (!isSurvey) {
      // Loop through each question in formData
      const allQuestionsValid = formData.every(question => {
        // Check if at least one option has isCorrect set to true
        return question.options.some(option => option.isCorrect === true);
      });
    
      if (!allQuestionsValid) {
        console.log("Each question must have at least one correct option when isSurvey is false.");
        return res.status(400).json({ message:"Each question must have at least one correct option when isSurvey is false."});
      }
    }

    // Check if admin exists
    const adminExists = await prisma.admin.findUnique({
      where: { id: adminId }
    });

    if (!adminExists) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Use a transaction to ensure data consistency
    const result = await prisma.$transaction(async (prisma) => {
      // Create form
      const form = await prisma.form.create({
        data: {
          adminId,
          name:formName,
          isSurvey:isSurvey
        }
      });

      // Create questions and options in a more efficient way
      const questions = await Promise.all(
        formData.map(async (questionData) => {
          const question = await prisma.question.create({
            data: {
              question: questionData.question,
              multiple:questionData.multiple,
              textAllowed:questionData.textAllowed,        
              formId: form.id,
              options: {
                create: questionData.options.map((option) => ({
                  option: option.text,
                  isCorrect:option.isCorrect
                }))
              }
            },
            include: {
              options: true
            }
          });
          return question;
        })
      );

      return { form, questions };
    });

    res.status(201).json({
      message: "Form created successfully",
      data: {
        form: result.form,
        questions: result.questions
      }
    });

  } catch (error) {
    console.error('Form creation error:', error);

    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      return res.status(409).json({
        message: "A unique constraint violation occurred"
      });
    }

    if (error.code === 'P2003') {
      return res.status(400).json({
        message: "Foreign key constraint failed"
      });
    }

    res.status(500).json({
      message: "Internal server error while creating form",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}


const updateOption = async (req, res) => {
  try {

    const { optionId, optionText } = req.body; // Expecting new option text in the request body

    // Step 1: Find the option to be updated
    const option = await prisma.options.findUnique({
      where: {
        id: optionId // Check for the option's existence
      }
    });

    if (!option) {
      return res.status(404).json({ message: "Option not found" });
    }

    // Step 2: Update the option text
    await prisma.options.update({
      where: {
        id: optionId // Match option by its ID
      },
      data: {
        option: optionText // Update the option text
      }
    });

    // Response on successful update
    res.status(200).json({ message: "Option updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating option", error: error.message });
  }
};

const updateQuestion = async (req, res) => {
  try {
    const { questionId, questionText } = req.body; // Expecting new question text in the request body

    // Step 1: Find the question to be updated
    const question = await prisma.question.findUnique({
      where: {
        id: questionId // Check for the question's existence
      }
    });

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    // Step 2: Update the question text
    await prisma.question.update({
      where: {
        id: questionId // Match question by its ID
      },
      data: {
        question: questionText // Update the question text
      }
    });

    // Response on successful update
    res.status(200).json({ message: "Question updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating question", error: error.message });
  }
};


const getForms = async (req, res) => {
  const adminId  = req.adminId; // Assuming you have admin ID from the authenticated user
    
  console.log("AdminId",adminId)
  try {
    const forms = await prisma.form.findMany({
      where: {
        adminId: adminId,
      },
      include: {
        questions: {
          include: {
            options: {
              select: {
                option: true, // Extracting option text
                markedCount: true, // Include markedCount
              },
            },
          },
          orderBy: {
            createdAt: 'asc', // Order questions by earliest created first
          },
        },
      },
      orderBy: {
        updatedAt: 'asc', // Order forms by earliest updated first
      },
    });
      
    if(!forms){
      return res.status(209).json({ message: 'No forms found' });
    }

    // Format the forms without `createdAt` and `updatedAt`
    const formattedForms = forms.map(form => ({
      name: form.name,
      id:form.id,
      questions: form.questions.map(question => ({
        question: question.question,
        options: question.options.map(option => ({
          option: option.option, // Extracting option text
          markedCount: option.markedCount, // Include markedCount
        })),
      })),
    }));
    
    res.status(200).json(formattedForms);
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


const getFormsWithIds = async (req, res) => {
  const adminId  = req.adminId; // Assuming you have admin ID from the authenticated user

  try {
    const forms = await prisma.form.findMany({
      where: {
        adminId: adminId,
      },
      include: {
        questions: {
          include: {
            options: {
              
            },
          },
        },
      },
    });

    // Format the forms without `createdAt` and `updatedAt`
    const formattedForms = forms.map(form => ({
      formid: form.id,
      name: form.name,
      form: form.questions.map(question => ({
        question: question.question,
        questionId: question.id,
        options: question.options.map(option => ({
          id: option.id, // Include option ID
          option: option.option, // Extracting option text
        })),
      })),
    }));

    if(!forms){
      return res.status(209).json({ message: 'No forms found' });
    }

    res.status(200).json(formattedForms);
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

// Delete Form

const deleteForm = async (req, res) => {
  const { formId } = req.params;
  try {

    // Use a transaction to ensure all operations succeed or none do
    await prisma.$transaction(async (tx) => {
      // Step 1: Check if the form exists
      const form = await tx.form.findUnique({
        where: { id: formId },
        include: {
          questions: {
            include: {
              options: true,
              userQuestions: true
            }
          }
        }
      });
    
      if (!form) {
        throw new Error('Form not found');
      }
    
      // Step 2: Collect question IDs
      const questionIds = form.questions.map(q => q.id);
    
      // Step 3: Delete related records
      if (questionIds.length > 0) {
        await tx.userQuestion.deleteMany({
          where: { questionId: { in: questionIds } }
        });
    
        await tx.options.deleteMany({
          where: { questionId: { in: questionIds } }
        });
    
        await tx.question.deleteMany({
          where: { formId }
        });
      }
    
      // Delete user forms, if any
      await tx.userForm.deleteMany({ where: { formId } });
    
      // Step 4: Delete the form itself
      await tx.form.delete({ where: { id: formId } });
    });
    

    return res.status(200).json({
      success: true,
      message: "Form and all related data successfully deleted"
    });

  } catch (error) {
    console.error('Delete form error:', error);

    if (error.message === 'Form not found') {
      return res.status(404).json({
        success: false,
        message: "Form not found"
      });
    }

    // Handle specific Prisma errors
    if (error.code === 'P2003') {
      return res.status(400).json({
        success: false,
        message: "Cannot delete form due to existing references"
      });
    }

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: "Record to delete does not exist"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error while deleting form",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


const getUsersAfterTaskStart = async (req, res) => {
  const { functionName } = req.params;

  const adminId = req.adminId;

  try {
    // Step 1: Find the task using adminId and functionToRun
    const task = await prisma.task.findFirst({
      where: {
        adminId: adminId,
        functionToRun: functionName,
      },
      select: {
        id: true,
        updatedAt: true,  // Use updatedAt for comparison
      },
    });

    if (!task) {
      return res.status(404).json({
        message: 'Task not found',
      });
    }

    console.log(task);
    

    const { updatedAt } = task; // Use updatedAt instead of startTime


    const formCreatedByAdmin = await prisma.form.findMany({
      where:{
        adminId:adminId
      },
      select:{
        id:true
      }
    })

    const formIds = formCreatedByAdmin.map(form => form.id);

    const uniqueUserIds = await prisma.userForm.findMany({
      where: {
      formId: { in: formIds },
      createdAt: { gt: updatedAt },
      },
      select: {
      userId: true,
      },
      distinct: ['userId'],
    });

    const userIds = uniqueUserIds.map((item) => item.userId);

    const getUser = await prisma.user.findMany({
      where: {
      id: { in: userIds },
      },
      select: {
      name: true,
      points: true,
      },
      orderBy: {
      points: "desc",
      },
    });

    console.log(getUser);
    

    

    return res.status(200).json({
      message: 'Users retrieved successfully',
      users: getUser,
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      message: 'An error occurred while fetching users',
      error: error.message,
    });
  }
};


const getAdminTaskDetails = async (req, res) => {
  const adminId = req.adminId;

  try {
    // Fetch the admin with the lastSessionWinners and all associated tasks
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      include: {
        task: {
          orderBy: { updatedAt: 'desc' }, // Still ordering by updatedAt
        },
      },
    });

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Create an object for tasks keyed by functionToRun
    const tasksWithDetails = {};

    admin.task.forEach(task => {
      const currentTime = new Date();
      const durationInMilliseconds = task.durationValue * getDurationMultiplier(task.durationUnit);
      const taskEndTime = new Date(task.updatedAt.getTime() + durationInMilliseconds);

      const timeLeft = Math.max(0, taskEndTime - currentTime);

      tasksWithDetails[task.functionToRun] = {
        updatedAt:convertToIST(task.updatedAt),
        timeLeft:convertToIST(taskEndTime), // Format it to a readable string
      };
    });

    res.json({
      lastSessionWinners: admin.lastSessionWinners,
      tasks: tasksWithDetails, // Return tasks as an object
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Helper functions (getDurationMultiplier and formatTimeLeft) remain unchanged

// Helper function to get duration in milliseconds based on the unit
const getDurationMultiplier = (unit) => {
  switch (unit) {
    case 'minutes':
      return 60 * 1000; // Convert minutes to milliseconds
    case 'hours':
      return 60 * 60 * 1000; // Convert hours to milliseconds
    case 'days':
      return 24 * 60 * 60 * 1000; // Convert days to milliseconds
    default:
      return 0; // Invalid unit
  }
};

function convertToIST(utcTime) {
  const utcDate = new Date(utcTime); // Convert the string to a Date object
  
  // Format the date in IST directly
  return utcDate.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', // Set timezone to IST
    hour12: true,             // 12-hour format
  });
}


async function resetResponse(req, res) {

  const {formId} = req.params

  if(!formId){
    return res.status(402).json({message:"Form Id Required"})
  }
  try {
    
        // Find all questions related to the given formId
        const questions = await prisma.question.findMany({
          where: {
            formId: formId,
          },
          select: {
            id: true, // Retrieve only the question IDs
          },
        });

        if(!questions){
          return res.status(403).json({message:"This Form does not contain any Question"})
        }
    
        // Extract question IDs
        const questionIds = questions.map((q) => q.id);
    
          // Reset markedCount for all options related to these questions
          const result = await prisma.options.updateMany({
            where: {
              questionId: {
                in: questionIds, // Match options linked to the question IDs
              },
            },
            data: {
              markedCount: 0, // Set markedCount to 0
            },
          });
    
        
          const deleteResponse = await prisma.userQuestion.deleteMany({
            where:{
              questionId:{
                in:questionIds
              }
            }
          })

          const deleteFormDone = await prisma.userForm.deleteMany({
            where:{
              formId:formId
            }
          })
        
   

    // Return a success response with the number of updated records
    res.status(200).json({
      message: 'Reset response Successfull',
    });
  } catch (error) {
    console.error('Error resetting markedCount:', error);
    res.status(500).json({ error: 'An error occurred while resetting markedCount.' });
  }
}



export { registerAdmin, loginAdmin, resetLeaderBoard, getAllUsers, addForm, updateQuestion, updateOption, deleteForm, getForms, getFormsWithIds, getUsersAfterTaskStart, getAdminTaskDetails,resetResponse }