# Priority-Based Notification Management System (C Backend)

## Project Objective
Develop a notification management system that organises and processes notifications according to their priority using fundamental data structure concepts. The project demonstrates actual data structure implementations in C rather than just being a regular notification CRUD application.

---

## 1. Data Structures Implemented

### A. Binary Max-Heap (Priority Queue)
- **Files**: `priority_queue.h`, `priority_queue.c`
- **Core Principle**: A complete binary tree implemented over a dynamically expanding contiguous array (`Notification items[]`). The parent node's priority is always $\ge$ the priorities of its child nodes.
- **Array Math**:
  - `Left Child Index` = $2 \cdot i + 1$
  - `Right Child Index` = $2 \cdot i + 2$
  - `Parent Index` = $\lfloor (i - 1) / 2 \rfloor$
- **Priority Precedence & Tie-Breaking**:
  - $P4$ (Critical) $>$ $P3$ (High) $>$ $P2$ (Medium) $>$ $P1$ (Low).
  - When two notifications have identical priority levels, the tie is broken **FIFO by timestamp** (older notification has higher precedence).
- **Time Complexity**:
  - Insertion (`heap_insert` + `heapify_up`): **$O(\log n)$**
  - Extract Maximum (`heap_extract_max` + `heapify_down`): **$O(\log n)$**
  - Peek Root (`heap_peek_max`): **$O(1)$**
  - Arbitrary Deletion (`heap_delete_by_id`): **$O(n) + O(\log n)$**

### B. Circular FIFO Queue
- **Files**: `queue.h`, `queue.c`
- **Purpose**: Demonstrates the classic First-In, First-Out queue in contrast with the Priority Queue.
- **Index Wrap**: `rear = (rear + 1) % CAPACITY`
- **Complexity**: Enqueue and Dequeue in **$O(1)$**.

### C. Singly Linked List (Notification History)
- **Files**: `linked_list.h`, `linked_list.c`
- **Purpose**: Dynamic audit log of all processed notifications.
- **Insertion**: Prepend at head in **$O(1)$**.
- **Traversal**: Linear traversal for history listing and disk persistence in **$O(n)$**.

### D. File Handling Persistence (No External DB)
- **Files**: `storage.h`, `storage.c`
- **Location**: `data/` directory
- **Files Stored**:
  - `data/users.txt`: User authentication records.
  - `data/notifications_<username>.txt`: Active heap notification records.
  - `data/history_<username>.txt`: Processed notification history.
- Restores state on application restart.

---

## 2. Compilation and Execution

### Windows (GCC / MinGW / MSYS2 / Dev-C++ / Code::Blocks)
Open Command Prompt or PowerShell in the `backend/` folder:
```cmd
gcc -O2 -Wall -Wextra main.c priority_queue.c queue.c linked_list.c storage.c -o bin/c_notification_server.exe -lws2_32
.\bin\c_notification_server.exe
```

### Linux / macOS
Open terminal in the `backend/` folder:
```bash
make
./bin/c_notification_server
```
The server will listen on `http://127.0.0.1:3000` and directly serve the static frontend from `../frontend/` or communicate with the dashboard over HTTP.
