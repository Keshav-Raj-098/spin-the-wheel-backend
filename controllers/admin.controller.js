import { prisma } from "../prisma/prisma.js";
import bcrypt from 'bcrypt';


// Function to create an admin
const registerAdmin = async (req, res) => {
  const { username, password } = req.body;

  try {

    const existingAdmin = await prisma.admin.findUnique({
      where: { username },
    });

    if (existingAdmin) {
      return res.status(400).json({ message: 'Username already taken' });
    }


    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new admin record
    const newAdmin = await prisma.admin.create({
      data: {
        username,
        password: hashedPassword,
      },
    });

    res.status(201).json(newAdmin);
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Function to log in an admin
const loginAdmin = async (req, res) => {
  const { username, password, secretKey } = req.body;

  console.log(req.body); // Log incoming request body

  // Validate the presence of the secret key
  if (secretKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(403).json({ message: 'Secret Key Not Matched' });
  }

  // Validate the presence of required fields
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
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

    // Successful login
    return res.status(200).json({ message: 'Login successful', admin });
  } catch (error) {
    console.error('Error logging in admin:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Reset Leaderboard
const resetLeaderBoard = async (req, res) => {
  try {
    // Update all users' points to 0
    const resetStatus = await prisma.user.updateMany({
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

// get all users
const getAllUsers = async (req, res) => {
  try {
    // Fetch all users from the database
    const users = await prisma.user.findMany({
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

  const { adminId } = req.params;
  const { formData,isSurvey,formName } = req.body;

  console.log(req.body);

  try {
    
    

    // Validation
    if (!adminId || !formData || isSurvey || !Array.isArray(formData)) {
      return res.status(400).json({
        message: "Invalid input: adminId and formData array are required"
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
        return res.status(400).json({ message: "Each question must have at least one correct option when isSurvey is false." });
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
};


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
  const { adminId } = req.params; // Assuming you have admin ID from the authenticated user

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

    // Format the forms without `createdAt` and `updatedAt`
    const formattedForms = forms.map(form => ({
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
  const { adminId } = req.params; // Assuming you have admin ID from the authenticated user

  try {
    const forms = await prisma.form.findMany({
      where: {
        adminId: adminId,
      },
      include: {
        questions: {
          include: {
            options: {
              orderBy: {
                createdAt: 'asc', // Order options by earliest created first
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

    // Format the forms without `createdAt` and `updatedAt`
    const formattedForms = forms.map(form => ({
      formid: form.id,
      form: form.questions.map(question => ({
        question: question.question,
        questionId: question.id,
        options: question.options.map(option => ({
          id: option.id, // Include option ID
          option: option.option, // Extracting option text
        })),
      })),
    }));

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

    // Validate formId format (assuming UUID)
    if (!formId || !/^[0-9a-fA-F-]{36}$/.test(formId)) {
      return res.status(400).json({
        message: "Invalid form ID format"
      });
    }

    // Use a transaction to ensure all operations succeed or none do
    await prisma.$transaction(async (tx) => {
      // Check if form exists and get related data in a single query
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

      // Get all question IDs for this form
      const questionIds = form.questions.map(q => q.id);

      // Step 1: Update users' formDone arrays
      // First, get all users who have this form in their formDone array
      const usersWithForm = await tx.user.findMany({
        where: {
          formDone: {
            has: formId
          }
        },
        select: {
          id: true,
          formDone: true
        }
      });

      // Update each user's formDone array
      if (usersWithForm.length > 0) {
        await tx.user.updateMany({
          where: {
            id: {
              in: usersWithForm.map(u => u.id)
            }
          },
          data: {
            formDone: {
              set: [] // Clear array first
            }
          }
        });

        // Update each user individually with their filtered formDone array
        await Promise.all(
          usersWithForm.map(user =>
            tx.user.update({
              where: { id: user.id },
              data: {
                formDone: {
                  set: user.formDone.filter(f => f !== formId)
                }
              }
            })
          )
        );
      }

      // Step 2: Delete all related records in the correct order
      // Delete UserQuestion records
      await tx.userQuestion.deleteMany({
        where: {
          questionId: {
            in: questionIds
          }
        }
      });

      // Delete Options records
      await tx.options.deleteMany({
        where: {
          questionId: {
            in: questionIds
          }
        }
      });

      // Delete Question records
      await tx.question.deleteMany({
        where: {
          formId: formId
        }
      });

      // Finally, delete the Form
      await tx.form.delete({
        where: {
          id: formId
        }
      });
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
  const { adminId, functionName } = req.params;

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

    const { updatedAt } = task; // Use updatedAt instead of startTime

    // Step 2: Find unique userIds from UserQuestion where createdAt is after updatedAt
    const userQuestions = await prisma.userQuestion.findMany({
      where: {
        createdAt: {
          gt: updatedAt,  // created after the task's updatedAt
        },
      },
      select: {
        userId: true,
      },
      distinct: ['userId'],  // Ensure we get unique userIds
    });

    const userIds = userQuestions.map((uq) => uq.userId);

    if (userIds.length === 0) {
      return res.status(200).json({
        message: 'No users found after the task\'s updated time',
        users: [],
      });
    }

    // Step 3: Fetch the users based on the found userIds, and retrieve their name and points
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        name: true,
        points: true,
      },
      orderBy:{
         points: "desc"
      }
    });

    return res.status(200).json({
      message: 'Users retrieved successfully',
      users: users,
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
  const adminId = req.params.adminId;

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
        updatedAt: timeAgo(task.updatedAt),
        timeLeft: formatTimeLeft(timeLeft), // Format it to a readable string
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

// Helper function to format time left
const formatTimeLeft = (milliseconds) => {
  const sec = Math.floor((milliseconds / 1000) % 60);
  const min = Math.floor((milliseconds / (1000 * 60)) % 60);
  const hr = Math.floor((milliseconds / (1000 * 60 * 60)) % 24);
  const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));

  // Create an array to hold time parts
  const timeParts = [];

  if (days > 0) timeParts.push(`${days}day${days > 1 ? 's' : ''}`);
  if (hr > 0) timeParts.push(`${hr}hour${hr > 1 ? 's' : ''}`);
  if (min > 0) timeParts.push(`${min}min${min > 1 ? 's' : ''}`);
  // if (sec > 0) timeParts.push(`${sec}sec${sec > 1 ? 's' : ''}`);

  // Join the parts into a single string, or return null if all parts are zero
  return timeParts.length > 0 ? timeParts.join(' ') : null;
};


function timeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  const seconds = diffInSeconds;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);


  if (seconds < 60) {
    return `${seconds} seconds ago`;
  } else if (minutes < 60) {
    return `${minutes} minutes ago`;
  } else if (hours < 24) {
    return `${hours} hours ago`;
  } else if (days < 7) {
    return `${days} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

async function resetMarkedCountForOptions(req, res) {
  try {
    // Update all options and set markedCount to 0
    const updatedOptions = await prisma.options.updateMany({
      data: {
        markedCount: 0,
      },
    });

    // Return a success response with the number of updated records
    res.status(200).json({
      message: 'All options have been reset to zero.',
      count: updatedOptions.count,
    });
  } catch (error) {
    console.error('Error resetting markedCount:', error);
    res.status(500).json({ error: 'An error occurred while resetting markedCount.' });
  }
}


export { registerAdmin, loginAdmin, resetLeaderBoard, getAllUsers, addForm, updateQuestion, updateOption, deleteForm, getForms, getFormsWithIds, getUsersAfterTaskStart, getAdminTaskDetails,resetMarkedCountForOptions }