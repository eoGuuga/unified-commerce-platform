export enum PlanType {
  FREE = 'free',
  STARTER = 'starter',
  GROW = 'grow',
  SCALE = 'scale',
}

export const PLAN_LIMITS = {
  [PlanType.FREE]: {
    products: 50,
    users: 1,
    orders: 100,
    whatsappTemplates: 5,
    reports: false,
    prioritySupport: false,
  },
  [PlanType.STARTER]: {
    products: 200,
    users: 3,
    orders: 500,
    whatsappTemplates: 20,
    reports: true,
    prioritySupport: false,
  },
  [PlanType.GROW]: {
    products: 1000,
    users: 10,
    orders: 2000,
    whatsappTemplates: 100,
    reports: true,
    prioritySupport: true,
  },
  [PlanType.SCALE]: {
    products: -1,
    users: -1,
    orders: -1,
    whatsappTemplates: -1,
    reports: true,
    prioritySupport: true,
  },
};
