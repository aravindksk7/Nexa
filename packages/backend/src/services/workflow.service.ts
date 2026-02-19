import { prisma } from '../lib/prisma.js';

type WorkflowStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
type StepStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';

interface WorkflowDefinitionStep {
  name: string;
  type: 'APPROVAL' | 'NOTIFICATION' | 'ACTION';
  assigneeId?: string;
  config?: Record<string, unknown>;
}

interface WorkflowDefinition {
  steps: WorkflowDefinitionStep[];
}

interface CreateWorkflowInput {
  name: string;
  description?: string;
  definition: WorkflowDefinition;
}

interface TriggerWorkflowInput {
  workflowId: string;
  context: Record<string, unknown>;
}

export class WorkflowService {
  async createWorkflow(input: CreateWorkflowInput) {
    return prisma.workflow.create({
      data: {
        name: input.name,
        description: input.description,
        definition: input.definition as object,
      },
    });
  }

  async listWorkflows(options?: { limit?: number; offset?: number }) {
    const { limit = 50, offset = 0 } = options ?? {};
    const [workflows, total] = await Promise.all([
      prisma.workflow.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { _count: { select: { instances: true } } },
      }),
      prisma.workflow.count({ where: { isActive: true } }),
    ]);
    return { workflows, total };
  }

  async getWorkflow(id: string) {
    return prisma.workflow.findUnique({
      where: { id },
      include: {
        instances: {
          orderBy: { startedAt: 'desc' },
          take: 10,
          include: { steps: true },
        },
      },
    });
  }

  async triggerWorkflow(input: TriggerWorkflowInput) {
    const workflow = await prisma.workflow.findUnique({ where: { id: input.workflowId } });
    if (!workflow) throw new Error('Workflow not found');

    const definition = workflow.definition as unknown as WorkflowDefinition;

    const instance = await prisma.workflowInstance.create({
      data: {
        workflowId: workflow.id,
        status: 'IN_PROGRESS',
        currentStep: 0,
        context: input.context as object,
        steps: {
          create: definition.steps.map((step, index) => ({
            stepNumber: index,
            stepName: step.name,
            status: 'PENDING',
          })),
        },
      },
      include: { steps: true },
    });

    return instance;
  }

  async getWorkflowInstance(instanceId: string) {
    return prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: { workflow: true, steps: { orderBy: { stepNumber: 'asc' } } },
    });
  }

  async listWorkflowInstances(options?: { status?: WorkflowStatus; limit?: number; offset?: number }) {
    const { status, limit = 50, offset = 0 } = options ?? {};
    const [instances, total] = await Promise.all([
      prisma.workflowInstance.findMany({
        where: status ? { status } : {},
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
        include: { workflow: { select: { name: true } }, steps: true },
      }),
      prisma.workflowInstance.count({ where: status ? { status } : {} }),
    ]);
    return { instances, total };
  }

  async approveStep(instanceId: string, stepId: string, approverId: string, comment?: string) {
    return this._advanceStep(instanceId, stepId, approverId, 'APPROVED', comment);
  }

  async rejectStep(instanceId: string, stepId: string, approverId: string, comment?: string) {
    const step = await prisma.workflowStep.update({
      where: { id: stepId, instanceId },
      data: { status: 'REJECTED', approverId, comment, executedAt: new Date() },
    });
    await prisma.workflowInstance.update({
      where: { id: instanceId },
      data: { status: 'FAILED' },
    });
    return step;
  }

  private async _advanceStep(
    instanceId: string,
    stepId: string,
    approverId: string,
    stepStatus: StepStatus,
    comment?: string,
  ) {
    const instance = await prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: { steps: { orderBy: { stepNumber: 'asc' } }, workflow: true },
    });
    if (!instance) throw new Error('Workflow instance not found');

    const updatedStep = await prisma.workflowStep.update({
      where: { id: stepId, instanceId },
      data: { status: stepStatus, approverId, comment, executedAt: new Date() },
    });

    const nextStep = instance.steps.find(
      (s: { stepNumber: number; status: string }) =>
        s.stepNumber === updatedStep.stepNumber + 1 && s.status === 'PENDING',
    );

    if (nextStep) {
      await prisma.workflowInstance.update({
        where: { id: instanceId },
        data: { currentStep: (nextStep as { stepNumber: number }).stepNumber },
      });
    } else {
      const allDone = instance.steps.every(
        (s: { id: string; status: string }) =>
          s.id === updatedStep.id || s.status !== 'PENDING',
      );
      if (allDone) {
        await prisma.workflowInstance.update({
          where: { id: instanceId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      }
    }

    return prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });
  }

  async cancelWorkflowInstance(instanceId: string) {
    return prisma.workflowInstance.update({
      where: { id: instanceId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
  }
}

export const workflowService = new WorkflowService();
