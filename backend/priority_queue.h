/**
 * Priority-Based Notification Management System
 * Data Structure: Binary Max-Heap (Priority Queue)
 * File: backend/priority_queue.h
 */

#ifndef PRIORITY_QUEUE_H
#define PRIORITY_QUEUE_H

#define MAX_TITLE_LEN 128
#define MAX_DESC_LEN 256
#define MAX_CAT_LEN 64
#define MAX_STATUS_LEN 32
#define MAX_USER_LEN 64

/**
 * Priority Level Definitions:
 * 4: Critical (Processed first)
 * 3: High
 * 2: Medium
 * 1: Low
 */
typedef enum {
    PRIORITY_LOW = 1,
    PRIORITY_MEDIUM = 2,
    PRIORITY_HIGH = 3,
    PRIORITY_CRITICAL = 4
} PriorityLevel;

/**
 * Notification Struct
 */
typedef struct {
    int id;
    char title[MAX_TITLE_LEN];
    char description[MAX_DESC_LEN];
    char category[MAX_CAT_LEN];
    int priority;               /* 1 to 4 */
    long long timestamp;        /* Creation timestamp in milliseconds */
    char status[MAX_STATUS_LEN];/* "pending" or "read" */
    char username[MAX_USER_LEN];/* Per-user isolation */
} Notification;

/**
 * Binary Max-Heap Structure
 */
typedef struct {
    Notification* items;
    int size;
    int capacity;
} MaxHeap;

/* Function Declarations */
void heap_init(MaxHeap* h, int initial_capacity);
void heap_free(MaxHeap* h);
int heap_is_empty(const MaxHeap* h);
int heap_insert(MaxHeap* h, Notification item);
int heap_extract_max(MaxHeap* h, Notification* result);
int heap_peek_max(const MaxHeap* h, Notification* result);
int heap_delete_by_id(MaxHeap* h, int id);
int heap_mark_read(MaxHeap* h, int id);
void heapify_up(MaxHeap* h, int index);
void heapify_down(MaxHeap* h, int index);
int compare_priority(const Notification* a, const Notification* b);
void heap_clear(MaxHeap* h);

#endif /* PRIORITY_QUEUE_H */
