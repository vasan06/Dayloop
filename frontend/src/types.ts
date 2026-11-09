export type Page =
  | 'landing'
  | 'signin'
  | 'signup'
  | 'forgot'
  | 'reset'
  | 'dashboard'
  | 'tasks'
  | 'projects'
  | 'habits'
  | 'finance'
  | 'transactions'
  | 'budgets'
  | 'notes'
  | 'calendar'
  | 'analytics'
  | 'settings'
  | 'states'
  | 'responsive';

export type TaskStatus = 'todo' | 'doing' | 'done';
export type Priority = 'high' | 'med' | 'low';

export type Task = {
  id: string;
  title: string;
  desc: string;
  due: string;
  priority: Priority;
  projectId: string;
  status: TaskStatus;
};

export type Project = {
  id: string;
  name: string;
  desc: string;
  deadline: string;
  status: 'active' | 'planned' | 'completed';
  color: string;
};

export type Habit = {
  id: string;
  name: string;
  icon: string;
  checks: string[];
  streak: number;
};

export type Transaction = {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  type: 'in' | 'out';
};

export type Note = {
  id: string;
  title: string;
  body: string;
  date: string;
  projectId: string;
};
