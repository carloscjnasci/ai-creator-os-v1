import { createId } from '../id';
import type { ExecutionPlanStep } from '../types';
import type {
  CreateExecutionRunContext,
  ExecutionPlanLike,
  ExecutionProvider,
  ExecutionRun,
  ExecutionTask,
  ExecutionTaskAction,
  ExecutionTaskPatch,
  ExecutionTaskStatus,
  ExecutionTransitionResult,
} from './types';

const TERMINAL_TASK_STATUSES: ReadonlySet<ExecutionTaskStatus> = new Set([
  'completed',
  'skipped',
]);

function providerForStep(step: ExecutionPlanStep): ExecutionProvider {
  if (step.domain === 'image') return 'imagen';
  if (step.domain === 'video') return 'veo';
  if (step.domain === 'publishing') return 'publishing';
  if (step.domain === 'analytics') return 'analytics';
  if (step.domain === 'prompt') return 'cos';
  return 'manual';
}

function calculateProgress(tasks: ExecutionTask[]): number {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter((task) => TERMINAL_TASK_STATUSES.has(task.status)).length;
  return Math.round((completed / tasks.length) * 100);
}

function deriveRunStatus(run: ExecutionRun): ExecutionRun['status'] {
  if (run.status === 'cancelled') return 'cancelled';
  if (run.tasks.length > 0 && run.tasks.every((task) => TERMINAL_TASK_STATUSES.has(task.status))) {
    return 'completed';
  }

  const hasActivity = run.tasks.some((task) =>
    ['in-progress', 'review', 'completed', 'failed', 'skipped'].includes(task.status),
  );
  const hasActionableTask = run.tasks.some((task) =>
    ['ready', 'in-progress', 'review', 'failed'].includes(task.status),
  );

  if (!hasActionableTask && run.tasks.some((task) => task.status === 'blocked')) {
    return 'blocked';
  }

  return hasActivity ? 'active' : 'draft';
}

function dependenciesComplete(task: ExecutionTask, tasks: ExecutionTask[]): boolean {
  return task.dependsOnTaskIds.every((dependencyId) => {
    const dependency = tasks.find((candidate) => candidate.id === dependencyId);
    return Boolean(dependency && TERMINAL_TASK_STATUSES.has(dependency.status));
  });
}

function reconcileTasks(tasks: ExecutionTask[], now: string): ExecutionTask[] {
  return tasks.map((task) => {
    if (TERMINAL_TASK_STATUSES.has(task.status) || ['in-progress', 'review', 'failed'].includes(task.status)) {
      return task;
    }

    if (task.requirementBlocked) {
      return task.status === 'blocked'
        ? task
        : { ...task, status: 'blocked', updatedAt: now };
    }

    const ready = dependenciesComplete(task, tasks);
    if (ready && task.status === 'blocked') {
      return { ...task, status: 'ready', blockedReason: undefined, updatedAt: now };
    }
    if (!ready && task.status === 'ready') {
      return {
        ...task,
        status: 'blocked',
        blockedReason: 'Waiting for the previous production stage.',
        updatedAt: now,
      };
    }
    return task;
  });
}

function finalizeRun(run: ExecutionRun, now: string): ExecutionRun {
  const tasks = reconcileTasks(run.tasks, now);
  const withProgress: ExecutionRun = {
    ...run,
    tasks,
    progress: calculateProgress(tasks),
    updatedAt: now,
  };
  return { ...withProgress, status: deriveRunStatus(withProgress) };
}

export function createExecutionRun(
  plan: ExecutionPlanLike,
  context: CreateExecutionRunContext = {},
): ExecutionRun {
  const now = context.now ?? new Date().toISOString();
  let previousTaskId: string | undefined;

  const tasks = plan.executionPlan
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((step): ExecutionTask => {
      const id = createId('task');
      const requirementBlocked = step.status === 'blocked';
      const dependsOnTaskIds = previousTaskId ? [previousTaskId] : [];
      const status: ExecutionTaskStatus = requirementBlocked
        ? 'blocked'
        : dependsOnTaskIds.length === 0
          ? 'ready'
          : 'blocked';
      const task: ExecutionTask = {
        id,
        stepId: step.id,
        order: step.order,
        label: step.label,
        domain: step.domain,
        provider: providerForStep(step),
        status,
        instruction: step.description,
        dependsOnTaskIds,
        requirementBlocked,
        blockedReason: requirementBlocked
          ? step.description
          : dependsOnTaskIds.length > 0
            ? 'Waiting for the previous production stage.'
            : undefined,
        updatedAt: now,
      };
      previousTaskId = id;
      return task;
    });

  return finalizeRun(
    {
      id: createId('run'),
      planId: plan.id,
      campaignId: context.campaignId,
      workflowId: context.workflowId,
      name: plan.campaignName,
      status: 'draft',
      progress: 0,
      tasks,
      createdAt: now,
      updatedAt: now,
    },
    now,
  );
}

function nextStatusForAction(
  currentStatus: ExecutionTaskStatus,
  action: ExecutionTaskAction,
): ExecutionTaskStatus | null {
  const transitions: Record<ExecutionTaskStatus, Partial<Record<ExecutionTaskAction, ExecutionTaskStatus>>> = {
    blocked: { unblock: 'ready' },
    ready: { start: 'in-progress', complete: 'completed', skip: 'skipped' },
    'in-progress': {
      'send-to-review': 'review',
      complete: 'completed',
      fail: 'failed',
      skip: 'skipped',
    },
    review: { complete: 'completed', fail: 'failed', reopen: 'in-progress', skip: 'skipped' },
    completed: { reopen: 'ready' },
    failed: { retry: 'ready', skip: 'skipped' },
    skipped: { reopen: 'ready' },
  };
  return transitions[currentStatus][action] ?? null;
}

export function transitionExecutionTask(
  run: ExecutionRun,
  taskId: string,
  action: ExecutionTaskAction,
  patch: ExecutionTaskPatch = {},
  now = new Date().toISOString(),
): ExecutionTransitionResult {
  const taskIndex = run.tasks.findIndex((task) => task.id === taskId);
  if (taskIndex < 0) return { run, changed: false, error: 'Execution task was not found.' };

  const currentTask = run.tasks[taskIndex];
  if (action === 'unblock' && !currentTask.requirementBlocked) {
    return { run, changed: false, error: 'Only requirement-blocked tasks can be manually unblocked.' };
  }

  const nextStatus = nextStatusForAction(currentTask.status, action);
  if (!nextStatus) {
    return {
      run,
      changed: false,
      error: `Action ${action} is not allowed while the task is ${currentTask.status}.`,
    };
  }

  if (nextStatus === 'ready' && action !== 'unblock' && !dependenciesComplete(currentTask, run.tasks)) {
    return { run, changed: false, error: 'Complete or skip the dependent tasks first.' };
  }

  const nextTask: ExecutionTask = {
    ...currentTask,
    ...patch,
    status: nextStatus,
    requirementBlocked: action === 'unblock' ? false : currentTask.requirementBlocked,
    blockedReason: action === 'unblock' ? undefined : currentTask.blockedReason,
    startedAt:
      nextStatus === 'in-progress'
        ? currentTask.startedAt ?? now
        : action === 'reopen'
          ? now
          : currentTask.startedAt,
    completedAt: nextStatus === 'completed' || nextStatus === 'skipped' ? now : undefined,
    updatedAt: now,
  };

  const tasks = run.tasks.slice();
  tasks[taskIndex] = nextTask;
  return { run: finalizeRun({ ...run, tasks }, now), changed: true };
}

export function updateExecutionTaskOutput(
  run: ExecutionRun,
  taskId: string,
  patch: ExecutionTaskPatch,
  now = new Date().toISOString(),
): ExecutionTransitionResult {
  const taskIndex = run.tasks.findIndex((task) => task.id === taskId);
  if (taskIndex < 0) return { run, changed: false, error: 'Execution task was not found.' };
  const tasks = run.tasks.slice();
  tasks[taskIndex] = { ...tasks[taskIndex], ...patch, updatedAt: now };
  return { run: finalizeRun({ ...run, tasks }, now), changed: true };
}

export function getExecutionTaskActions(task: ExecutionTask): ExecutionTaskAction[] {
  const actions: Record<ExecutionTaskStatus, ExecutionTaskAction[]> = {
    blocked: task.requirementBlocked ? ['unblock'] : [],
    ready: ['start', 'complete', 'skip'],
    'in-progress': ['send-to-review', 'complete', 'fail', 'skip'],
    review: ['complete', 'fail', 'reopen', 'skip'],
    completed: ['reopen'],
    failed: ['retry', 'skip'],
    skipped: ['reopen'],
  };
  return actions[task.status];
}
