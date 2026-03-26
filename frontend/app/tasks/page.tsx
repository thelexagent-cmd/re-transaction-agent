'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { getTransactions } from '@/lib/api';
import type { TransactionListItem } from '@/lib/api';
import {
  CheckSquare,
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  ListChecks,
  ClipboardList,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

type TaskItem = {
  id: string;
  name: string;
  completed: boolean;
  dueDate: string;
  assignedRole: string;
};

type TaskTemplate = {
  id: string;
  name: string;
  tasks: string[];
};

// ── Default Templates ──────────────────────────────────────────────────────

const DEFAULT_TEMPLATES: TaskTemplate[] = [
  {
    id: 'tpl_standard_purchase',
    name: 'Standard Purchase',
    tasks: [
      'Order title search',
      'Schedule inspection',
      'Send intro email to buyer',
      'Collect HOA docs',
      'Verify earnest money received',
      'Upload executed contract',
      'Order appraisal',
      'Submit loan application docs',
      'Review title commitment',
      'Schedule final walkthrough',
      'Confirm closing time/location',
      'Send closing day instructions',
    ],
  },
  {
    id: 'tpl_cash_purchase',
    name: 'Cash Purchase',
    tasks: [
      'Order title search',
      'Schedule inspection',
      'Send intro email to buyer',
      'Collect HOA docs',
      'Verify earnest money received',
      'Upload executed contract',
      'Review title commitment',
      'Send closing day instructions',
    ],
  },
  {
    id: 'tpl_listing',
    name: 'Listing',
    tasks: [
      'Sign listing agreement',
      'Schedule professional photography',
      'Create MLS listing',
      'Order pre-listing inspection',
      'Install lockbox and signage',
      'Schedule open house',
      'Review and respond to offers',
      'Coordinate with closing attorney',
    ],
  },
];

const TEMPLATES_STORAGE_KEY = 'lex_task_templates';

function loadTemplates(): TaskTemplate[] {
  try {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as TaskTemplate[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return DEFAULT_TEMPLATES;
}

function saveTemplates(templates: TaskTemplate[]) {
  localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

function loadTasks(transactionId: number): TaskItem[] {
  try {
    const stored = localStorage.getItem(`lex_tasks_${transactionId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed as TaskItem[];
    }
  } catch {
    // ignore
  }
  return [];
}

function saveTasks(transactionId: number, tasks: TaskItem[]) {
  localStorage.setItem(`lex_tasks_${transactionId}`, JSON.stringify(tasks));
}

function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Template Library Panel ──────────────────────────────────────────────────

function TemplateLibrary({
  templates,
  onApplyTemplate,
  onCreateTemplate,
  onDeleteTemplate,
  selectedTxId,
}: {
  templates: TaskTemplate[];
  onApplyTemplate: (template: TaskTemplate) => void;
  onCreateTemplate: (name: string, tasks: string[]) => void;
  onDeleteTemplate: (id: string) => void;
  selectedTxId: string;
}) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTasks, setNewTasks] = useState('');

  function handleCreate() {
    if (!newName.trim()) return;
    const tasks = newTasks
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (tasks.length === 0) return;
    onCreateTemplate(newName.trim(), tasks);
    setNewName('');
    setNewTasks('');
    setShowNew(false);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm h-full">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-semibold text-slate-900">Template Library</h2>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Template
        </button>
      </div>

      {showNew && (
        <div className="px-5 py-4 border-b border-slate-200 bg-blue-50">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Template Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Commercial Lease"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tasks (one per line)</label>
              <textarea
                value={newTasks}
                onChange={(e) => setNewTasks(e.target.value)}
                rows={5}
                placeholder="Order title search&#10;Schedule inspection&#10;..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Save Template
              </button>
              <button
                onClick={() => setShowNew(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-100 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
        {templates.map((tpl) => {
          const isDefault = tpl.id.startsWith('tpl_');
          return (
            <div key={tpl.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-900">{tpl.name}</h3>
                <span className="text-xs text-slate-400">{tpl.tasks.length} tasks</span>
              </div>
              <div className="text-xs text-slate-500 mb-3 line-clamp-2">
                {tpl.tasks.slice(0, 3).join(', ')}
                {tpl.tasks.length > 3 && ` +${tpl.tasks.length - 3} more`}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onApplyTemplate(tpl)}
                  disabled={!selectedTxId}
                  title={selectedTxId ? 'Apply to selected transaction' : 'Select a transaction first'}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  Apply
                </button>
                {!isDefault && (
                  <button
                    onClick={() => onDeleteTemplate(tpl.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Active Tasks Panel ──────────────────────────────────────────────────────

function ActiveTasksPanel({
  transactions,
  selectedTxId,
  onSelectTx,
  tasks,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onUpdateTask,
}: {
  transactions: TransactionListItem[];
  selectedTxId: string;
  onSelectTx: (id: string) => void;
  tasks: TaskItem[];
  onToggleTask: (taskId: string) => void;
  onAddTask: (name: string) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, updates: Partial<TaskItem>) => void;
}) {
  const [newTaskName, setNewTaskName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  function handleAddTask() {
    if (!newTaskName.trim() || !selectedTxId) return;
    onAddTask(newTaskName.trim());
    setNewTaskName('');
  }

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm h-full">
      <div className="px-5 py-4 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <ListChecks className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-semibold text-slate-900">Active Tasks</h2>
        </div>

        {/* Transaction selector */}
        <div className="relative">
          <select
            value={selectedTxId}
            onChange={(e) => onSelectTx(e.target.value)}
            className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select a transaction --</option>
            {transactions.map((tx) => (
              <option key={tx.id} value={String(tx.id)}>
                {tx.address} ({tx.status})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {selectedTxId ? (
        <>
          {/* Progress */}
          {tasks.length > 0 && (
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-600">
                  {completedCount}/{tasks.length} complete
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Add task */}
          <div className="px-5 py-3 border-b border-slate-200 flex gap-2">
            <input
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              placeholder="Add a new task..."
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddTask}
              disabled={!newTaskName.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>

          {/* Task list */}
          <div className="divide-y divide-slate-100 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
            {tasks.length === 0 ? (
              <div className="px-5 py-12 text-center text-slate-400 text-sm">
                No tasks yet. Add tasks manually or apply a template.
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onToggleTask(task.id)}
                      className="shrink-0"
                    >
                      {task.completed ? (
                        <CheckSquare className="h-5 w-5 text-green-500" />
                      ) : (
                        <div className="h-5 w-5 rounded border-2 border-slate-300 hover:border-blue-400 transition-colors" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm ${task.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}
                      >
                        {task.name}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {editingId === task.id ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="date"
                              value={task.dueDate}
                              onChange={(e) => onUpdateTask(task.id, { dueDate: e.target.value })}
                              className="px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              value={task.assignedRole}
                              onChange={(e) => onUpdateTask(task.id, { assignedRole: e.target.value })}
                              placeholder="Role"
                              className="px-2 py-1 text-xs border border-slate-200 rounded w-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Done
                            </button>
                          </div>
                        ) : (
                          <>
                            {task.dueDate && (
                              <span className="text-xs text-slate-400">Due {task.dueDate}</span>
                            )}
                            {task.assignedRole && (
                              <span className="text-xs text-slate-400">{task.assignedRole}</span>
                            )}
                            <button
                              onClick={() => setEditingId(task.id)}
                              className="text-xs text-blue-500 hover:underline"
                            >
                              Edit
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="shrink-0 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="px-5 py-16 text-center text-slate-400 text-sm">
          Select a transaction above to view or manage tasks.
        </div>
      )}
    </div>
  );
}

// ── Main Tasks Page ─────────────────────────────────────────────────────────

export default function TasksPage() {
  const { data: transactions } = useSWR('/transactions', getTransactions, { revalidateOnFocus: false });
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [selectedTxId, setSelectedTxId] = useState('');
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  // Load templates on mount
  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  // Load tasks when transaction changes
  useEffect(() => {
    if (selectedTxId) {
      setTasks(loadTasks(parseInt(selectedTxId, 10)));
    } else {
      setTasks([]);
    }
  }, [selectedTxId]);

  const persistTasks = useCallback(
    (updated: TaskItem[]) => {
      setTasks(updated);
      if (selectedTxId) {
        saveTasks(parseInt(selectedTxId, 10), updated);
      }
    },
    [selectedTxId]
  );

  function handleToggleTask(taskId: string) {
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t));
    persistTasks(updated);
  }

  function handleAddTask(name: string) {
    const newTask: TaskItem = {
      id: generateId(),
      name,
      completed: false,
      dueDate: '',
      assignedRole: '',
    };
    persistTasks([...tasks, newTask]);
  }

  function handleDeleteTask(taskId: string) {
    persistTasks(tasks.filter((t) => t.id !== taskId));
  }

  function handleUpdateTask(taskId: string, updates: Partial<TaskItem>) {
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t));
    persistTasks(updated);
  }

  function handleApplyTemplate(template: TaskTemplate) {
    if (!selectedTxId) return;
    const newTasks: TaskItem[] = template.tasks.map((name) => ({
      id: generateId(),
      name,
      completed: false,
      dueDate: '',
      assignedRole: '',
    }));
    persistTasks([...tasks, ...newTasks]);
  }

  function handleCreateTemplate(name: string, taskNames: string[]) {
    const newTemplate: TaskTemplate = {
      id: `custom_${Date.now()}`,
      name,
      tasks: taskNames,
    };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    saveTemplates(updated);
  }

  function handleDeleteTemplate(id: string) {
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    saveTemplates(updated);
  }

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
          <CheckSquare className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Task Manager</h1>
          <p className="text-sm text-slate-500">Manage task templates and per-transaction checklists</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {/* Left: Template Library (1/3) */}
        <div className="lg:col-span-1">
          <TemplateLibrary
            templates={templates}
            onApplyTemplate={handleApplyTemplate}
            onCreateTemplate={handleCreateTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            selectedTxId={selectedTxId}
          />
        </div>

        {/* Right: Active Tasks (2/3) */}
        <div className="lg:col-span-2">
          <ActiveTasksPanel
            transactions={transactions ?? []}
            selectedTxId={selectedTxId}
            onSelectTx={setSelectedTxId}
            tasks={tasks}
            onToggleTask={handleToggleTask}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
            onUpdateTask={handleUpdateTask}
          />
        </div>
      </div>
    </div>
  );
}
