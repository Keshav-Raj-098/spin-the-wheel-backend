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
      orderBy:{
        points:"desc"
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
  try {
    const { adminId } = req.params; // Admin ID from URL params
    const { formData } = req.body; // Expecting formData as request body

    // Step 1: Create the form
    const createdForm = await prisma.form.create({
      data: {
        adminId, // Link the form to the admin
      }
    });

    // Step 2: Create questions linked to the created form
    const createdQuestions = await Promise.all(
      formData.map(async (q) => {
        return await prisma.question.create({
          data: {
            question: q.question,
            formId: createdForm.id // Link the question to the created form
          }
        });
      })
    );

    // Step 3: Create options for each question
    await Promise.all(
      createdQuestions.map(async (question, index) => {
        const options = formData[index].options; // Get options for the current question
        await Promise.all(
          options.map(async (optionText) => {
            await prisma.options.create({
              data: {
                option: optionText,
                questionId: question.id // Link the option to the current question
              }
            });
          })
        );
      })
    );

    res.status(200).json({ message: "Form created successfully", form: createdForm });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating form", error });
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

const deleteForm = async (req, res) => {
  try {
    const { formId } = req.params; // Form ID from URL params

    // Step 1: Check if the form exists
    const form = await prisma.form.findUnique({
      where: { id: formId },
      include: {
        questions: true, // Ensure that questions are included to verify form integrity
      }
    });

    if (!form) {
      return res.status(404).json({ message: "No form found with the provided ID" });
    }

    const questionIds = form.questions.map((q) => q.id);

    // Step 2: Remove the form ID from all users who have completed the form (formDone array)
    await prisma.user.updateMany({
      where: {
        formDone: {
          has: formId // Users who have this formId in their formDone array
        }
      },
      data: {
        formDone: {
          set: [] // Clear the array before applying the filter
        }
      }
    });

    // Update the users' formDone array by filtering out the deleted form ID
    await prisma.user.updateMany({
      where: {
        formDone: {
          has: formId
        }
      },
      data: {
        formDone: {
          set: formDone.filter(f => f !== formId) // Remove formId from the array
        }
      }
    });

    // Step 3: Delete the related user responses (UserQuestion) for each question in the form
    await prisma.userQuestion.deleteMany({
      where: {
        questionId: {
          in: questionIds
        }
      }
    });

    // Step 4: Delete all options linked to the questions of this form
    await prisma.options.deleteMany({
      where: {
        questionId: {
          in: questionIds
        }
      }
    });

    // Step 5: Delete all questions related to the form
    await prisma.question.deleteMany({
      where: {
        formId: formId
      }
    });

    // Step 6: Finally, delete the form itself
    await prisma.form.delete({
      where: { id: formId }
    });

    // Response on successful deletion
    res.status(200).json({ message: "Form and all related questions, options, user responses, and user form records deleted successfully" });
  } catch (error) {
    console.error(error);

    // Check for specific errors and respond accordingly
    if (error.code === 'P2003') { // Foreign key constraint violation
      return res.status(400).json({ message: "Cannot delete form due to existing references" });
    }

    res.status(500).json({ message: "Error deleting form", error: error.message });
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



export { registerAdmin, loginAdmin, resetLeaderBoard, getAllUsers, addForm, updateQuestion, updateOption, deleteForm, getForms, getFormsWithIds,getUsersAfterTaskStart,getAdminTaskDetails}