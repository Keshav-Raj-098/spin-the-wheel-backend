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
  const { username, password,secretKey } = req.body;

  if(!(secretKey===process.env.ADMIN_SECRET_KEY)){
    return res.status(200).json({ message: 'SecretKey Not Matched',})
  }

  try {
    // Find the admin by username
    const admin = await prisma.admin.findUnique({
      where: { username },
    });


    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }


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




export { registerAdmin, loginAdmin, resetLeaderBoard, getAllUsers, addForm, updateQuestion, updateOption, deleteForm, getForms, getFormsWithIds }