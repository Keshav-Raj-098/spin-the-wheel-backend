
import { log } from "console";
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
    const { username, password } = req.body;

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
            include: {
                answer: {
                    select: {
                        form1: true,
                        form2: true,
                        form3: true,
                    },
                },
            },
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
      
        const { optionId,optionText } = req.body; // Expecting new option text in the request body
  
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
      const {  questionId,questionText } = req.body; // Expecting new question text in the request body
  
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
  
      // Check if the form exists
      const form = await prisma.form.findUnique({
        where: {
          id: formId // Ensure we're querying with the correct field
        }
      });
  
      if (!form) {
        return res.status(404).json({ message: "No form found with the provided ID" });
      }
  
      // Step 1: Find questions linked to the form
      const questions = await prisma.question.findMany({
        where: {
          formId: formId, // Get all questions linked to the form
        },
        select: {
          id: true, // Only retrieve the question IDs
        },
      });
  
      const questionIds = questions.map(question => question.id); // Extract question IDs
  
      // Step 2: Find options linked to those questions
      const options = await prisma.options.findMany({
        where: {
          questionId: {
            in: questionIds // Match options linked to the retrieved question IDs
          }
        },
        select: {
          id: true // Only retrieve the option IDs
        }
      });
  
      const optionIds = options.map(option => option.id); // Extract option IDs
  
      // Step 3: Delete UserOptions associated with the options
      await prisma.userOptions.deleteMany({
        where: {
          optionId: {
            in: optionIds // Match UserOptions linked to the retrieved option IDs
          }
        }
      });
  
      // Step 4: Delete options linked to those questions
      await prisma.options.deleteMany({
        where: {
          questionId: {
            in: questionIds // Match options linked to the retrieved question IDs
          }
        }
      });
  
      // Step 5: Delete questions linked to the form
      await prisma.question.deleteMany({
        where: {
          formId: formId
        }
      });
  
      // Step 6: Delete the form itself
      await prisma.form.delete({
        where: {
          id: formId
        }
      });
  
      // Response on successful deletion
      res.status(200).json({ message: "Form, questions, and options deleted successfully" });
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
  
  
export { registerAdmin, loginAdmin, resetLeaderBoard,getAllUsers,addForm,updateQuestion,updateOption,deleteForm,getForms }