/**
 * Priority-Based Notification Management System
 * Data Structure: Circular FIFO Queue Implementation
 * File: backend/queue.c
 *
 * Concepts:
 * - A standard Queue adheres to the First-In, First-Out (FIFO) principle.
 * - Circular implementation optimizes space by wrapping rear and front pointers
 *   around the fixed buffer using modulo arithmetic:
 *     next_rear  = (rear + 1) % CAPACITY
 *     next_front = (front + 1) % CAPACITY
 *
 * Differences from Priority Queue:
 * - Queue: Inserts at rear, removes from front. Processing order = Arrival order.
 * - Priority Queue: Elements are reordered based on priority keys (Binary Max-Heap).
 *
 * Time Complexities:
 * - Enqueue: O(1)
 * - Dequeue: O(1)
 * - Peek: O(1)
 */

#include "queue.h"
#include <stdio.h>

/**
 * Initializes an empty circular queue.
 */
void fifo_queue_init(FifoQueue* q) {
    q->front = 0;
    q->rear = -1;
    q->count = 0;
}

/**
 * Returns 1 if queue is empty, 0 otherwise.
 */
int fifo_is_empty(const FifoQueue* q) {
    return (q->count == 0);
}

/**
 * Returns 1 if queue is full, 0 otherwise.
 */
int fifo_is_full(const FifoQueue* q) {
    return (q->count == FIFO_QUEUE_CAPACITY);
}

/**
 * Enqueues a notification at the rear of the queue.
 * Time Complexity: O(1)
 */
int fifo_enqueue(FifoQueue* q, Notification item) {
    if (fifo_is_full(q)) {
        return 0; /* Queue overflow */
    }
    q->rear = (q->rear + 1) % FIFO_QUEUE_CAPACITY;
    q->items[q->rear] = item;
    q->count++;
    return 1;
}

/**
 * Dequeues the oldest notification from the front of the queue.
 * Time Complexity: O(1)
 */
int fifo_dequeue(FifoQueue* q, Notification* result) {
    if (fifo_is_empty(q)) {
        return 0; /* Queue underflow */
    }
    *result = q->items[q->front];
    q->front = (q->front + 1) % FIFO_QUEUE_CAPACITY;
    q->count--;
    return 1;
}

/**
 * Peeks at the front notification without removing it.
 * Time Complexity: O(1)
 */
int fifo_peek(const FifoQueue* q, Notification* result) {
    if (fifo_is_empty(q)) {
        return 0;
    }
    *result = q->items[q->front];
    return 1;
}

/**
 * Resets the circular queue to an empty state.
 */
void fifo_clear(FifoQueue* q) {
    q->front = 0;
    q->rear = -1;
    q->count = 0;
}
