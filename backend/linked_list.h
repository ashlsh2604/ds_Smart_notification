/**
 * Priority-Based Notification Management System
 * Data Structure: Singly Linked List for Processed History
 * File: backend/linked_list.h
 *
 * Demonstrates:
 * - Dynamic memory allocation using malloc/free for nodes.
 * - Insertion at the head for O(1) recent history tracking.
 * - Linear traversal for displaying or persisting history.
 */

#ifndef LINKED_LIST_H
#define LINKED_LIST_H

#include "priority_queue.h"

/**
 * Singly Linked List Node
 */
typedef struct HistoryNode {
    Notification data;
    long long processed_at;
    struct HistoryNode* next;
} HistoryNode;

/**
 * Linked List Container
 */
typedef struct {
    HistoryNode* head;
    int count;
} HistoryList;

/* Function Declarations */
void list_init(HistoryList* list);
int list_add(HistoryList* list, Notification item, long long processed_at);
void list_clear(HistoryList* list);
void list_free(HistoryList* list);

#endif /* LINKED_LIST_H */
