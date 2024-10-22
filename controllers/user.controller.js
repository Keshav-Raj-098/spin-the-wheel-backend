import { prisma } from "../prisma/prisma.js";


const UserAuth = async (req, res) => {
  const { name, email, gender, age } = req.body;
  const { adminId } = req.params; // Get adminId from params

  try {
    // Check if the user exists by email
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    // Function to get uncompleted forms
    const getUncompletedForms = async (userFormDone) => {
      // Fetch all forms created by the admin
      const adminForms = await prisma.form.findMany({
        where: { adminId },
        select: { id: true },
      });

      // Extract form IDs from admin's forms
      const adminFormIds = adminForms.map(form => form.id);

      // Filter out forms that the user has already completed
      const uncompletedFormIds = adminFormIds.filter(id => !userFormDone.includes(id));

      return uncompletedFormIds;
    };

    // If user exists, attempt login
    if (existingUser) {
      // Check if the name matches the existing user
      if (existingUser.name !== name) {
        return res.status(404).json({ message: "User found, but name does not match" });
      }

      // Get uncompleted form IDs
      const uncompletedFormIds = await getUncompletedForms(existingUser.formDone);

      // Destructure user data to exclude formDone
      const { formDone, ...userDetails } = existingUser;

      // Successful login
      return res.status(200).json({
        user: userDetails,
        uncompletedForms: uncompletedFormIds,
        message: "Login successful",
      });
    }

    // If user does not exist, register the user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        gender,
        age,
      },
    });

    // If user creation fails
    if (!newUser) {
      return res.status(400).json({ message: "Server busy, can't register you" });
    }

    // Get uncompleted form IDs for the new user (they haven't completed any forms)
    const uncompletedFormIds = await getUncompletedForms([]);

    // Destructure user data to exclude formDone
    const { formDone: _, ...newUserDetails } = newUser;

    // Successful registration
    return res.status(201).json({
      user: newUserDetails,
      uncompletedForms: uncompletedFormIds,
      message: "Registered successfully",
    });
    
  } catch (error) {
    console.error('Error during user authentication:', error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


// Update Points
const updateUserPoints = async (req, res) => {
  const { id } = req.params; // Get user ID from the request parameters
  const { points, spinUpdate } = req.body; // Get new points and spinUpdate value from the request body

  // Validate if points and spinUpdate are numbers
  if (typeof points !== 'number' || typeof spinUpdate !== 'number') {
    return res.status(400).json({
      message: 'Invalid input. Points and spinUpdate should be numbers.',
    });
  }

  try {
    // Fetch the current user data (select points and spinLeft)
    const user = await prisma.user.findUnique({
      where: { id },
      select: { points: true, spinLeft: true },
    });

    // Check if user exists
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      });
    }

    // Calculate the new points and spins
    const newPoints = (user.points || 0) + points; // Add points to existing points
    const newSpinLeft = (user.spinLeft || 0) - spinUpdate; // Subtract spinUpdate from existing spinLeft

    // Ensure spins do not go below 0
    if (newSpinLeft < 0) {
      return res.status(400).json({
        message: 'Insufficient spins left.',
      });
    }

    // Update the user points and spinLeft in the database
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        points: newPoints,
        spinLeft: newSpinLeft,
      },
    });

    // Respond with success message and updated points and spinLeft
    return res.status(200).json({
      message: 'User points and spins updated successfully',
      user: {
        CareerPoints: updatedUser.points,
        spinLeft: updatedUser.spinLeft,
      },
    });
  } catch (error) {
    console.error('Error updating user points and spins:', error);
    return res.status(500).json({
      message: 'Error updating user points and spins',
      error: error.message,
    });
  }
};


// markoption
const markOption = async (req, res) => {
  const { userId, formId, questionId, optionId } = req.body;

  try {
    // 1. Check if the user has already marked the question
    const existingMark = await prisma.userQuestion.findUnique({
      where: {
        userId_questionId: {
          userId,
          questionId
        }
      }
    });

    if (existingMark) {
      return res.status(400).json({ message: 'Question already marked by user.' });
    }

    // 2. Mark the question and update the markedCount of the option
    await prisma.userQuestion.create({
      data: {
        userId,
        questionId,
      }
    });

    await prisma.options.update({
      where: { id: optionId },
      data: {
        markedCount: { increment: 1 }
      }
    });

    // 3. Check if all questions in the form are marked by the user
    const totalQuestions = await prisma.question.count({
      where: { formId }
    });

    const markedQuestionsByUser = await prisma.userQuestion.count({
      where: { userId, Question: { formId } } // Use 'Question' instead of 'question'
    });

    if (markedQuestionsByUser === totalQuestions) {
      // Retrieve the user and update formDone when all questions are marked
      const user = await prisma.user.findUnique({ where: { id: userId } });

      const updatedFormDone = [...user.formDone, formId]; // Add formId to formDone
      await prisma.user.update({
        where: { id: userId },
        data: { formDone: updatedFormDone }
      });
    }

    res.status(200).json({ message: 'Option marked and updated successfully' });
  } catch (error) {
    console.error('Error marking option:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


const getFormById = async (req, res) => {
  const { formId, userId } = req.params; // Assuming you have the form ID from the request parameters

  try {
    const form = await prisma.form.findUnique({
      where: {
        id: formId,
      },
      include: {
        questions: {
          include: {
            options: {}, // Removed ordering for options
          },
        },
      },
    });

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    // Fetch marked questions by the user
    const markedQuestions = await prisma.userQuestion.findMany({
      where: {
        userId,
        questionId: {
          in: form.questions.map(question => question.id),
        },
      },
      select: {
        questionId: true,
      },
    });

    // Create a Set of marked question IDs for quick lookup
    const markedQuestionIds = new Set(markedQuestions.map(q => q.questionId));

    // Format the form without `createdAt` and `updatedAt`
    const formattedForm = {
      questions: form.questions.map(question => ({
        question: question.question,
        questionId: question.id,
        options: question.options.map(option => ({
          id: option.id, // Include option ID
          option: option.option, // Extracting option text
        })),
        isMarked: markedQuestionIds.has(question.id), // Add boolean field to check if the question is marked
      })),
    };

    res.status(200).json(formattedForm);
  } catch (error) {
    console.error('Error fetching form:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


const getUncompletedForm = async (req, res) => {
  const { adminId, userId } = req.params; // Assuming you have the admin ID and user ID from the request parameters

  try {
    // Fetch the forms created by the admin
    const forms = await prisma.form.findMany({
      where: {
        adminId: adminId,
      },
      select: {
        id: true, // Select only the form ID
      },
    });

    // Extract form IDs created by the admin
    const formIds = forms.map((form) => form.id);

    // Fetch the user's formDone array (completed form IDs)
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        formDone: true,
      },
    });

    // Filter out the forms that the user has already completed
    const uncompletedFormIds = formIds.filter((formId) => !user.formDone.includes(formId));

    // Return the array of form IDs not present in user.formDone
    res.status(200).json(uncompletedFormIds);
  } catch (error) {
    console.error('Error fetching form IDs:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};




export { UserAuth, updateUserPoints, getFormById,getUncompletedForm, markOption }
