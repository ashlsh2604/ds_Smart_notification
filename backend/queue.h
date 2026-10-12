/**
 * Priority-Based Notification Management System
 * Data Structure: Standard FIFO Queue (First-In, First-Out)
 * File: backend/queue.h
 *
 * Demonstrates the contrast between:
 * 1. Priority Queue: Serviced strictly by urgency level (highest priority first).
 * 2. Standard FIFO Queue: Serviced strictly by arrival time sequence.
 */

#ifndef QUEUE_H
#define QUEUE_H

#include "priority_queue.h"

#define FIFO_QUEUE_CAPACITY 64

/**
 * Standard Circular FIFO Queue
 */
typedef struct {
    Notification items[FIFO_QUEUE_CAPACITY];
    int front;
    int rear;
    int count;
} FifoQueue;

/* Function Declarations */
void fifo_queue_init(FifoQueue* q);
int fifo_is_empty(const FifoQueue* q);
int fifo_is_full(const FifoQueue* q);
int fifo_enqueue(FifoQueue* q, Notification item);
int fifo_dequeue(FifoQueue* q, Notification* result);
int fifo_peek(const FifoQueue* q, Notification* result);
void fifo_clear(FifoQueue* q);

#endif /* QUEUE_H */
