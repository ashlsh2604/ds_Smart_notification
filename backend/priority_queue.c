/**
 * Priority-Based Notification Management System
 * Data Structure: Binary Max-Heap Implementation
 * File: backend/priority_queue.c
 *
 * Concepts:
 * - A Binary Max-Heap is a complete binary tree where every parent node has
 *   a priority greater than or equal to its children.
 * - Array indexing:
 *     Left Child   = 2 * i + 1
 *     Right Child  = 2 * i + 2
 *     Parent Node  = (i - 1) / 2
 * - Tie-Breaking Rule:
 *     If two notifications have the same priority, the older notification
 *     (smaller timestamp) is given higher precedence (FIFO behavior within priority).
 *
 * Time Complexities:
 * - Insertion: O(log n)
 * - Extraction of Max: O(log n)
 * - Peek Max: O(1)
 * - Deletion by ID: O(n) search + O(log n) heapify
 */

#include "priority_queue.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/**
 * Initializes a new binary max-heap with an initial allocated capacity.
 */
void heap_init(MaxHeap* h, int initial_capacity) {
    if (initial_capacity < 8) {
        initial_capacity = 8;
    }
    h->capacity = initial_capacity;
    h->size = 0;
    h->items = (Notification*)malloc(sizeof(Notification) * h->capacity);
    if (!h->items) {
        fprintf(stderr, "Fatal: Out of memory initializing priority queue heap.\n");
        exit(EXIT_FAILURE);
    }
}

/**
 * Frees dynamically allocated memory in the heap.
 */
void heap_free(MaxHeap* h) {
    if (h->items) {
        free(h->items);
        h->items = NULL;
    }
    h->size = 0;
    h->capacity = 0;
}

/**
 * Checks if the priority queue is empty.
 * Returns 1 if empty, 0 otherwise. Time Complexity: O(1)
 */
int heap_is_empty(const MaxHeap* h) {
    return (h == NULL || h->size == 0);
}

/**
 * Priority comparator with FIFO tie-breaking for equal priority notifications.
 * Returns:
 *   > 0 if 'a' has higher precedence than 'b'
 *   < 0 if 'b' has higher precedence than 'a'
 *   0 if identical
 */
int compare_priority(const Notification* a, const Notification* b) {
    /* Higher numerical priority wins (4 Critical > 3 High > 2 Med > 1 Low) */
    if (a->priority != b->priority) {
        return a->priority - b->priority;
    }

    /* Tie-breaker: Earlier timestamp (older notification) has higher precedence */
    if (a->timestamp < b->timestamp) {
        return 1; /* 'a' is older -> higher precedence */
    } else if (a->timestamp > b->timestamp) {
        return -1;
    }
    return 0;
}

/**
 * Swaps two notification items in the heap array.
 */
static void swap_nodes(Notification* a, Notification* b) {
    Notification temp = *a;
    *a = *b;
    *b = temp;
}

/**
 * Restores the max-heap property upwards from child to parent.
 * Called after inserting an element at the end of the array.
 * Time Complexity: O(log n)
 */
void heapify_up(MaxHeap* h, int index) {
    while (index > 0) {
        int parent_idx = (index - 1) / 2;
        /* If current node has higher precedence than parent, swap */
        if (compare_priority(&h->items[index], &h->items[parent_idx]) > 0) {
            swap_nodes(&h->items[index], &h->items[parent_idx]);
            index = parent_idx;
        } else {
            break; /* Heap property satisfied */
        }
    }
}

/**
 * Restores the max-heap property downwards from parent to children.
 * Called after removing the root element and moving the last leaf to the root.
 * Time Complexity: O(log n)
 */
void heapify_down(MaxHeap* h, int index) {
    while (1) {
        int left_child = 2 * index + 1;
        int right_child = 2 * index + 2;
        int largest = index;

        /* Compare parent with left child */
        if (left_child < h->size &&
            compare_priority(&h->items[left_child], &h->items[largest]) > 0) {
            largest = left_child;
        }

        /* Compare largest so far with right child */
        if (right_child < h->size &&
            compare_priority(&h->items[right_child], &h->items[largest]) > 0) {
            largest = right_child;
        }

        /* If parent is not largest, swap with the largest child and continue */
        if (largest != index) {
            swap_nodes(&h->items[index], &h->items[largest]);
            index = largest;
        } else {
            break; /* Heap property satisfied */
        }
    }
}

/**
 * Inserts a new notification into the binary max-heap.
 * Dynamically doubles array capacity if full.
 * Time Complexity: O(log n)
 */
int heap_insert(MaxHeap* h, Notification item) {
    if (h->size >= h->capacity) {
        int new_capacity = h->capacity * 2;
        Notification* new_items = (Notification*)realloc(h->items, sizeof(Notification) * new_capacity);
        if (!new_items) {
            fprintf(stderr, "Error: Memory reallocation failed in heap_insert.\n");
            return 0; /* Failure */
        }
        h->items = new_items;
        h->capacity = new_capacity;
    }

    /* Place element at the next available leaf position */
    int current_idx = h->size;
    h->items[current_idx] = item;
    h->size++;

    /* Bubble up until heap property is restored */
    heapify_up(h, current_idx);
    return 1; /* Success */
}

/**
 * Extracts and removes the notification with the highest priority (the root).
 * Time Complexity: O(log n)
 */
int heap_extract_max(MaxHeap* h, Notification* result) {
    if (heap_is_empty(h)) {
        return 0; /* Empty heap */
    }

    /* The root holds the highest priority notification */
    *result = h->items[0];

    /* Replace root with the last leaf element */
    h->items[0] = h->items[h->size - 1];
    h->size--;

    /* Bubble down from root to restore max-heap invariant */
    if (h->size > 0) {
        heapify_down(h, 0);
    }

    return 1; /* Success */
}

/**
 * Peeks at the highest priority notification without removing it.
 * Time Complexity: O(1)
 */
int heap_peek_max(const MaxHeap* h, Notification* result) {
    if (heap_is_empty(h)) {
        return 0;
    }
    *result = h->items[0];
    return 1;
}

/**
 * Deletes a notification by its unique ID.
 * Time Complexity: O(n) linear search + O(log n) re-heapify
 */
int heap_delete_by_id(MaxHeap* h, int id) {
    int target_idx = -1;
    for (int i = 0; i < h->size; i++) {
        if (h->items[i].id == id) {
            target_idx = i;
            break;
        }
    }

    if (target_idx == -1) {
        return 0; /* Not found */
    }

    /* Move last element into deleted slot */
    h->items[target_idx] = h->items[h->size - 1];
    h->size--;

    if (target_idx < h->size) {
        /* Check whether it needs to bubble up or down */
        int parent_idx = (target_idx - 1) / 2;
        if (target_idx > 0 && compare_priority(&h->items[target_idx], &h->items[parent_idx]) > 0) {
            heapify_up(h, target_idx);
        } else {
            heapify_down(h, target_idx);
        }
    }

    return 1; /* Success */
}

/**
 * Marks a notification as read within the heap.
 */
int heap_mark_read(MaxHeap* h, int id) {
    for (int i = 0; i < h->size; i++) {
        if (h->items[i].id == id) {
            strncpy(h->items[i].status, "read", MAX_STATUS_LEN - 1);
            h->items[i].status[MAX_STATUS_LEN - 1] = '\0';
            return 1;
        }
    }
    return 0;
}

/**
 * Clears all items in the heap without freeing the container buffer.
 */
void heap_clear(MaxHeap* h) {
    h->size = 0;
}
