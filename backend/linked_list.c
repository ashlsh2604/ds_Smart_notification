/**
 * Priority-Based Notification Management System
 * Data Structure: Singly Linked List Implementation
 * File: backend/linked_list.c
 *
 * Concepts:
 * - Each node in the list stores a processed Notification, a processing timestamp,
 *   and a pointer to the subsequent node.
 * - By inserting new elements at the head of the list, recent history is recorded in O(1)
 *   and traversal naturally presents items from newest to oldest.
 *
 * Time Complexities:
 * - Insert at Head: O(1)
 * - Traversal / Display: O(n)
 * - Clear / Free: O(n)
 */

#include "linked_list.h"
#include <stdio.h>
#include <stdlib.h>

/**
 * Initializes an empty linked list.
 */
void list_init(HistoryList* list) {
    list->head = NULL;
    list->count = 0;
}

/**
 * Inserts a processed notification at the head of the linked list.
 * Time Complexity: O(1)
 */
int list_add(HistoryList* list, Notification item, long long processed_at) {
    HistoryNode* new_node = (HistoryNode*)malloc(sizeof(HistoryNode));
    if (!new_node) {
        fprintf(stderr, "Error: Memory allocation failed for history linked list node.\n");
        return 0;
    }

    new_node->data = item;
    new_node->processed_at = processed_at;
    /* Pointer manipulation: point new node to existing head, then update head */
    new_node->next = list->head;
    list->head = new_node;
    list->count++;

    return 1;
}

/**
 * Clears all nodes from the linked list, freeing allocated memory.
 * Time Complexity: O(n)
 */
void list_clear(HistoryList* list) {
    HistoryNode* current = list->head;
    while (current != NULL) {
        HistoryNode* next_node = current->next;
        free(current);
        current = next_node;
    }
    list->head = NULL;
    list->count = 0;
}

/**
 * Frees the entire linked list.
 */
void list_free(HistoryList* list) {
    list_clear(list);
}
