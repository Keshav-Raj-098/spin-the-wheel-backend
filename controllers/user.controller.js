import { prisma } from "../prisma/prisma.js";

const UserRegister = async (req, res) => {
    try {
        const { name, email, gender, age } = req.body; // Include gender and age

        // Create the user in the database
        const user = await prisma.user.create({
            data: {
                name,
                email,
                gender,
                age,
            },
        });

        // If the user creation fails, handle the error
        if (!user) {
            return res.status(400).json({ message: "Server busy, can't register you" });
        }

        // Respond with success
        return res.status(201).json({ userId: user.id, message: "Registered Successfully" });
    } catch (error) {
        console.error('Error during user registration:', error);
        return res.status(500).json({ message: "Error in registration process" });
    }
};

const UserLogin = async (req, res) => {
    try {
        const { name, email } = req.body; // Login will only use name and email

        // Find the user by email and name
        const user = await prisma.user.findUnique({
            where: {
                email,
            },
        });

        // If user not found, return an error
        if (!user || user.name !== name) {
            return res.status(404).json({ message: "User not found or name does not match" });
        }

        // Return only the userId on successful login
        return res.status(200).json({ userId: user.id, message: "Login successful" });
    } catch (error) {
        console.error('Error during user login:', error);
        return res.status(500).json({ message: "Internal server error" });
    }
};


// Update Points
const updateUserPoints = async (req, res) => {
    const { id } = req.params; // Get user ID from the request parameters
    const { points } = req.body; // Get new points value from the request body

    try {
        // Fetch the current user data
        const user = await prisma.user.findUnique({
            where: { id },
            select: { points: true }, // Select only the points field
        });

        if (!user) {
            return res.status(404).json({
                message: 'User not found',
            });
        }

        // Calculate the new points value
        const newPoints = (user.points || 0) + points; // Add points to existing ones

        // Update the user points in the database
        const updatedUser = await prisma.user.update({
            where: { id },
            data: { points: newPoints }, // Update with new points value
        });

        // Send a success response with the updated user
        return res.status(200).json({
            message: 'User points updated successfully',
            user: updatedUser,
        });
    } catch (error) {
        console.error('Error updating user points:', error);
        return res.status(500).json({
            message: 'Error updating user points',
            error: error.message,
        });
    }
};

// markoption
const markOption = async (req, res) => {
  const { userId } = req.params;
  const { optionId, questionId } = req.body;

  try {
    // Start a transaction
    const result = await prisma.$transaction(async (prisma) => {
      // Check if the user exists
      const userExists = await prisma.user.findUnique({
        where: { id: userId }
      });
      if (!userExists) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if the option exists
      const optionExists = await prisma.options.findUnique({
        where: { id: optionId }
      });
      if (!optionExists) {
        return res.status(404).json({ message: "Option not found" });
      }

      // Check if the user has already marked any option for this question
      const alreadyMarkedForQuestion = await prisma.userOptions.findUnique({
        where: {
          userId_questionId: {  // This assumes you have a composite unique constraint on (userId, questionId)
            userId,
            questionId
          }
        }
      });

      if (alreadyMarkedForQuestion) {
        return res.status(400).json({ message: "User has already marked an option for this question" });
      }

      // Create the record in the UserOptions table with the questionId
      const markedOption = await prisma.userOptions.create({
        data: {
          userId,
          optionId,
          questionId
        }
      });

      // Increment the markedCount for the option
      await prisma.options.update({
        where: { id: optionId },
        data: {
          markedCount: {
            increment: 1
          }
        }
      });

      return {
        message: "Option marked successfully",
        markedOption
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to mark option", error: error.message });
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
          questionId:question.id,  
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
  
  
  
export { UserRegister, UserLogin,updateUserPoints,getForms,markOption }
