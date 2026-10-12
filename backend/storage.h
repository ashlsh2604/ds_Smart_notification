/**
 * Priority-Based Notification Management System
 * File Storage and Persistence
 * File: backend/storage.h
 *
 * Implements persistent data storage using standard C file handling (fopen, fprintf, fgets, fclose).
 * Stores user accounts, active priority queue notifications, and processed history.
 */

#ifndef STORAGE_H
#define STORAGE_H

#include "priority_queue.h"
#include "linked_list.h"

#define DATA_DIR "data"
#define USERS_FILE "data/users.txt"

/* Function Declarations */
int storage_init(void);
int storage_user_signup(const char* username, const char* password);
int storage_user_login(const char* username, const char* password);
int storage_save_notifications(const char* username, const MaxHeap* heap);
int storage_load_notifications(const char* username, MaxHeap* heap, int* next_id);
int storage_save_history(const char* username, const HistoryList* history);
int storage_load_history(const char* username, HistoryList* history);

#endif /* STORAGE_H */
