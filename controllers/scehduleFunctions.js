import cron from 'node-cron';
import { addMinutes, isAfter } from 'date-fns';


export const tasks = [];

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

// Function map for easier function execution
const functionMap = {
  runFunction1: () => {
    console.log('Running function 1');
  },
  runFunction2: () => {
    console.log('Running function 2');
    // Your logic for function 2
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
    const { startTime, durationValue, durationUnit } = task;
    const taskTimeInMilliseconds = convertDurationToMilliseconds(durationValue, durationUnit);
    const taskExecutionTime = new Date(startTime).getTime() + taskTimeInMilliseconds;
  
    console.log(taskExecutionTime);
    
    console.log(`Scheduled Execution Time: ${new Date(taskExecutionTime)}`);
    
    const cronJob = cron.schedule('* * * * *', () => {
      const now = Date.now();
      console.log("Current Time:", new Date(now).toISOString());
  
      // Check if task's execution time has passed
      if (taskExecutionTime < now) {
        console.log(`Task's execution time has passed: ${task.functionToRun}`);
        task.isCompleted = true;
        cronJob.stop();
        return;
      }
  
      // Check if it is time to run the task
      if (now >= taskExecutionTime && !task.isCompleted) {
        console.log(`Running task: ${task.functionToRun}`);
        runTaskFunction(task.functionToRun);
        task.isCompleted = true;
        cronJob.stop();
      } else if (task.isCompleted) {
        console.log(`Task already completed: ${task.functionToRun}`);
        cronJob.stop();
      } else {
        console.log("Task not yet ready");
      }
    });
  };
  