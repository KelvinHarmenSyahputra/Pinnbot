import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const TASKS_FILE = path.join(config.rootDir, 'data', 'tasks.json');

class TaskTracker {
  constructor() {
    this.tasks = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(TASKS_FILE)) {
        this.tasks = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
      }
    } catch {
      this.tasks = [];
    }
  }

  save() {
    try {
      fs.writeFileSync(TASKS_FILE, JSON.stringify(this.tasks, null, 2));
    } catch (err) {
      console.error('Failed to save tasks:', err);
    }
  }

  addTask(title, deadline = '', assignedBy = 'User') {
    const task = {
      id: Date.now().toString(36),
      title: title.trim(),
      deadline: deadline.trim(),
      assignedBy,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    this.tasks.push(task);
    this.save();
    return task;
  }

  markDone(query) {
    const q = query.toLowerCase().trim();
    const task = this.tasks.find(t => 
      t.status === 'pending' && 
      (t.id === q || t.title.toLowerCase().includes(q))
    );

    if (task) {
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      this.save();
      return task;
    }
    return null;
  }

  getPendingTasks() {
    return this.tasks.filter(t => t.status === 'pending');
  }

  formatTaskList() {
    const pending = this.getPendingTasks();
    if (pending.length === 0) {
      return '🎉 Ga ada tugas kuliah yang pending! Santuy dulu~';
    }

    let out = '📋 *Daftar Tugas Kuliah:*\n\n';
    pending.forEach((t, i) => {
      out += `${i + 1}. *${t.title}*\n`;
      if (t.deadline) out += `   ⏰ Deadline: ${t.deadline}\n`;
      out += `   🆔 ID: \`${t.id}\`\n\n`;
    });
    out += 'Ketik `/tugas selesai <ID/Nama>` kalau udah dikerjain!';
    return out.trim();
  }
}

export const taskTracker = new TaskTracker();
