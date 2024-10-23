import cron from 'node-cron';
import { prisma } from "../prisma/prisma.js"; // Assuming you're using Prisma ORM

export const tasks = {}; // Using an object to store active cron jobs

const convertDurationToMilliseconds = (value, unit) => {
  switch (unit) {
    case 'minutes':
      return value * 60 * 1000;
    case 'hours':
      return value * 60 * 60 * 1000;
    case 'days':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error('Unsupported time unit');
  }
};

async function setAllCareerPointsToZero() {
  try {
    // Update all users' points to zero
    const updatedUsers = await prisma.user.updateMany({
      data: { points: 0 },
    });

    console.log(`Updated ${updatedUsers.count} users' career points to zero.`);
  } catch (error) {
    console.error('Error updating career points for all users:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// New function to update task's updatedAt
const sessionWinner = async (adminId, functionName) => {
  try {
    // Step 1: Find the task using adminId and functionToRun
    const task = await prisma.task.findFirst({
      where: {
        adminId: adminId,
        functionToRun: functionName,
      },
      select: {
        id: true,
        createdAt: true,  // Use createdAt for comparison
        isCompleted: true, // Check if the task is already completed
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    if (task.isCompleted) {
      console.log('Task already completed, skipping execution.');
      return {
        message: 'Task has already been completed.',
      };
    }

    const { createdAt, id: taskId } = task;

    // Step 2: Find unique userIds from UserQuestion where createdAt is after the task's createdAt
    const userQuestions = await prisma.userQuestion.findMany({
      where: {
        createdAt: {
          gt: createdAt,  // created after the task's createdAt
        },
      },
      select: {
        userId: true,
      },
      distinct: ['userId'], // Ensure we get unique userIds
    });

    const userIds = userQuestions.map((uq) => uq.userId);

    if (userIds.length === 0) {
      return {
        message: 'No users found after the task\'s createdAt',
        users: [],
      };
    }

    // Step 3: Fetch the top 3 users based on the found userIds, sorted by points in descending order
    const topUsers = await prisma.user.findMany({
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
      take: 3, // Limit to 3 users
    });

    // Step 4: Store the topUsers in the admin's LastSessionWinner field
    await prisma.admin.update({
      where: { id: adminId },
      data: {
        lastSessionWinners: topUsers, // Save the array in LastSessionWinner field as JSON
      },
    });

    // Step 5: Mark the task as completed
    await prisma.task.update({
      where: { id: taskId },
      data: {
        isCompleted: true, // Mark the task as completed
      },
    });

    return {
      message: 'Top 3 users saved and task marked as completed.',
    };

  } catch (error) {
    console.error('Error fetching, storing top users, or updating task:', error);
    throw new Error('An error occurred: ' + error.message);
  }
};


// Updated function map
const functionMap = {
  setAllCareerPointsToZero: setAllCareerPointsToZero, // Ensure the function is correctly referenced
  sessionWinner: sessionWinner, // Reference the new function
};

const runTaskFunction = async (functionName, adminId) => {
  const taskFunction = functionMap[functionName];
  if (taskFunction) {
    await taskFunction(adminId, functionName); // Pass adminId and functionName to the function
  } else {
    console.error(`Function ${functionName} not found`);
  }
};

export const scheduleTask = (task) => {
  const { updatedAt, durationValue, durationUnit, adminId, functionToRun } = task;
  const taskTimeInMilliseconds = convertDurationToMilliseconds(durationValue, durationUnit);
  const taskExecutionTime = new Date(updatedAt).getTime() + taskTimeInMilliseconds;

  console.log(`Scheduled Execution Time: ${new Date(taskExecutionTime)}`);

  // Stop any previous cron job for this task
  if (tasks[adminId + functionToRun]) {
    tasks[adminId + functionToRun].stop();
  }

  const cronJob = cron.schedule('* * * * *', async () => {
    const now = Date.now();
    console.log("Current Time:", new Date(now).toISOString());

    if (now >= taskExecutionTime) {
      // Fetch the task again to ensure it's not completed
      const existingTask = await prisma.task.findFirst({
        where: {
          adminId: adminId,
          functionToRun: functionToRun,
        },
      });

      if (existingTask && !existingTask.isCompleted) {
        console.log(`Running task: ${functionToRun}`);
        await runTaskFunction(functionToRun, adminId); // Pass adminId to the function

        // Stop the cron job once the task has been completed
        cronJob.stop();
      } else {
        console.log(`Task ${functionToRun} is already completed or no longer valid.`);
        cronJob.stop();  // Stop the job if the task is already completed
      }
    }
  });

  tasks[adminId + functionToRun] = cronJob; // Store the active cron job
};

export const putTimer = async (req, res) => {
  const { adminId } = req.params;
  const taskData = req.body; // Expecting a single task object

  console.log(req.body);

  try {
    if (!adminId) {
      return res.status(400).json({ error: 'adminId is required' });
    }

    // Validate the task data
    if (!taskData.durationValue || !taskData.durationUnit || !taskData.functionToRun) {
      throw new Error('Task data is incomplete');
    }

    const existingTask = await prisma.task.findFirst({
      where: {
        adminId: adminId,
        functionToRun: taskData.functionToRun,
      },
    });

    if (existingTask) {
      // Update the existing task
      await prisma.task.update({
        where: { id: existingTask.id },
        data: {
          durationValue: taskData.durationValue,
          durationUnit: taskData.durationUnit,
          isCompleted: false,
        },
      });

      // Restart the cron job
      scheduleTask({
        ...existingTask,
        updatedAt: new Date(),  // Update with the current time
        durationValue: taskData.durationValue,
        durationUnit: taskData.durationUnit,
      });
    } else {
      // Create a new task
      const newTask = await prisma.task.create({
        data: {
          adminId: adminId,
          functionToRun: taskData.functionToRun,
          durationValue: taskData.durationValue,
          durationUnit: taskData.durationUnit,
          isCompleted: false,
        },
      });

      // Schedule the new task
      scheduleTask(newTask);
    }

    res.status(200).json({ message: 'Task scheduled/updated successfully' });
  } catch (err) {
    console.error('Error in scheduling tasks:', err);
    res.status(500).json({ error: err.message });
  }
};
