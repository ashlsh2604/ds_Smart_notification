# Priority-Based Notification Management System
**College-Level Data Structures & Algorithms Mini-Project**

---

## 1. Project Objective & Overview

In high-throughput computer systems, operating systems, and distributed platforms, alerts and notifications cannot be processed in simple first-come-first-served (FCFS) order. Critical infrastructure failures (such as database outages or security breaches) must take precedence over routine informational updates.

The **Priority-Based Notification Management System** demonstrates the practical application of fundamental Data Structures in C to organize, prioritize, and dispatch notifications based on urgency levels:
- **Priority 4: Critical** (Dispatched with highest precedence)
- **Priority 3: High**
- **Priority 2: Medium**
- **Priority 1: Low** (Dispatched when higher queues are clear)

Unlike simple CRUD applications that rely on built-in language sorting or database queries, this system implements all underlying data structures **manually in ANSI C** from first principles:
1. **Binary Max-Heap** for the Priority Queue.
2. **Circular Queue** for the FIFO dispatch pipeline.
3. **Singly Linked List** for dynamic processing history.
4. **File Handling in C** for zero-dependency record persistence.

---

## 2. System Architecture & Communication Flow

```
+-----------------------------------------------------------------------+
|                        FRONTEND CLIENT (Web)                          |
|   HTML5 + CSS3 + Vanilla JavaScript (Responsive Engineering Dashboard) |
|   - Login / Signup Authentication Screen                              |
|   - Priority Dispatch Controller & Add Notification Form              |
|   - Interactive SVG Binary Max-Heap Tree & Array Memory Strip         |
|   - FIFO Stage Queue Strip & Linked List History Table                |
+-----------------------------------------------------------------------+
                                   ▲
                                   │ HTTP 1.1 / JSON (Port 3000)
                                   ▼
+-----------------------------------------------------------------------+
|                         C BACKEND SERVER                              |
|   Pure C HTTP Server (Sockets: POSIX / WinSock2 on Windows)           |
|                                                                       |
|   [1] BINARY MAX-HEAP (priority_queue.c)                              |
|       - Complete binary tree in dynamic array                         |
|       - Heapify-Up & Heapify-Down O(log n)                            |
|       - FIFO Tie-Breaking by Timestamp                                |
|                                                                       |
|   [2] CIRCULAR FIFO QUEUE (queue.c)                                   |
|       - Modulo pointer arithmetic: (rear + 1) % CAPACITY              |
|       - First-In, First-Out comparison pipeline                       |
|                                                                       |
|   [3] SINGLY LINKED LIST (linked_list.c)                              |
|       - Dynamic memory nodes (malloc / free)                          |
|       - Head insertion O(1) for chronological history                 |
|                                                                       |
|   [4] FILE STORAGE (storage.c)                                        |
|       - Text file persistence in data/ directory                      |
+-----------------------------------------------------------------------+
                                   ▲
                                   │ File I/O (fopen, fprintf, fgets)
                                   ▼
+-----------------------------------------------------------------------+
|                          LOCAL STORAGE (data/)                        |
|   data/users.txt                  -> User accounts & credentials      |
|   data/notifications_<user>.txt   -> Active heap records              |
|   data/history_<user>.txt         -> Processed linked list records    |
+-----------------------------------------------------------------------+
```

### Communication Protocol
- The C backend operates a lightweight, native HTTP server on **port 3000**.
- The frontend initiates standard HTTP `GET`, `POST`, and `DELETE` requests with JSON payloads.
- Responses return structured JSON, and static assets (`frontend/index.html`, `frontend/style.css`, `frontend/script.js`) are served directly by the C server.

---

## 3. Data Structures Implementation Details

### A. Priority Queue using Binary Max-Heap (`backend/priority_queue.c`)
- **Structure Definition**:
  ```c
  typedef struct {
      int id;
      char title[128];
      char description[256];
      char category[64];
      int priority;               /* 1 (Low) to 4 (Critical) */
      long long timestamp;        /* Milliseconds epoch */
      char status[32];            /* "pending" or "read" */
      char username[64];
  } Notification;

  typedef struct {
      Notification* items;        /* Dynamic contiguous array */
      int size;
      int capacity;
  } MaxHeap;
  ```
- **Array-Based Tree Indexing**:
  - Left Child: $\text{left}(i) = 2i + 1$
  - Right Child: $\text{right}(i) = 2i + 2$
  - Parent: $\text{parent}(i) = \lfloor (i - 1) / 2 \rfloor$
- **Invariants**:
  - $\text{Priority}(\text{parent}) \ge \text{Priority}(\text{child})$
- **Equal-Priority FIFO Tie-Breaker**:
  If two notifications have identical priority levels, the comparator checks their timestamps:
  ```c
  if (a->priority != b->priority) {
      return a->priority - b->priority;
  }
  /* Older timestamp wins (higher precedence) */
  return (a->timestamp < b->timestamp) ? 1 : -1;
  ```

### B. Circular FIFO Queue (`backend/queue.c`)
- **Structure**:
  ```c
  typedef struct {
      Notification items[FIFO_QUEUE_CAPACITY];
      int front;
      int rear;
      int count;
  } FifoQueue;
  ```
- **Concept Difference**:
  - In a standard Queue, elements are serviced strictly in the order they arrived (FIFO).
  - In a Priority Queue, elements jump ahead in the line if their priority is higher.
  - This project demonstrates both: notifications enter the Priority Queue first; when processed, they are staged into the FIFO queue for simulated dispatch.

### C. Singly Linked List for Processed History (`backend/linked_list.c`)
- **Structure**:
  ```c
  typedef struct HistoryNode {
      Notification data;
      long long processed_at;
      struct HistoryNode* next;
  } HistoryNode;

  typedef struct {
      HistoryNode* head;
      int count;
  } HistoryList;
  ```
- **Head Insertion ($O(1)$)**: New processed notifications are inserted at the head pointer, ensuring reverse-chronological traversal without needing an array shift.

### D. File Handling Persistence (`backend/storage.c`)
- Standard C file I/O (`fopen`, `fprintf`, `fgets`, `fclose`) handles record saving and restoration.
- Records are stored as pipe-delimited text (`data/notifications_<username>.txt` and `data/history_<username>.txt`).
- When the application starts, data files are parsed, rebuilding the in-memory Max-Heap and History Linked List.

---

## 4. Time Complexity Analysis

| Operation | Target Data Structure | Time Complexity | Auxiliary Space |
| :--- | :--- | :---: | :---: |
| **Insert Notification** | Binary Max-Heap (`heapify_up`) | $O(\log n)$ | $O(1)$ |
| **Extract Max (Process)** | Binary Max-Heap (`heapify_down`) | $O(\log n)$ | $O(1)$ |
| **Peek Highest Priority** | Binary Max-Heap (Root inspection) | $O(1)$ | $O(1)$ |
| **Delete Arbitrary Node** | Heap Search + Heapify | $O(n) + O(\log n)$ | $O(1)$ |
| **FIFO Enqueue / Dequeue** | Circular Queue | $O(1)$ | $O(1)$ |
| **Record History Entry** | Singly Linked List (Head Insert) | $O(1)$ | $O(1)$ |
| **History Traversal** | Singly Linked List | $O(n)$ | $O(1)$ |

---

## 5. Project Directory Structure

```
├── backend/
│   ├── main.c              # HTTP Web Server & API route handler
│   ├── priority_queue.h    # Binary Max-Heap declarations & structs
│   ├── priority_queue.c    # Heapify-up, heapify-down, insert, extract
│   ├── queue.h             # Circular FIFO Queue declarations
│   ├── queue.c             # Enqueue, dequeue, circular index math
│   ├── linked_list.h       # Singly Linked List history declarations
│   ├── linked_list.c       # Node allocation, head insert, traversal
│   ├── storage.h           # File handling persistence header
│   └── storage.c           # File reading, writing, credentials hash
├── frontend/
│   ├── index.html          # HTML dashboard and login markup
│   ├── style.css           # Clean, responsive CSS styling
│   └── script.js           # Frontend logic, fetch API, SVG heap tree
├── data/                   # Auto-created directory for persistent files
│   ├── users.txt
│   ├── notifications_student.txt
│   └── history_student.txt
├── README.md               # Project documentation and setup guide
└── package.json            # Development runner configuration
```

---

## 6. How to Compile and Run on Windows (PowerShell)

### Prerequisites
- Install **GCC for Windows** (via [MinGW-w64](https://www.mingw-w64.org/), MSYS2, or w64devkit).
- Verify GCC is available by running:
  ```powershell
  gcc --version
  ```

### Step-by-Step Windows Execution
1. **Open Windows PowerShell** and navigate to the project directory:
   ```powershell
   cd path\to\project
   ```

2. **Compile the C backend** using GCC (linking `-lws2_32` for Windows WinSock sockets):
   ```powershell
   gcc backend/priority_queue.c backend/queue.c backend/linked_list.c backend/storage.c backend/main.c -o server.exe -lws2_32
   ```

3. **Run the compiled executable**:
   ```powershell
   .\server.exe
   ```

4. **Open your web browser**:
   Navigate to:
   ```
   http://localhost:3000
   ```

5. **Log in**:
   - Username: `student`
   - Password: `password123`
   *(Or click "Sign Up" to create a new user account).*

---

## 7. How to Compile and Run on Linux / macOS

```bash
# 1. Compile with GCC or Clang
gcc -Wall -Wextra backend/priority_queue.c backend/queue.c backend/linked_list.c backend/storage.c backend/main.c -o server

# 2. Run the server
./server

# 3. Access in browser
http://localhost:3000
```

---

## 8. Demonstration Test Cases

### Test Case 1: Priority Ordering Verification
- **Objective**: Verify that notifications with higher priority preempt lower priority items.
- **Steps**:
  1. Add Notification A with **Priority 1 (Low)**: "Daily Log Archival".
  2. Add Notification B with **Priority 2 (Medium)**: "Disk Utilization at 75%".
  3. Add Notification C with **Priority 4 (Critical)**: "Firewall Breach Detected".
- **Expected Outcome**:
  - The Binary Max-Heap places **Notification C (Critical, P4)** at the root position `items[0]`.
  - When clicking **"Process Next Notification"**, Notification C is extracted first, despite having been inserted last.

### Test Case 2: Equal-Priority FIFO Tie-Breaker
- **Objective**: Verify that two notifications with the same priority are processed in FIFO order.
- **Steps**:
  1. Add Notification X with **Priority 3 (High)** at 10:00:00: "API Latency Warning".
  2. Add Notification Y with **Priority 3 (High)** at 10:00:05: "Payment Timeout Warning".
- **Expected Outcome**:
  - Both have priority 3.
  - Notification X has an earlier timestamp than Y.
  - The comparator places Notification X ahead of Y.
  - Clicking **"Process Next Notification"** processes Notification X before Notification Y.

### Test Case 3: Empty Heap Handling (Underflow Protection)
- **Objective**: Ensure the system handles an empty priority queue gracefully without crashing.
- **Steps**:
  1. Process all active notifications until the pending list is empty.
  2. Click **"Process Next Notification"** again.
- **Expected Outcome**:
  - The C backend returns HTTP 400 with message `"Priority queue is empty. No notifications to process."`
  - The dashboard displays a clear warning banner. No segmentation fault or memory corruption occurs.

### Test Case 4: File Persistence Recovery after Restart
- **Objective**: Verify that pending and processed items persist across server reboots.
- **Steps**:
  1. Log in as `student` and add 3 notifications.
  2. Process 1 notification.
  3. Stop the backend server process (`Ctrl + C` in PowerShell).
  4. Restart the server (`.\server.exe`).
  5. Refresh the browser at `http://localhost:3000`.
- **Expected Outcome**:
  - The 2 pending notifications are reloaded into the Max-Heap.
  - The 1 processed notification is reloaded into the History Linked List.
  - Counters match the state before shutdown.

---

## 9. Academic Credentials & Notice
- **Course**: CS Data Structures and Algorithms Mini-Project.
- **Authentication Note**: User accounts are validated via lightweight hashed credentials in `data/users.txt` designed for standalone student demonstration without complex external dependencies.
