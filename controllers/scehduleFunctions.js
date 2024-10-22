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

const functionMap = {
  sendReminderEmail: () => {
    console.log('Sending reminder email');
  },
  runFunction2: () => {
    console.log('Running function 2');
  }
};

const runTaskFunction = (functionName) => {
  const taskFunction = functionMap[functionName];
  if (taskFunction) {
    taskFunction();
  } else {
    console.error(`Function ${functionName} not found`);
  }
};

export const scheduleTask = (task) => {
  const { startTime, durationValue, durationUnit, adminId, functionToRun } = task;
  const taskTimeInMilliseconds = convertDurationToMilliseconds(durationValue, durationUnit);
  const taskExecutionTime = new Date(startTime).getTime() + taskTimeInMilliseconds;

  console.log(`Scheduled Execution Time: ${new Date(taskExecutionTime)}`);

  // Stop any previous cron job for this task
  if (tasks[adminId + functionToRun]) {
    tasks[adminId + functionToRun].stop();
  }

  const cronJob = cron.schedule('* * * * *', () => {
    const now = Date.now();
    console.log("Current Time:", new Date(now).toISOString());

    if (now >= taskExecutionTime) {
      console.log(`Running task: ${functionToRun}`);
      runTaskFunction(functionToRun);
      task.isCompleted = true;
      cronJob.stop();
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
    if (!taskData.durationValue || !taskData.durationUnit || !taskData.startTime || !taskData.functionToRun) {
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
          startTime: new Date(taskData.startTime),
          durationValue: taskData.durationValue,
          durationUnit: taskData.durationUnit,
          isCompleted: false,
        },
      });

      // Restart the cron job
      scheduleTask({
        ...existingTask,
        startTime: new Date(taskData.startTime),
        durationValue: taskData.durationValue,
        durationUnit: taskData.durationUnit,
      });
    } else {
      // Create a new task
      const newTask = await prisma.task.create({
        data: {
          adminId: adminId,
          functionToRun: taskData.functionToRun,
          startTime: new Date(taskData.startTime),
          durationValue: taskData.durationValue,
          durationUnit: taskData.durationUnit,
          isCompleted: false,
        },
      });

      // Schedule the new task
      scheduleTask(newTask);
    }

    res.status(201).json({ message: 'Task scheduled/updated successfully' });
  } catch (err) {
    console.error('Error in scheduling tasks:', err);
    res.status(500).json({ error: err.message });
  }
};
