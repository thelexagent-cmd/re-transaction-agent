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

const inputStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  outline: 'none',
  fontSize: '0.875rem',
  padding: '0.5rem 0.75rem',
  borderRadius: '0.5rem',
};

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
      await createTask(txIdNum, { title: newTaskName.trim() });
      await mutate();
      setNewTaskName('');
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function handleToggleTask(task: TaskItem) {
    if (!txIdNum) return;
    try {
      await updateTask(txIdNum, task.id, { status: task.status === 'completed' ? 'pending' : 'completed' });
      await mutate();
    } catch { /* ignore */ }
  }

  async function handleDeleteTask(taskId: number) {
    if (!txIdNum) return;
    try {
      await deleteTask(txIdNum, taskId);
      await mutate();
    } catch { /* ignore */ }
  }

  async function handleUpdateTask(taskId: number, updates: Partial<{ due_date: string; assigned_role: string }>) {
    if (!txIdNum) return;
    try {
      await updateTask(txIdNum, taskId, updates);
      await mutate();
    } catch { /* ignore */ }
  }

  const taskList = tasks ?? [];
  const completedCount = taskList.filter((t) => t.status === 'completed').length;
  const pct = taskList.length > 0 ? Math.round((completedCount / taskList.length) * 100) : 0;

  return (
    <div className="rounded-2xl h-full" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.35)' }}>
      {/* Header */}
      <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <ListChecks className="h-3.5 w-3.5" style={{ color: '#60a5fa' }} />
          </div>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Active Tasks</h2>
        </div>

        {/* Transaction selector */}
        <div className="relative">
          <select
            value={selectedTxId}
            onChange={(e) => onSelectTx(e.target.value)}
            className="w-full appearance-none rounded-lg transition-all duration-150"
            style={{ ...inputStyle, paddingRight: '2rem' }}
          >
            <option value="">— Select a transaction —</option>
            {transactions.map((tx) => (
              <option key={tx.id} value={String(tx.id)}>
                {tx.address} ({tx.status})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        </div>
      </div>

      {selectedTxId ? (
        <>
          {/* Progress */}
          {taskList.length > 0 && (
            <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(148,163,184,0.07)', background: 'rgba(148,163,184,0.03)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{completedCount}/{taskList.length} complete</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#60a5fa' }}>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(148,163,184,0.1)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #3b82f6, #2563eb)' }}
                />
              </div>
            </div>
          )}

          {/* Add task */}
          <div className="px-5 py-3 flex gap-2" style={{ borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
            <input
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              placeholder="Add a new task..."
              className="flex-1 transition-all duration-150"
              style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(59,130,246,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.08)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(148,163,184,0.09)'; e.target.style.boxShadow = 'none'; }}
            />
            <button
              onClick={handleAddTask}
              disabled={!newTaskName.trim() || saving}
              className="inline-flex items-center gap-1 rounded-lg transition-all duration-150 disabled:opacity-40"
              style={{ padding: '0.5rem 0.875rem', fontSize: '0.75rem', fontWeight: 600, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>

          {/* Task list */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
            {taskList.length === 0 ? (
              <div className="px-5 py-12 text-center" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                No tasks yet. Add tasks manually above.
              </div>
            ) : (
              taskList.map((task) => (
                <div
                  key={task.id}
                  className="px-5 py-3 transition-colors duration-100"
                  style={{ borderBottom: '1px solid rgba(148,163,184,0.05)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.03)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleToggleTask(task)} className="shrink-0">
                      {task.status === 'completed' ? (
                        <div className="h-5 w-5 rounded flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded border-2 transition-colors" style={{ borderColor: 'rgba(148,163,184,0.2)' }} />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: '0.875rem', color: task.status === 'completed' ? '#3d5068' : '#e2e8f0', textDecoration: task.status === 'completed' ? 'line-through' : 'none' }}>
                        {task.title}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {editingId === task.id ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="date"
                              value={task.due_date ?? ''}
                              onChange={(e) => handleUpdateTask(task.id, { due_date: e.target.value })}
                              className="rounded"
                              style={{ ...inputStyle, padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            />
                            <input
                              type="text"
                              value={task.assigned_role ?? ''}
                              onChange={(e) => handleUpdateTask(task.id, { assigned_role: e.target.value })}
                              placeholder="Role"
                              className="rounded w-24"
                              style={{ ...inputStyle, padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            />
                            <button
                              onClick={() => setEditingId(null)}
                              style={{ fontSize: '0.75rem', color: '#3b82f6' }}
                            >
                              Done
                            </button>
                          </div>
                        ) : (
                          <>
                            {task.due_date && (
                              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Due {task.due_date}</span>
                            )}
                            {task.assigned_role && (
                              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{task.assigned_role}</span>
                            )}
                            <button
                              onClick={() => setEditingId(task.id)}
                              style={{ fontSize: '0.6875rem', color: '#3b82f6' }}
                            >
                              Edit
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="shrink-0 transition-colors duration-150"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#2d3f55'; }}
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
        <div className="px-5 py-16 text-center" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Select a transaction above to view or manage tasks.
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  const { data: transactions } = useSWR('/transactions', getTransactions, { revalidateOnFocus: false });
  const [selectedTxId, setSelectedTxId] = useState('');

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', boxShadow: '0 4px 16px rgba(59,130,246,0.35)' }}>
          <CheckSquare className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
            Task Manager
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>Manage per-transaction task checklists</p>
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
