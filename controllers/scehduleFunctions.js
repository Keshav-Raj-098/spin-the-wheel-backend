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

async function setAllCareerPointsToZero(adminId) {
  try {
    const forms = await prisma.form.findMany({
      where: { adminId },
      select: {
        userForms: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!forms || forms.length === 0) {
      throw new Error('No forms found. Please create a form first.');
    }

    const userIds = [...new Set(forms.flatMap((form) => form.userForms.map((uf) => uf.userId)))];

    if (userIds.length === 0) {
      throw new Error('No users found.');
    }

    const updatedUsers = await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { points: 0 },
    });

    console.log(`Updated ${updatedUsers.count} users' career points to zero.`);
  } catch (error) {
    console.error('Error updating career points:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const sessionWinner = async (adminId, functionName) => {
  try {
    const task = await prisma.task.findFirst({
      where: {
        adminId,
        functionToRun: functionName,
      },
      select: {
        id: true,
        createdAt: true,
        isCompleted: true,
      },
    });

    if (!task) throw new Error('Task not found');
    if (task.isCompleted) return { message: 'Task already completed.' };

    const userQuestions = await prisma.userForm.findMany({
      where: { createdAt: { gt: task.createdAt } },
      select: { userId: true },
      distinct: ['userId'],
    });

    const userIds = userQuestions.map((uq) => uq.userId);

    if (userIds.length === 0) {
      return { message: 'No users found after task\'s createdAt', users: [] };
    }

    const topUsers = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { name: true, points: true },
      orderBy: { points: 'desc' },
      take: 3,
    });

    await prisma.admin.update({
      where: { id: adminId },
      data: {
        lastSessionWinners: JSON.stringify(topUsers),
      },
    });

    await prisma.task.update({
      where: { id: task.id },
      data: { isCompleted: true },
    });

    return { message: 'Top 3 users saved and task marked as completed.' };
  } catch (error) {
    console.error('Error in sessionWinner:', error.message);
    throw error;
  }
};

const functionMap = {
  setAllCareerPointsToZero,
  sessionWinner,
};

const runTaskFunction = async (functionName, adminId) => {
  const taskFunction = functionMap[functionName];
  if (!taskFunction) {
    console.error(`Function ${functionName} not found`);
    return;
  }
  await taskFunction(adminId, functionName);
};

export const scheduleTask = (task) => {
  const { updatedAt, durationValue, durationUnit, adminId, functionToRun } = task;
  const taskTimeInMilliseconds = convertDurationToMilliseconds(durationValue, durationUnit);
  const taskExecutionTime = new Date(updatedAt).getTime() + taskTimeInMilliseconds;

  if (tasks[adminId + functionToRun]) tasks[adminId + functionToRun].stop();

  const cronJob = cron.schedule('* * * * *', async () => {
    try {
      const now = Date.now();
      if (now >= taskExecutionTime) {
        const existingTask = await prisma.task.findFirst({
          where: { adminId, functionToRun },
        });

        if (existingTask && !existingTask.isCompleted) {
          console.log(`Running task: ${functionToRun}`);
          await runTaskFunction(functionToRun, adminId);
          cronJob.stop();
        } else {
          console.log(`Task ${functionToRun} already completed or invalid.`);
          cronJob.stop();
        }
      }
    } catch (error) {
      console.error('Error in scheduled task:', error.message);
      cronJob.stop();
    }
  });

  tasks[adminId + functionToRun] = cronJob;
};

export const putTimer = async (req, res) => {
  const { adminId } = req.params;
  const taskData = req.body;

  try {
    if (!adminId) return res.status(400).json({ error: 'adminId is required' });

    if (!taskData.durationValue || !taskData.durationUnit || !taskData.functionToRun) {
      throw new Error('Task data is incomplete');
    }

    const existingTask = await prisma.task.findFirst({
      where: { adminId, functionToRun: taskData.functionToRun },
    });

    if (existingTask) {
      await prisma.task.update({
        where: { id: existingTask.id },
        data: {
          durationValue: taskData.durationValue,
          durationUnit: taskData.durationUnit,
          isCompleted: false,
        },
      });

      scheduleTask({
        ...existingTask,
        updatedAt: new Date(),
        durationValue: taskData.durationValue,
        durationUnit: taskData.durationUnit,
      });
    } else {
      const newTask = await prisma.task.create({
        data: {
          adminId,
          functionToRun: taskData.functionToRun,
          durationValue: taskData.durationValue,
          durationUnit: taskData.durationUnit,
          isCompleted: false,
        },
      });

      scheduleTask(newTask);
    }

    res.status(200).json({ message: 'Task scheduled/updated successfully' });
  } catch (err) {
    console.error('Error in scheduling tasks:', err.message);
    res.status(500).json({ error: err.message });
  }
};
