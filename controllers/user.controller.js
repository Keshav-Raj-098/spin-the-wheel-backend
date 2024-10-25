import { prisma } from "../prisma/prisma.js";


const UserAuth = async (req, res) => {
  const { name, email, gender, age } = req.body;

  console.log(req.body);



  try {
    // Check if the user exists by email
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    // If user exists, attempt login
    if (existingUser) {
      // Check if the name matches the existing user
      if (existingUser.name !== name) {
        return res.status(404).json({ message: "User found, but name does not match" });
      }

      // Successful login
      return res.status(200).json({
        user: existingUser,
        message: "Login successful",
      });
    }

    // If user does not exist, register the user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        gender: gender || null, // Use null if gender is not provided
        age: age || null,       // Use null if age is not provided
      },
    });

    // If user creation fails
    if (!newUser) {
      return res.status(400).json({ message: "Server busy, can't register you" });
    }

    // Successful registration
    return res.status(201).json({
      user: newUser,
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
    const newPoints = Math.max((user.points || 0) + points, 0);  // Ensure points do not go below 0
    const newSpinLeft = Math.max((user.spinLeft || 0) + spinUpdate, 0);  // Ensure spinLeft does not go below 0

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

const getLeaderBoard = async (req, res) => {
  const { adminId, userId } = req.params;

  try {
    // Step 1: Fetch the task based on adminId and functionToRun
    const task = await prisma.task.findFirst({
      where: {
        adminId: adminId,
        functionToRun: "sessionWinner",
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

    const { updatedAt } = task;  // Use updatedAt instead of startTime

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

    // Step 3: Fetch the top 3 session users based on the found userIds, and retrieve only their name and points
    const sessionUsers = await prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        name: true,
        points: true,
      },
      orderBy: {
        points: 'desc', // Order by points descending
      },
      take: 3, // Limit to top 3 session users
    });

    // Step 4: Fetch all users and order by points to calculate the rank of the provided userId
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        points: true,
        spinLeft: true
      },
      orderBy: {
        points: "desc"
      },
    });

    // Step 5: Find the rank (index) of the provided userId in the sorted all-time leaderboard
    const userIndex = allUsers.findIndex(user => user.id === userId);

    if (userIndex === -1) {
      return res.status(404).json({ message: "User not found in the leaderboard" });
    }
    const thisUser = allUsers[userIndex]

    // Step 6: Return the leaderboard and the user's rank
    res.status(200).json({
      leaderBoard: sessionUsers,  // Top 3 session users
      user: {
        rank: userIndex + 1,
        points: thisUser.points,
        spinLeft: thisUser.spinLeft

      }        // Return 1-based index for the user's rank
    });
  } catch (error) {
    console.error('Error retrieving leaderboard:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// markoption
const markOption = async (req, res) => {
  const { userId } = req.params
  const { formId, questionId, optionIds, text, isSurvey } = req.body;

  // optionId is an array of optionId
  console.log({ userId, formId, questionId, text });
  console.log({ ...optionIds });

  if ((!formId || !questionId || !optionIds) || (optionIds.length === 0)) {
    console.log("Every Field required");
    return res.status(400).json({ message: 'All fields required'});
  }

  
  if (typeof isSurvey !== 'boolean') {
    console.log(isSurvey);
    return res.status(406).json({ message: 'Type of Form Required' });
}


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
      console.log({ message: 'Question already marked by user.', })
      return res.status(202).json({ message: 'Question already marked by user.',});
    }

    // 2. Mark the question and update the markedCount of the option 
    const userQuestionCreate = await prisma.userQuestion.create({
      data: {
        userId,
        questionId,
        ...(text && { userResponse: text })
      }
    });

    if (!userQuestionCreate) {

      console.log("Error While creating userQuestion");
      return res.status(401).json({ message: "Error While creating userQuestion" })
    }


    const optionIncrement = await prisma.options.updateMany({
      where: {
        id: {
          in: optionIds, // Use the `in` operator to match any option IDs in the array
        },
      },
      data: {
        markedCount: {
          increment: 1, // Increment the `markedCount` by 1 for each matching option
        },
      },
    });


    if (!optionIncrement) {
      console.log("Error while mark Count");
      return res.status(404).json({ message: "Can't mark this Question Now", flag: false })

    }


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


      const userUpdate = await prisma.user.update({
        where: { id: userId },
        data: { formDone: updatedFormDone, spinLeft: { increment: 10 } }
      });

      if (!userUpdate) {
        console.log("Error while updating User spinLeft");
        return res.status(404).json({ message: "Can't mark this Question Now", flag: false })
      }

    }

    if (isSurvey) {
      console.log({ message: 'Option marked and updated successfully' });
      return res.status(200).json({ message: 'Option marked and updated successfully', marked: true });
    }


    const correctOption = await prisma.options.findMany({
      where: { isCorrect: true, questionId: questionId },
      select: { id: true }
    });

   

 
    console.log("Fetched Options From DB ",correctOption);



    if (!correctOption || correctOption.length === 0) {
      console.log("There are no correct answers for this question.");

      return res.status(202).json({ message: "No correct answers available for this question.", flag: true });
    }
    const correctOptionIds = correctOption.map(e => e.id); 


    // Separate the user-selected options into correct and incorrect arrays
    const correctSelected = optionIds.filter(id => correctOptionIds.includes(id)); // User's correct options
    const incorrectSelected = optionIds.filter(id => !correctOptionIds.includes(id)); // User's incorrect options

    // Determine if all answers matched (i.e., no incorrect options)
    const allAnswersMatched = incorrectSelected.length === 0 && correctSelected.length === correctOption.length;

    if (!allAnswersMatched) {
      console.log("Answer not matched");
      return res.status(200).json({
        message: 'Not all answers matched',
        correct:correctSelected,
        answers:correctOptionIds,
        incorrect:incorrectSelected,
        allAnswersMatched: false, // Not all answers matched
      });
    }

    // If all answers are correct
    console.log("All answers matched");

    return res.status(200).json({
      message: 'All answers matched',
      correct:correctSelected,
      answers:correctOptionIds,
      incorrect:incorrectSelected,
      allAnswersMatched: true, // All answers matched
    });

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
            options: true, // Fetch options for each question
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

    // Format the form and filter for unmarked questions
    const formattedForm = {
      name: form.name,
      isSurvey:form.isSurvey,
      questions: form.questions
        .map(question => ({
          question: question.question,
          questionId: question.id,
          isMultipleCorrect: question.multiple,
          textAllowed:question.textAllowed,
          options: question.options.map(option => ({
            id: option.id, // Include option ID
            option: option.option, // Extracting option text
          })),
          isMarked: markedQuestionIds.has(question.id), // Add boolean field to check if the question is marked
        }))
        .filter(question => !question.isMarked), // Only keep questions that are not marked
    };

    res.status(200).json(formattedForm);
  } catch (error) {
    console.error('Error fetching form:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getUncompletedForm = async (req, res) => {
  const { adminId, userId } = req.params;

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

    if (!forms.length) {
      return res.status(404).json({ message: 'No forms found for the given admin.' });
    }

    // Extract form IDs created by the admin
    const formIds = forms.map((form) => form.id);

    // Fetch the user's formDone array (completed form IDs)
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        formDone: true, // Select only formDone
      },
    });

    // Default to an empty array if formDone is undefined/null
    const completedForms = user?.formDone || [];

    // Filter out the forms that the user has already completed
    const uncompletedFormIds = formIds.filter((formId) => !completedForms.includes(formId));

    // Return the array of uncompleted form IDs
    res.status(200).json(uncompletedFormIds);
  } catch (error) {
    console.error('Error fetching uncompleted form IDs:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const createFeedback = async (req, res) => {
  const { adminId, userId } = req.params;
  const { stars, suggestion, abtTheGame, notLiked } = req.body;

  console.log({ stars, suggestion, abtTheGame, notLiked });


  try {
    // Check if the user has already provided feedback for this admin
    const existingFeedback = await prisma.feedback.findFirst({
      where: {
        userId: userId,
        adminId: adminId,  // Ensure uniqueness of feedback per user-admin pair
      },
    });

    if (existingFeedback) {
      console.error('nahi aaya response');
      return res.status(210).json({
        message: 'Feedback already exists for this user',
      });
    }

    // Validate required fields
    if (!stars || !suggestion || !abtTheGame || !notLiked) {
      console.error('No response');
      return res.status(400).json({
        message: 'All fields are required.',
      });
    }

    // Create new feedback
    const feedback = await prisma.feedback.create({
      data: {
        userId,
        adminId,
        feedback: {
          stars,
          suggestion,
          abtTheGame,
          notLiked,
        },
      },
    });

    // Success response
    return res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully.',
      feedback,
    });

  } catch (error) {
    console.error('Error creating feedback:', error);
    return res.status(500).json({
      error: true,
      message: 'An error occurred while submitting feedback.',
    });
  }
};





export { UserAuth, updateUserPoints, getLeaderBoard, getFormById, getUncompletedForm, markOption, createFeedback }
