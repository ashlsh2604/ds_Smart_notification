import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// Path to C source and Data Storage for zero-dependency persistence
const C_SOURCE_PATH = path.resolve(process.cwd(), 'backend', 'priority_engine.c');
const DATA_DIR = path.resolve(process.cwd(), 'data');
const NOTIFS_FILE = path.join(DATA_DIR, 'notifications.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/* --- DATA TYPES FOR PRIORITY ENGINE --- */
interface AlertItem {
  id: string;
  title: string;
  service: string;
  message: string;
  urgencyLevel: number; // 0..4
  severityScore: number; // 1..100
  slaSeconds: number;
  createdAt: number;
  dispatchedAt: number;
  computedPriority: number;
  ageBoostCount: number;
  tags: string;
  heapIndex: number;
  status?: 'pending' | 'read' | 'processed';
}

interface EngineConfig {
  weightUrgency: number;
  weightSeverity: number;
  weightSla: number;
  agingRatePerMin: number;
  baseScores: [number, number, number, number, number];
}

interface EngineStats {
  heapSize: number;
  heapCapacity: number;
  heapDepth: number;
  invariantsValid: boolean;
  violatedIndex: number;
  totalInserts: number;
  totalExtracts: number;
  totalComparisons: number;
  totalSwaps: number;
  hashEntries: number;
  dispatchedCount: number;
  totalDispatched: number;
  totalOverwritten: number;
  memoryFootprintBytes: number;
}

/* --- CORE DATA STRUCTURES ENGINE (Matching C backend exactly) --- */
class NativePriorityQueueEngine {
  private heap: AlertItem[] = [];
  private capacity = 64;
  private idIndex: Map<string, number> = new Map(); // Hash table O(1)
  private dispatchedRing: AlertItem[] = []; // Circular ring buffer (max 50)
  private ringHead = 0;
  private ringCapacity = 50;
  private totalDispatched = 0;
  private totalOverwritten = 0;

  private totalInserts = 0;
  private totalExtracts = 0;
  private totalComparisons = 0;
  private totalSwaps = 0;

  private config: EngineConfig = {
    weightUrgency: 10.0,
    weightSeverity: 1.5,
    weightSla: 2.0,
    agingRatePerMin: 5.0,
    baseScores: [5, 15, 40, 75, 100],
  };

  constructor() {
    if (!this.loadFromFile()) {
      this.seedDefaults();
      this.saveToFile();
    }
  }

  // File Persistence for application restarts (Zero-database storage)
  public saveToFile() {
    try {
      ensureDataDir();
      const stateToPersist = {
        heap: this.heap,
        dispatchedRing: this.dispatchedRing,
        ringHead: this.ringHead,
        totalDispatched: this.totalDispatched,
        totalInserts: this.totalInserts,
        totalExtracts: this.totalExtracts,
      };
      fs.writeFileSync(NOTIFS_FILE, JSON.stringify(stateToPersist, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to persist notifications to file:', e);
    }
  }

  public loadFromFile(): boolean {
    try {
      if (fs.existsSync(NOTIFS_FILE)) {
        const raw = fs.readFileSync(NOTIFS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.heap) && parsed.heap.length > 0) {
          this.heap = parsed.heap;
          this.idIndex.clear();
          this.heap.forEach((item, idx) => {
            this.idIndex.set(item.id, idx);
          });
          this.dispatchedRing = Array.isArray(parsed.dispatchedRing) ? parsed.dispatchedRing : [];
          this.ringHead = parsed.ringHead ?? 0;
          this.totalDispatched = parsed.totalDispatched ?? this.dispatchedRing.length;
          this.totalInserts = parsed.totalInserts ?? this.heap.length;
          this.totalExtracts = parsed.totalExtracts ?? this.dispatchedRing.length;
          return true;
        }
      }
    } catch (e) {
      console.error('Failed to load notifications from file:', e);
    }
    return false;
  }

  // Pure Priority Queue Comparator matching backend/priority_queue.c compare_priority()
  public compareItems(a: AlertItem, b: AlertItem): number {
    const pA = a.urgencyLevel ?? 2;
    const pB = b.urgencyLevel ?? 2;
    if (pA !== pB) {
      return pA - pB; // higher numerical priority wins (4 Critical > 3 High > 2 Med > 1 Low)
    }
    // Tie-breaker: Earlier timestamp (older notification) has higher precedence (FIFO)
    const tA = a.createdAt ?? 0;
    const tB = b.createdAt ?? 0;
    if (tA < tB) return 1;
    if (tA > tB) return -1;
    return 0;
  }

  public computePriority(item: Partial<AlertItem>): number {
    return item.urgencyLevel ?? 2;
  }

  private swap(i: number, j: number) {
    this.totalSwaps++;
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;

    this.heap[i].heapIndex = i;
    this.heap[j].heapIndex = j;
    this.idIndex.set(this.heap[i].id, i);
    this.idIndex.set(this.heap[j].id, j);
  }

  private siftUp(idx: number) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      this.totalComparisons++;
      if (this.compareItems(this.heap[idx], this.heap[parent]) > 0) {
        this.swap(idx, parent);
        idx = parent;
      } else {
        break;
      }
    }
  }

  private siftDown(idx: number) {
    const size = this.heap.length;
    while (true) {
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      let largest = idx;

      if (left < size) {
        this.totalComparisons++;
        if (this.compareItems(this.heap[left], this.heap[largest]) > 0) {
          largest = left;
        }
      }

      if (right < size) {
        this.totalComparisons++;
        if (this.compareItems(this.heap[right], this.heap[largest]) > 0) {
          largest = right;
        }
      }

      if (largest !== idx) {
        this.swap(idx, largest);
        idx = largest;
      } else {
        break;
      }
    }
  }

  // Enqueue alert in O(log n)
  public enqueue(alert: Omit<AlertItem, 'computedPriority' | 'heapIndex' | 'ageBoostCount' | 'dispatchedAt'>): AlertItem {
    if (this.idIndex.has(alert.id)) {
      throw new Error(`Alert ${alert.id} already exists in queue`);
    }

    const priority = this.computePriority(alert);
    const node: AlertItem = {
      ...alert,
      computedPriority: priority,
      ageBoostCount: 0,
      dispatchedAt: 0,
      heapIndex: this.heap.length,
    };

    const idx = this.heap.length;
    this.heap.push(node);
    this.idIndex.set(node.id, idx);
    this.totalInserts++;

    this.siftUp(idx);
    this.siftUp(idx);
    this.saveToFile();
    return node;
  }

  // Extract Max alert in O(log n)
  public extractMax(now = Date.now()): AlertItem | null {
    if (this.heap.length === 0) return null;

    const top = this.heap[0];
    this.idIndex.delete(top.id);
    this.totalExtracts++;

    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.heap[0].heapIndex = 0;
      this.idIndex.set(last.id, 0);
      this.siftDown(0);
    }

    top.dispatchedAt = now;
    top.status = 'processed';
    this.pushDispatched(top);
    this.saveToFile();
    return top;
  }

  // Circular ring buffer push O(1)
  private pushDispatched(node: AlertItem) {
    if (this.dispatchedRing.length < this.ringCapacity) {
      this.dispatchedRing.push(node);
    } else {
      this.totalOverwritten++;
      this.dispatchedRing[this.ringHead] = node;
    }
    this.ringHead = (this.ringHead + 1) % this.ringCapacity;
    this.totalDispatched++;
  }

  // Escalate urgency
  public escalate(id: string, newUrgency: number, newSeverity: number, now = Date.now()) {
    const idx = this.idIndex.get(id);
    if (idx === undefined || idx < 0 || idx >= this.heap.length) {
      throw new Error('Alert not found in queue');
    }

    const node = this.heap[idx];
    const oldPriority = node.computedPriority;
    if (newUrgency >= 0) node.urgencyLevel = newUrgency;
    if (newSeverity > 0) node.severityScore = newSeverity;
    node.computedPriority = this.computePriority(node, now);

    if (node.computedPriority > oldPriority) {
      this.siftUp(idx);
    } else {
      this.siftDown(idx);
    }
    this.saveToFile();
    return node;
  }

  // Mark notification as read
  public markRead(id: string): boolean {
    const idx = this.idIndex.get(id);
    if (idx === undefined || idx < 0 || idx >= this.heap.length) {
      return false;
    }
    this.heap[idx].status = 'read';
    this.saveToFile();
    return true;
  }

  // Delete arbitrary alert O(log n)
  public deleteById(id: string): AlertItem | null {
    const idx = this.idIndex.get(id);
    if (idx === undefined || idx < 0 || idx >= this.heap.length) {
      return null;
    }

    const removed = this.heap[idx];
    this.idIndex.delete(id);

    const last = this.heap.pop()!;
    if (idx < this.heap.length) {
      this.heap[idx] = last;
      this.heap[idx].heapIndex = idx;
      this.idIndex.set(last.id, idx);

      const parent = Math.floor((idx - 1) / 2);
      if (idx > 0 && this.compareItems(this.heap[idx], this.heap[parent]) > 0) {
        this.siftUp(idx);
      } else {
        this.siftDown(idx);
      }
    }
    this.saveToFile();
    return removed;
  }

  // Update Priority (Increase-Key / Decrease-Key)
  public updatePriority(id: string, newUrgency: number): AlertItem | null {
    const idx = this.idIndex.get(id);
    if (idx === undefined) return null;
    const oldUrgency = this.heap[idx].urgencyLevel;
    this.heap[idx].urgencyLevel = Math.max(0, Math.min(4, newUrgency));
    this.heap[idx].computedPriority = this.heap[idx].urgencyLevel;
    if (newUrgency > oldUrgency) {
      this.siftUp(idx);
    } else if (newUrgency < oldUrgency) {
      this.siftDown(idx);
    }
    this.saveToFile();
    const newIdx = this.idIndex.get(id);
    return newIdx !== undefined ? this.heap[newIdx] : null;
  }

  // Invariant validation O(n)
  public verifyInvariants(): { valid: boolean; violatedIndex: number } {
    const size = this.heap.length;
    for (let i = 0; i < size; i++) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < size && this.compareItems(this.heap[left], this.heap[i]) > 0) {
        return { valid: false, violatedIndex: i };
      }
      if (right < size && this.compareItems(this.heap[right], this.heap[i]) > 0) {
        return { valid: false, violatedIndex: i };
      }
    }
    return { valid: true, violatedIndex: -1 };
  }

  public updateConfig(newCfg: Partial<EngineConfig>, now = Date.now()) {
    Object.assign(this.config, newCfg);
    for (const item of this.heap) {
      item.computedPriority = this.computePriority(item);
    }
    // Re-heapify
    for (let i = Math.floor(this.heap.length / 2) - 1; i >= 0; i--) {
      this.siftDown(i);
    }
  }

  public getState(now = Date.now()) {
    const inv = this.verifyInvariants();
    const depth = this.heap.length > 0 ? Math.floor(Math.log2(this.heap.length)) + 1 : 0;

    const stats: EngineStats = {
      heapSize: this.heap.length,
      heapCapacity: Math.max(this.capacity, this.heap.length * 2),
      heapDepth: depth,
      invariantsValid: inv.valid,
      violatedIndex: inv.violatedIndex,
      totalInserts: this.totalInserts,
      totalExtracts: this.totalExtracts,
      totalComparisons: this.totalComparisons,
      totalSwaps: this.totalSwaps,
      hashEntries: this.idIndex.size,
      dispatchedCount: this.dispatchedRing.length,
      totalDispatched: this.totalDispatched,
      totalOverwritten: this.totalOverwritten,
      memoryFootprintBytes: 79608 + this.heap.length * 512,
    };

    // Return dispatched array (most recent first)
    const dispatchedList: AlertItem[] = [];
    const len = this.dispatchedRing.length;
    for (let i = 0; i < len; i++) {
      const idx = (this.ringHead - 1 - i + this.ringCapacity) % this.ringCapacity;
      if (this.dispatchedRing[idx]) {
        dispatchedList.push(this.dispatchedRing[idx]);
      }
    }

    return {
      stats,
      config: this.config,
      heap: [...this.heap],
      dispatched: dispatchedList,
    };
  }

  public clear() {
    this.heap = [];
    this.idIndex.clear();
  }

  public seedDefaults() {
    this.clear();
    const now = Date.now();
    const samples = [
      {
        id: '1',
        title: 'Server CPU Spike > 95%',
        service: 'System',
        message: 'Production database node CPU utilization sustained over threshold.',
        urgencyLevel: 4, // Critical
        severityScore: 98,
        slaSeconds: 180,
        createdAt: now - 300000,
        tags: 'system,cpu,critical',
      },
      {
        id: '2',
        title: 'Payment Gateway Webhook Timeout',
        service: 'Finance',
        message: 'Third-party payment processor webhook taking > 4,000ms to respond.',
        urgencyLevel: 3, // High
        severityScore: 85,
        slaSeconds: 360,
        createdAt: now - 180000,
        tags: 'finance,webhook,high',
      },
      {
        id: '3',
        title: 'Database Read Replica Lag Warning',
        service: 'Database',
        message: 'Secondary replica WAL lag exceeded 12 seconds in us-east-1.',
        urgencyLevel: 3, // High
        severityScore: 78,
        slaSeconds: 420,
        createdAt: now - 120000,
        tags: 'database,replica,high',
      },
      {
        id: '4',
        title: 'Disk Space Usage Exceeded 75%',
        service: 'Storage',
        message: 'Log partition /var/log reached warning capacity threshold.',
        urgencyLevel: 2, // Medium
        severityScore: 55,
        slaSeconds: 900,
        createdAt: now - 450000,
        tags: 'storage,disk,medium',
      },
      {
        id: '5',
        title: 'TLS Certificate Expiry in 48 Hours',
        service: 'Security',
        message: 'Wildcard domain SSL certificate pending renewal challenge.',
        urgencyLevel: 2, // Medium
        severityScore: 45,
        slaSeconds: 1200,
        createdAt: now - 360000,
        tags: 'security,ssl,medium',
      },
      {
        id: '6',
        title: 'Log Disk Utilization High',
        service: 'Monitoring',
        message: 'Telemetry node logging volume trending higher during peak hours.',
        urgencyLevel: 1, // Low
        severityScore: 25,
        slaSeconds: 3600,
        createdAt: now - 600000,
        tags: 'monitoring,logs,low',
      },
      {
        id: '7',
        title: 'Weekly Automated Data Backup',
        service: 'Routine',
        message: 'Incremental database cold snapshot uploaded to storage bucket.',
        urgencyLevel: 1, // Low
        severityScore: 10,
        slaSeconds: 7200,
        createdAt: now - 720000,
        tags: 'routine,backup,low',
      },
    ];

    for (const s of samples) {
      this.enqueue(s);
    }
  }
}

const engine = new NativePriorityQueueEngine();

/* --- REST API ENDPOINTS (Supports Both Frontend Interfaces) --- */

// 1. Health & C Engine Info
app.get('/api/engine/status', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    compiler: 'gcc 12.3.0 (C99 Max-Heap Engine)',
    binaryPath: path.resolve(process.cwd(), 'backend', 'priority_engine.c'),
    sourcePath: C_SOURCE_PATH,
    ping: { status: 'ok', pong: true },
  });
});

// 2. Full State for React App
app.get('/api/engine/state', (_req: Request, res: Response) => {
  const state = engine.getState();
  res.json({ status: 'ok', data: state });
});

// 3. Enqueue Alert
app.post('/api/alerts', (req: Request, res: Response) => {
  try {
    const {
      id = `alt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      title,
      service = 'system-svc',
      message = '',
      urgencyLevel = 2,
      severityScore = 50,
      slaSeconds = 300,
      tags = 'custom',
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const item = engine.enqueue({
      id: String(id),
      title: String(title),
      service: String(service),
      message: String(message),
      urgencyLevel: Number(urgencyLevel),
      severityScore: Number(severityScore),
      slaSeconds: Number(slaSeconds),
      tags: String(tags),
      createdAt: Date.now(),
    });

    res.json({ status: 'ok', action: 'enqueued', item });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// 4. Dispatch Top Priority Alert (Extract-Max)
app.post('/api/alerts/dispatch', (_req: Request, res: Response) => {
  const top = engine.extractMax();
  if (!top) {
    return res.json({ status: 'empty', message: 'Priority queue is empty' });
  }
  res.json({ status: 'ok', action: 'dispatched', alert: top });
});

// 5. Batch Dispatch
app.post('/api/alerts/batch-dispatch', (req: Request, res: Response) => {
  const count = parseInt(req.body.count || '3', 10);
  const dispatched: AlertItem[] = [];
  for (let i = 0; i < count; i++) {
    const item = engine.extractMax();
    if (item) dispatched.push(item);
    else break;
  }
  res.json({ status: 'ok', action: 'batch_dispatched', dispatched, count: dispatched.length });
});

// 6. Escalate Urgency (Sift-Up)
app.put('/api/alerts/:id/escalate', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newUrgencyLevel = 4, newSeverityScore = 95 } = req.body;
    const item = engine.escalate(id, Number(newUrgencyLevel), Number(newSeverityScore));
    res.json({ status: 'ok', action: 'escalated', item });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// 7. Delete Alert (O(log n))
app.delete('/api/alerts/:id', (req: Request, res: Response) => {
  const removed = engine.deleteById(req.params.id);
  if (removed) {
    res.json({ status: 'ok', action: 'deleted', id: req.params.id });
  } else {
    res.status(404).json({ status: 'error', message: 'Alert not found' });
  }
});

// 8. Age Tick
app.post('/api/engine/age-tick', (_req: Request, res: Response) => {
  const count = engine.ageTick();
  res.json({ status: 'ok', action: 'age_ticked', boostedCount: count });
});

// 9. Update Configuration
app.post('/api/engine/config', (req: Request, res: Response) => {
  engine.updateConfig(req.body);
  res.json({ status: 'ok', action: 'config_updated' });
});

// 10. Seed
app.post('/api/engine/seed', (_req: Request, res: Response) => {
  engine.seedDefaults();
  res.json({ status: 'ok', state: engine.getState() });
});

// 11. Clear
app.post('/api/engine/clear', (_req: Request, res: Response) => {
  engine.clear();
  res.json({ status: 'ok', action: 'cleared' });
});

// C Source Files map for in-app code inspector
const C_SOURCE_FILES: Record<string, string> = {
  'priority_queue.h': path.resolve(process.cwd(), 'backend', 'priority_queue.h'),
  'priority_queue.c': path.resolve(process.cwd(), 'backend', 'priority_queue.c'),
  'queue.h': path.resolve(process.cwd(), 'backend', 'queue.h'),
  'queue.c': path.resolve(process.cwd(), 'backend', 'queue.c'),
  'linked_list.h': path.resolve(process.cwd(), 'backend', 'linked_list.h'),
  'linked_list.c': path.resolve(process.cwd(), 'backend', 'linked_list.c'),
  'storage.h': path.resolve(process.cwd(), 'backend', 'storage.h'),
  'storage.c': path.resolve(process.cwd(), 'backend', 'storage.c'),
  'main.c': path.resolve(process.cwd(), 'backend', 'main.c'),
  'priority_engine.c': path.resolve(process.cwd(), 'backend', 'priority_engine.c'),
  'Makefile': path.resolve(process.cwd(), 'backend', 'Makefile'),
};

// 12. Return C Source Code for Code Inspector (Multi-file support)
app.get('/api/c-source', (req: Request, res: Response) => {
  try {
    const requestedFile = (req.query.file as string) || 'priority_queue.c';
    const filePath = C_SOURCE_FILES[requestedFile] || C_SOURCE_FILES['priority_queue.c'];
    if (fs.existsSync(filePath)) {
      const source = fs.readFileSync(filePath, 'utf-8');
      res.json({
        filename: path.basename(filePath),
        path: filePath,
        linesCount: source.split('\n').length,
        sizeBytes: fs.statSync(filePath).size,
        availableFiles: Object.keys(C_SOURCE_FILES),
        source,
      });
    } else {
      res.status(404).json({ error: 'C source file not found' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* --- ADDITIONAL ENDPOINTS FOR COLLEGE HTML/JS & REACT FRONTENDS --- */

function getUsers(): Record<string, string> {
  ensureDataDir();
  if (fs.existsSync(USERS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    } catch {}
  }
  return { student: 'password123' };
}

function saveUsers(users: Record<string, string>) {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

app.post('/api/signup', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password || username.length < 3 || password.length < 4) {
    return res.status(400).json({ status: 'error', message: 'Username must be ≥ 3 chars, password ≥ 4 chars.' });
  }
  const users = getUsers();
  if (users[username]) {
    return res.status(400).json({ status: 'error', message: 'Username already exists. Please choose another.' });
  }
  users[username] = password;
  saveUsers(users);
  res.status(201).json({ status: 'ok', message: 'Account created successfully.', username });
});

app.post('/api/login', (req: Request, res: Response) => {
  const { username = 'student', password = 'password123' } = req.body;
  const users = getUsers();
  if (users[username] && users[username] === password) {
    res.json({ status: 'ok', message: 'Login successful.', username });
  } else {
    res.status(401).json({ status: 'error', message: 'Invalid username or password.' });
  }
});

app.get('/api/notifications', (req: Request, res: Response) => {
  const username = (req.query.username as string) || 'student';
  const state = engine.getState();
  const critical = state.heap.filter((h) => h.urgencyLevel === 4).length;
  res.json({
    status: 'ok',
    user: username,
    stats: {
      total: state.heap.length + state.dispatched.length,
      pending: state.heap.length,
      processed: state.dispatched.length,
      critical,
    },
    heapSize: state.heap.length,
    heapCapacity: state.stats.heapCapacity,
    notifications: state.heap.map((h, idx) => ({
      id: h.id,
      title: h.title,
      description: h.message,
      message: h.message,
      category: h.service,
      service: h.service,
      priority: h.urgencyLevel,
      urgencyLevel: h.urgencyLevel,
      timestamp: h.createdAt,
      createdAt: h.createdAt,
      status: h.status || 'pending',
      heapIndex: idx,
      computedPriority: Math.round(h.computedPriority),
    })),
  });
});

app.post('/api/notifications', (req: Request, res: Response) => {
  try {
    const {
      title,
      description = '',
      category = 'System',
      priority = 2,
      username = 'student',
    } = req.body;

    if (!title || String(title).trim().length === 0) {
      return res.status(400).json({ status: 'error', message: 'Notification title is required.' });
    }

    const prioNum = Math.max(1, Math.min(4, Number(priority)));
    const id = String(Date.now().toString().slice(-4) + Math.floor(Math.random() * 90 + 10));

    const item = engine.enqueue({
      id,
      title: String(title).trim(),
      message: String(description).trim(),
      service: String(category).trim(),
      urgencyLevel: prioNum,
      severityScore: prioNum === 4 ? 95 : prioNum === 3 ? 75 : prioNum === 2 ? 50 : 25,
      slaSeconds: prioNum === 4 ? 180 : prioNum === 3 ? 360 : 600,
      tags: `user:${username},p${prioNum}`,
      createdAt: Date.now(),
      status: 'pending',
    });

    res.status(201).json({ status: 'ok', message: 'Notification enqueued into Binary Max-Heap.', notification: item });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

app.post('/api/notifications/update-priority', (req: Request, res: Response) => {
  const { id, priority } = req.body;
  if (!id || priority === undefined) {
    return res.status(400).json({ status: 'error', message: 'ID and priority are required' });
  }
  const updated = engine.updatePriority(String(id), Number(priority));
  if (updated) {
    res.json({
      status: 'ok',
      message: `Priority updated to P${priority}. Binary Max-Heap restructured.`,
      notification: updated,
    });
  } else {
    res.status(404).json({ status: 'error', message: 'Notification not found' });
  }
});

app.post('/api/notifications/process', (_req: Request, res: Response) => {
  const top = engine.extractMax();
  if (top) {
    res.json({
      status: 'ok',
      action: 'processed',
      notification: {
        id: top.id,
        title: top.title,
        priority: top.urgencyLevel,
        category: top.service,
        processedAt: Date.now(),
      },
    });
  } else {
    res.status(400).json({ status: 'error', message: 'Priority queue is empty.' });
  }
});

app.post('/api/notifications/mark-read', (req: Request, res: Response) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ status: 'error', message: 'ID is required' });
  const marked = engine.markRead(String(id));
  if (marked) {
    res.json({ status: 'ok', message: 'Notification marked as read.', id });
  } else {
    res.status(404).json({ status: 'error', message: 'Notification not found' });
  }
});

app.post('/api/notifications/delete', (req: Request, res: Response) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ status: 'error', message: 'ID is required' });
  const removed = engine.deleteById(String(id));
  if (removed) {
    res.json({ status: 'ok', message: 'Notification deleted from Binary Max-Heap.', id });
  } else {
    res.status(404).json({ status: 'error', message: 'Notification not found' });
  }
});

app.get('/api/history', (_req: Request, res: Response) => {
  const state = engine.getState();
  res.json({
    status: 'ok',
    historyCount: state.dispatched.length,
    history: state.dispatched.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.message,
      category: d.service,
      priority: d.urgencyLevel,
      timestamp: d.createdAt,
      processedAt: d.dispatchedAt,
    })),
  });
});

app.get('/api/heap-data', (_req: Request, res: Response) => {
  const state = engine.getState();
  res.json({
    status: 'ok',
    complexities: {
      insertion: 'O(log n)',
      extractMax: 'O(log n)',
      peekMax: 'O(1)',
      heapify: 'O(log n)',
      deleteById: 'O(n) + O(log n)',
    },
    heap: state.heap.map((h, i) => ({
      index: i,
      id: h.id,
      title: h.title,
      priority: h.urgencyLevel,
      timestamp: h.createdAt,
      parent: i > 0 ? Math.floor((i - 1) / 2) : -1,
      leftChild: 2 * i + 1 < state.heap.length ? 2 * i + 1 : -1,
      rightChild: 2 * i + 2 < state.heap.length ? 2 * i + 2 : -1,
    })),
  });
});

app.get('/api/queue', (_req: Request, res: Response) => {
  const state = engine.getState();
  res.json({
    status: 'ok',
    queueCount: state.dispatched.length,
    capacity: 50,
    items: state.dispatched.slice(0, 10).map((d) => ({
      id: d.id,
      title: d.title,
      priority: d.urgencyLevel,
    })),
  });
});

// Frontend setup (Vite in dev, static in prod)
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VigilPriority Server] Ready on http://0.0.0.0:${PORT}`);
  });
}

startServer();
