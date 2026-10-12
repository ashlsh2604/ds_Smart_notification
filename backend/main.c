/**
 * Priority-Based Notification Management System
 * Backend HTTP Server and REST API in Pure C
 * File: backend/main.c
 *
 * Implements:
 * - Native cross-platform HTTP 1.1 Web Server (Linux / POSIX & Windows MinGW).
 * - Serves frontend static assets (HTML, CSS, JavaScript).
 * - Demonstrates Data Structures in action:
 *     1. Binary Max-Heap (Priority Queue) with FIFO tie-breaking.
 *     2. Circular Queue (FIFO Queue) for dispatched notifications.
 *     3. Singly Linked List for processed notification history.
 *     4. File Handling in data/ for zero-dependency persistence.
 */

#include "priority_queue.h"
#include "queue.h"
#include "linked_list.h"
#include "storage.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
typedef int socklen_t;
#define CLOSE_SOCKET(s) closesocket(s)
#else
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#define CLOSE_SOCKET(s) close(s)
#define SOCKET int
#define INVALID_SOCKET -1
#define SOCKET_ERROR -1
#endif

#define PORT 3000
#define BUFFER_SIZE 65536

/* Active in-memory state */
static char g_current_user[MAX_USER_LEN] = "student";
static MaxHeap g_heap;
static FifoQueue g_fifo_queue;
static HistoryList g_history;
static int g_next_id = 101;

/* Current time helper in ms */
static long long current_time_ms(void) {
    struct timespec ts;
    clock_gettime(CLOCK_REALTIME, &ts);
    return ((long long)ts.tv_sec * 1000LL) + ((long long)ts.tv_nsec / 1000000LL);
}

/* Helper to safely extract a JSON string field value */
static int get_json_string(const char* json, const char* key, char* out, size_t max_len) {
    char pattern[128];
    snprintf(pattern, sizeof(pattern), "\"%s\"", key);
    const char* pos = strstr(json, pattern);
    if (!pos) return 0;

    pos += strlen(pattern);
    while (*pos == ' ' || *pos == ':' || *pos == '\t' || *pos == '\r' || *pos == '\n') pos++;
    if (*pos != '"') return 0;
    pos++; /* skip open quote */

    size_t i = 0;
    while (*pos && *pos != '"' && i < max_len - 1) {
        if (*pos == '\\' && *(pos + 1)) {
            pos++; /* basic escape */
        }
        out[i++] = *pos++;
    }
    out[i] = '\0';
    return 1;
}

/* Helper to safely extract a JSON integer field value */
static int get_json_int(const char* json, const char* key, int* out) {
    char pattern[128];
    snprintf(pattern, sizeof(pattern), "\"%s\"", key);
    const char* pos = strstr(json, pattern);
    if (!pos) return 0;

    pos += strlen(pattern);
    while (*pos == ' ' || *pos == ':' || *pos == '\t' || *pos == '\r' || *pos == '\n') pos++;
    *out = atoi(pos);
    return 1;
}

/* Send HTTP Response */
static void send_response(SOCKET client, int status_code, const char* content_type, const char* body) {
    char header[1024];
    size_t body_len = body ? strlen(body) : 0;
    const char* status_text = (status_code == 200) ? "OK" :
                              (status_code == 201) ? "Created" :
                              (status_code == 400) ? "Bad Request" :
                              (status_code == 401) ? "Unauthorized" :
                              (status_code == 404) ? "Not Found" : "Internal Server Error";

    snprintf(header, sizeof(header),
             "HTTP/1.1 %d %s\r\n"
             "Content-Type: %s\r\n"
             "Content-Length: %zu\r\n"
             "Access-Control-Allow-Origin: *\r\n"
             "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS\r\n"
             "Access-Control-Allow-Headers: Content-Type\r\n"
             "Connection: close\r\n\r\n",
             status_code, status_text, content_type, body_len);

    send(client, header, (int)strlen(header), 0);
    if (body_len > 0) {
        send(client, body, (int)body_len, 0);
    }
}

/* Serve Static File from filesystem */
static void serve_file(SOCKET client, const char* filepath, const char* content_type) {
    FILE* fp = fopen(filepath, "rb");
    if (!fp) {
        send_response(client, 404, "text/plain", "404 Not Found");
        return;
    }

    fseek(fp, 0, SEEK_END);
    long fsize = ftell(fp);
    fseek(fp, 0, SEEK_SET);

    char* buffer = (char*)malloc(fsize + 1);
    if (!buffer) {
        fclose(fp);
        send_response(client, 500, "text/plain", "500 Out of Memory");
        return;
    }

    size_t read_bytes = fread(buffer, 1, fsize, fp);
    fclose(fp);
    buffer[read_bytes] = '\0';

    send_response(client, 200, content_type, buffer);
    free(buffer);
}

/* Seed sample data for student demo */
static void seed_sample_notifications(const char* username) {
    long long now = current_time_ms();
    Notification samples[5] = {
        {
            g_next_id++,
            "Server CPU Spike > 95%",
            "Production database node CPU utilization sustained over threshold.",
            "System",
            PRIORITY_CRITICAL,
            now - 300000, /* 5 mins ago */
            "pending",
            ""
        },
        {
            g_next_id++,
            "Payment Gateway Webhook Timeout",
            "Third-party payment processor webhook taking > 4,000ms to respond.",
            "Finance",
            PRIORITY_HIGH,
            now - 180000, /* 3 mins ago */
            "pending",
            ""
        },
        {
            g_next_id++,
            "Database Read Replica Lag Warning",
            "Secondary replica WAL lag exceeded 12 seconds in us-east-1.",
            "Database",
            PRIORITY_HIGH,
            now - 60000, /* 1 min ago (later than payment timeout, so tie-break puts payment first) */
            "pending",
            ""
        },
        {
            g_next_id++,
            "Disk Space Usage Exceeded 75%",
            "Log partition /var/log reached warning capacity threshold.",
            "Storage",
            PRIORITY_MEDIUM,
            now - 450000,
            "pending",
            ""
        },
        {
            g_next_id++,
            "Weekly Database Backup Completed",
            "Automated cold storage backup snapshot uploaded to object store.",
            "Routine",
            PRIORITY_LOW,
            now - 600000,
            "pending",
            ""
        }
    };

    for (int i = 0; i < 5; i++) {
        strncpy(samples[i].username, username, MAX_USER_LEN - 1);
        heap_insert(&g_heap, samples[i]);
    }
    storage_save_notifications(username, &g_heap);
}

/* Handle HTTP Requests */
static void handle_client(SOCKET client) {
    char buffer[BUFFER_SIZE];
    int bytes_received = recv(client, buffer, sizeof(buffer) - 1, 0);
    if (bytes_received <= 0) {
        CLOSE_SOCKET(client);
        return;
    }
    buffer[bytes_received] = '\0';

    char method[16] = {0};
    char uri[256] = {0};
    sscanf(buffer, "%15s %255s", method, uri);

    /* Handle CORS preflight */
    if (strcmp(method, "OPTIONS") == 0) {
        send_response(client, 200, "text/plain", "OK");
        CLOSE_SOCKET(client);
        return;
    }

    /* Locate HTTP body */
    char* body = strstr(buffer, "\r\n\r\n");
    if (body) body += 4;
    else body = "";

    /* Query param parsing for username */
    char req_user[MAX_USER_LEN] = {0};
    char* q = strstr(uri, "username=");
    if (q) {
        q += 9;
        int i = 0;
        while (*q && *q != '&' && *q != ' ' && i < MAX_USER_LEN - 1) {
            req_user[i++] = *q++;
        }
        req_user[i] = '\0';
    } else {
        snprintf(req_user, sizeof(req_user), "%s", g_current_user);
    }

    /* --- ROUTE DISPATCH --- */

    /* 1. Static Files */
    if (strcmp(uri, "/") == 0 || strcmp(uri, "/index.html") == 0 || strcmp(uri, "/frontend/index.html") == 0) {
        serve_file(client, "frontend/index.html", "text/html; charset=utf-8");
    } else if (strcmp(uri, "/style.css") == 0 || strcmp(uri, "/frontend/style.css") == 0) {
        serve_file(client, "frontend/style.css", "text/css; charset=utf-8");
    } else if (strcmp(uri, "/script.js") == 0 || strcmp(uri, "/frontend/script.js") == 0) {
        serve_file(client, "frontend/script.js", "application/javascript; charset=utf-8");
    }
    /* 2. Authentication: Signup */
    else if (strcmp(uri, "/api/signup") == 0 && strcmp(method, "POST") == 0) {
        char username[MAX_USER_LEN] = {0};
        char password[MAX_USER_LEN] = {0};
        get_json_string(body, "username", username, sizeof(username));
        get_json_string(body, "password", password, sizeof(password));

        if (strlen(username) < 3 || strlen(password) < 4) {
            send_response(client, 400, "application/json",
                          "{\"status\":\"error\",\"message\":\"Username must be at least 3 chars, password at least 4 chars.\"}");
        } else if (storage_user_signup(username, password)) {
            send_response(client, 201, "application/json",
                          "{\"status\":\"ok\",\"message\":\"Account created successfully.\"}");
        } else {
            send_response(client, 400, "application/json",
                          "{\"status\":\"error\",\"message\":\"Username already exists. Please choose another.\"}");
        }
    }
    /* 3. Authentication: Login */
    else if (strcmp(uri, "/api/login") == 0 && strcmp(method, "POST") == 0) {
        char username[MAX_USER_LEN] = {0};
        char password[MAX_USER_LEN] = {0};
        get_json_string(body, "username", username, sizeof(username));
        get_json_string(body, "password", password, sizeof(password));

        if (storage_user_login(username, password)) {
            snprintf(g_current_user, sizeof(g_current_user), "%s", username);
            storage_load_notifications(username, &g_heap, &g_next_id);
            storage_load_history(username, &g_history);
            char resp[256];
            snprintf(resp, sizeof(resp), "{\"status\":\"ok\",\"message\":\"Login successful.\",\"username\":\"%s\"}", username);
            send_response(client, 200, "application/json", resp);
        } else {
            send_response(client, 401, "application/json",
                          "{\"status\":\"error\",\"message\":\"Invalid username or password.\"}");
        }
    }
    /* 4. Get Notifications and Dashboard Metrics */
    else if (strncmp(uri, "/api/notifications", 18) == 0 && strcmp(method, "GET") == 0) {
        /* Ensure user data is loaded */
        if (strlen(req_user) > 0 && strcmp(req_user, g_current_user) != 0) {
            snprintf(g_current_user, sizeof(g_current_user), "%s", req_user);
            storage_load_notifications(g_current_user, &g_heap, &g_next_id);
            storage_load_history(g_current_user, &g_history);
        }

        /* Calculate metrics */
        int total_pending = g_heap.size;
        int total_processed = g_history.count;
        int critical_count = 0;
        for (int i = 0; i < g_heap.size; i++) {
            if (g_heap.items[i].priority == PRIORITY_CRITICAL) {
                critical_count++;
            }
        }
        int total_notifications = total_pending + total_processed;

        /* Build JSON response with pending items in array order and preview order */
        char* resp = (char*)malloc(BUFFER_SIZE);
        if (!resp) {
            send_response(client, 500, "text/plain", "Out of Memory");
            CLOSE_SOCKET(client);
            return;
        }

        int offset = snprintf(resp, BUFFER_SIZE,
            "{\"status\":\"ok\",\"user\":\"%s\","
            "\"stats\":{"
            "\"total\":%d,"
            "\"pending\":%d,"
            "\"processed\":%d,"
            "\"critical\":%d"
            "},"
            "\"heapSize\":%d,"
            "\"heapCapacity\":%d,"
            "\"notifications\":[",
            g_current_user, total_notifications, total_pending, total_processed, critical_count,
            g_heap.size, g_heap.capacity);

        for (int i = 0; i < g_heap.size; i++) {
            Notification* n = &g_heap.items[i];
            if (i > 0) offset += snprintf(resp + offset, BUFFER_SIZE - offset, ",");
            offset += snprintf(resp + offset, BUFFER_SIZE - offset,
                "{"
                "\"id\":%d,"
                "\"title\":\"%s\","
                "\"description\":\"%s\","
                "\"category\":\"%s\","
                "\"priority\":%d,"
                "\"timestamp\":%lld,"
                "\"status\":\"%s\","
                "\"heapIndex\":%d"
                "}",
                n->id, n->title, n->description, n->category, n->priority, n->timestamp, n->status, i);
        }

        offset += snprintf(resp + offset, BUFFER_SIZE - offset, "]}");
        send_response(client, 200, "application/json", resp);
        free(resp);
    }
    /* 5. Add New Notification */
    else if (strcmp(uri, "/api/notifications") == 0 && strcmp(method, "POST") == 0) {
        char username[MAX_USER_LEN] = {0};
        char title[MAX_TITLE_LEN] = {0};
        char description[MAX_DESC_LEN] = {0};
        char category[MAX_CAT_LEN] = {0};
        int priority = 2;

        get_json_string(body, "username", username, sizeof(username));
        get_json_string(body, "title", title, sizeof(title));
        get_json_string(body, "description", description, sizeof(description));
        get_json_string(body, "category", category, sizeof(category));
        get_json_int(body, "priority", &priority);

        if (strlen(username) == 0) snprintf(username, sizeof(username), "%s", g_current_user);
        if (priority < 1) priority = 1;
        if (priority > 4) priority = 4;

        if (strlen(title) == 0) {
            send_response(client, 400, "application/json",
                          "{\"status\":\"error\",\"message\":\"Title is required.\"}");
        } else {
            Notification n;
            memset(&n, 0, sizeof(Notification));
            n.id = g_next_id++;
            snprintf(n.title, sizeof(n.title), "%s", title);
            snprintf(n.description, sizeof(n.description), "%s", description);
            snprintf(n.category, sizeof(n.category), "%s", strlen(category) > 0 ? category : "General");
            n.priority = priority;
            n.timestamp = current_time_ms();
            snprintf(n.status, sizeof(n.status), "pending");
            snprintf(n.username, sizeof(n.username), "%s", username);

            /* Insert into Binary Max-Heap */
            heap_insert(&g_heap, n);
            storage_save_notifications(username, &g_heap);

            char resp[256];
            snprintf(resp, sizeof(resp),
                     "{\"status\":\"ok\",\"action\":\"enqueued\",\"id\":%d,\"priority\":%d}",
                     n.id, n.priority);
            send_response(client, 201, "application/json", resp);
        }
    }
    /* 6. Process Next Notification (Extract Max from Max-Heap) */
    else if (strcmp(uri, "/api/notifications/process") == 0 && strcmp(method, "POST") == 0) {
        char username[MAX_USER_LEN] = {0};
        get_json_string(body, "username", username, sizeof(username));
        if (strlen(username) == 0) snprintf(username, sizeof(username), "%s", g_current_user);

        Notification top;
        if (heap_extract_max(&g_heap, &top)) {
            long long proc_time = current_time_ms();
            snprintf(top.status, sizeof(top.status), "processed");

            /* Add to Linked List History (O(1) insertion at head) */
            list_add(&g_history, top, proc_time);

            /* Also enqueue into FIFO queue to demonstrate standard queue processing */
            fifo_enqueue(&g_fifo_queue, top);

            /* Persist updated heap and history */
            storage_save_notifications(username, &g_heap);
            storage_save_history(username, &g_history);

            char resp[512];
            snprintf(resp, sizeof(resp),
                     "{\"status\":\"ok\",\"action\":\"processed\","
                     "\"notification\":{"
                     "\"id\":%d,\"title\":\"%s\",\"priority\":%d,"
                     "\"category\":\"%s\",\"processedAt\":%lld"
                     "}}",
                     top.id, top.title, top.priority, top.category, proc_time);
            send_response(client, 200, "application/json", resp);
        } else {
            send_response(client, 400, "application/json",
                          "{\"status\":\"error\",\"message\":\"Priority queue is empty. No notifications to process.\"}");
        }
    }
    /* 7. Mark as Read */
    else if (strcmp(uri, "/api/notifications/mark-read") == 0 && strcmp(method, "POST") == 0) {
        char username[MAX_USER_LEN] = {0};
        int id = 0;
        get_json_string(body, "username", username, sizeof(username));
        get_json_int(body, "id", &id);
        if (strlen(username) == 0) snprintf(username, sizeof(username), "%s", g_current_user);

        if (heap_mark_read(&g_heap, id)) {
            storage_save_notifications(username, &g_heap);
            send_response(client, 200, "application/json", "{\"status\":\"ok\",\"action\":\"marked_read\"}");
        } else {
            send_response(client, 404, "application/json", "{\"status\":\"error\",\"message\":\"Notification not found.\"}");
        }
    }
    /* 8. Delete Notification */
    else if ((strcmp(uri, "/api/notifications/delete") == 0 && strcmp(method, "POST") == 0) ||
             (strncmp(uri, "/api/notifications/", 19) == 0 && strcmp(method, "DELETE") == 0)) {
        char username[MAX_USER_LEN] = {0};
        int id = 0;
        get_json_string(body, "username", username, sizeof(username));
        get_json_int(body, "id", &id);
        if (id == 0 && strncmp(uri, "/api/notifications/", 19) == 0) {
            id = atoi(uri + 19);
        }
        if (strlen(username) == 0) snprintf(username, sizeof(username), "%s", g_current_user);

        if (heap_delete_by_id(&g_heap, id)) {
            storage_save_notifications(username, &g_heap);
            send_response(client, 200, "application/json", "{\"status\":\"ok\",\"action\":\"deleted\"}");
        } else {
            send_response(client, 404, "application/json", "{\"status\":\"error\",\"message\":\"Notification not found.\"}");
        }
    }
    /* 9. Notification History (Linked List Traversal) */
    else if (strncmp(uri, "/api/history", 12) == 0 && strcmp(method, "GET") == 0) {
        char* resp = (char*)malloc(BUFFER_SIZE);
        if (!resp) {
            send_response(client, 500, "text/plain", "Out of Memory");
            CLOSE_SOCKET(client);
            return;
        }

        int offset = snprintf(resp, BUFFER_SIZE, "{\"status\":\"ok\",\"historyCount\":%d,\"history\":[", g_history.count);
        HistoryNode* cur = g_history.head;
        int i = 0;
        while (cur != NULL) {
            if (i > 0) offset += snprintf(resp + offset, BUFFER_SIZE - offset, ",");
            offset += snprintf(resp + offset, BUFFER_SIZE - offset,
                "{"
                "\"id\":%d,"
                "\"title\":\"%s\","
                "\"description\":\"%s\","
                "\"category\":\"%s\","
                "\"priority\":%d,"
                "\"timestamp\":%lld,"
                "\"processedAt\":%lld"
                "}",
                cur->data.id, cur->data.title, cur->data.description,
                cur->data.category, cur->data.priority, cur->data.timestamp, cur->processed_at);
            cur = cur->next;
            i++;
        }
        offset += snprintf(resp + offset, BUFFER_SIZE - offset, "]}");
        send_response(client, 200, "application/json", resp);
        free(resp);
    }
    /* 10. Heap Tree Structure & Data Structure Complexity Info */
    else if (strncmp(uri, "/api/heap-data", 14) == 0 && strcmp(method, "GET") == 0) {
        char* resp = (char*)malloc(BUFFER_SIZE);
        if (!resp) {
            send_response(client, 500, "text/plain", "Out of memory");
            CLOSE_SOCKET(client);
            return;
        }

        int offset = snprintf(resp, BUFFER_SIZE,
            "{\"status\":\"ok\","
            "\"complexities\":{"
            "\"insertion\":\"O(log n)\","
            "\"extractMax\":\"O(log n)\","
            "\"peekMax\":\"O(1)\","
            "\"heapify\":\"O(log n)\","
            "\"deleteById\":\"O(n) + O(log n)\""
            "},"
            "\"heap\":[");

        for (int i = 0; i < g_heap.size; i++) {
            Notification* n = &g_heap.items[i];
            int parent = (i > 0) ? (i - 1) / 2 : -1;
            int left = (2 * i + 1 < g_heap.size) ? 2 * i + 1 : -1;
            int right = (2 * i + 2 < g_heap.size) ? 2 * i + 2 : -1;

            if (i > 0) offset += snprintf(resp + offset, BUFFER_SIZE - offset, ",");
            offset += snprintf(resp + offset, BUFFER_SIZE - offset,
                "{"
                "\"index\":%d,"
                "\"id\":%d,"
                "\"title\":\"%s\","
                "\"priority\":%d,"
                "\"timestamp\":%lld,"
                "\"parent\":%d,"
                "\"leftChild\":%d,"
                "\"rightChild\":%d"
                "}",
                i, n->id, n->title, n->priority, n->timestamp, parent, left, right);
        }

        offset += snprintf(resp + offset, BUFFER_SIZE - offset, "]}");
        send_response(client, 200, "application/json", resp);
        free(resp);
    }
    /* 11. FIFO Queue Inspection & Dequeue */
    else if (strcmp(uri, "/api/queue") == 0 && strcmp(method, "GET") == 0) {
        char resp[4096];
        int offset = snprintf(resp, sizeof(resp),
            "{\"status\":\"ok\",\"queueCount\":%d,\"capacity\":%d,\"items\":[",
            g_fifo_queue.count, FIFO_QUEUE_CAPACITY);

        int idx = g_fifo_queue.front;
        for (int i = 0; i < g_fifo_queue.count; i++) {
            Notification* n = &g_fifo_queue.items[idx];
            if (i > 0) offset += snprintf(resp + offset, sizeof(resp) - offset, ",");
            offset += snprintf(resp + offset, sizeof(resp) - offset,
                "{\"id\":%d,\"title\":\"%s\",\"priority\":%d}", n->id, n->title, n->priority);
            idx = (idx + 1) % FIFO_QUEUE_CAPACITY;
        }
        offset += snprintf(resp + offset, sizeof(resp) - offset, "]}");
        send_response(client, 200, "application/json", resp);
    }
    /* 12. Seed Sample Data */
    else if (strcmp(uri, "/api/sample-data") == 0 && strcmp(method, "POST") == 0) {
        char username[MAX_USER_LEN] = {0};
        get_json_string(body, "username", username, sizeof(username));
        if (strlen(username) == 0) snprintf(username, sizeof(username), "%s", g_current_user);

        seed_sample_notifications(username);
        send_response(client, 200, "application/json",
                      "{\"status\":\"ok\",\"message\":\"Sample notifications inserted into Max-Heap.\"}");
    }
    /* 13. Default 404 */
    else {
        send_response(client, 404, "text/plain", "Endpoint Not Found");
    }

    CLOSE_SOCKET(client);
}

int main(void) {
    printf("=================================================================\n");
    printf("  PRIORITY-BASED NOTIFICATION MANAGEMENT SYSTEM (C BACKEND)\n");
    printf("=================================================================\n");

#ifdef _WIN32
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        fprintf(stderr, "Fatal: WSAStartup failed on Windows.\n");
        return 1;
    }
    printf("[Info] Windows WinSock 2.2 initialized.\n");
#endif

    /* Initialize Data Structures */
    heap_init(&g_heap, 32);
    fifo_queue_init(&g_fifo_queue);
    list_init(&g_history);
    storage_init();

    /* Pre-create default student user if not existing */
    storage_user_signup("student", "password123");
    storage_load_notifications("student", &g_heap, &g_next_id);
    storage_load_history("student", &g_history);

    /* If heap is empty on initial boot, populate with sample data */
    if (g_heap.size == 0) {
        seed_sample_notifications("student");
    }

    /* Socket setup */
    SOCKET server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd == INVALID_SOCKET) {
        perror("Socket creation failed");
        return 1;
    }

    int opt = 1;
#ifndef _WIN32
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
#endif

    struct sockaddr_in address;
    memset(&address, 0, sizeof(address));
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(PORT);

    if (bind(server_fd, (struct sockaddr*)&address, sizeof(address)) == SOCKET_ERROR) {
        perror("Bind failed on port 3000");
        CLOSE_SOCKET(server_fd);
        return 1;
    }

    if (listen(server_fd, 10) == SOCKET_ERROR) {
        perror("Listen failed");
        CLOSE_SOCKET(server_fd);
        return 1;
    }

    printf("[C-Server] Listening on http://0.0.0.0:%d\n", PORT);
    printf("[C-Server] Data structures initialized: Binary Max-Heap, Circular Queue, Linked List.\n");
    printf("[C-Server] Storage path: data/\n");
    printf("[Ready] Open your browser at http://localhost:3000\n");

    while (1) {
        struct sockaddr_in client_addr;
        socklen_t client_len = sizeof(client_addr);
        SOCKET client_fd = accept(server_fd, (struct sockaddr*)&client_addr, &client_len);
        if (client_fd != INVALID_SOCKET) {
#ifdef _WIN32
            DWORD tv = 3000;
            setsockopt(client_fd, SOL_SOCKET, SO_RCVTIMEO, (const char*)&tv, sizeof(tv));
#else
            struct timeval tv;
            tv.tv_sec = 3;
            tv.tv_usec = 0;
            setsockopt(client_fd, SOL_SOCKET, SO_RCVTIMEO, (const char*)&tv, sizeof(tv));
#endif
            handle_client(client_fd);
        }
    }

    /* Cleanup */
    heap_free(&g_heap);
    list_free(&g_history);
    CLOSE_SOCKET(server_fd);
#ifdef _WIN32
    WSACleanup();
#endif
    return 0;
}
