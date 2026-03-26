'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { getTransactions, getTasks, createTask, updateTask, deleteTask } from '@/lib/api';
import type { TransactionListItem, TaskItem } from '@/lib/api';
import {
  CheckSquare,
  Plus,
  Trash2,
  ChevronDown,
  ListChecks,
} from 'lucide-react';

// ── Active Tasks Panel ──────────────────────────────────────────────────────

function ActiveTasksPanel({
  transactions,
  selectedTxId,
  onSelectTx,
}: {
  transactions: TransactionListItem[];
  selectedTxId: string;
  onSelectTx: (id: string) => void;
}) {
  const txIdNum = selectedTxId ? parseInt(selectedTxId, 10) : null;
  const { data: tasks, mutate } = useSWR(
    txIdNum ? `/transactions/${txIdNum}/tasks` : null,
    () => getTasks(txIdNum!),
    { revalidateOnFocus: false }
  );

  const [newTaskName, setNewTaskName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAddTask() {
    if (!newTaskName.trim() || !txIdNum) return;
    setSaving(true);
    try {
      await createTask(txIdNum, { name: newTaskName.trim() });
      await mutate();
      setNewTaskName('');
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleTask(task: TaskItem) {
    if (!txIdNum) return;
    try {
      await updateTask(txIdNum, task.id, { completed: !task.completed });
      await mutate();
    } catch {
      // ignore
    }
  }

  async function handleDeleteTask(taskId: number) {
    if (!txIdNum) return;
    try {
      await deleteTask(txIdNum, taskId);
      await mutate();
    } catch {
      // ignore
    }
  }

  async function handleUpdateTask(taskId: number, updates: Partial<{ due_date: string; assigned_role: string }>) {
    if (!txIdNum) return;
    try {
      await updateTask(txIdNum, taskId, updates);
      await mutate();
    } catch {
      // ignore
    }
  }

  const taskList = tasks ?? [];
  const completedCount = taskList.filter((t) => t.completed).length;

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
          {taskList.length > 0 && (
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-600">
                  {completedCount}/{taskList.length} complete
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {taskList.length > 0 ? Math.round((completedCount / taskList.length) * 100) : 0}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${taskList.length > 0 ? (completedCount / taskList.length) * 100 : 0}%` }}
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
              disabled={!newTaskName.trim() || saving}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>

          {/* Task list */}
          <div className="divide-y divide-slate-100 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
            {taskList.length === 0 ? (
              <div className="px-5 py-12 text-center text-slate-400 text-sm">
                No tasks yet. Add tasks manually above.
              </div>
            ) : (
              taskList.map((task) => (
                <div key={task.id} className="px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleTask(task)}
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
                              value={task.due_date ?? ''}
                              onChange={(e) => handleUpdateTask(task.id, { due_date: e.target.value })}
                              className="px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              value={task.assigned_role ?? ''}
                              onChange={(e) => handleUpdateTask(task.id, { assigned_role: e.target.value })}
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
                            {task.due_date && (
                              <span className="text-xs text-slate-400">Due {task.due_date}</span>
                            )}
                            {task.assigned_role && (
                              <span className="text-xs text-slate-400">{task.assigned_role}</span>
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
                      onClick={() => handleDeleteTask(task.id)}
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
  const [selectedTxId, setSelectedTxId] = useState('');

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
          <CheckSquare className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Task Manager</h1>
          <p className="text-sm text-slate-500">Manage per-transaction task checklists</p>
        </div>
      </div>

      <ActiveTasksPanel
        transactions={transactions ?? []}
        selectedTxId={selectedTxId}
        onSelectTx={setSelectedTxId}
      />
    </div>
  );
}
