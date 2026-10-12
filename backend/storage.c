/**
 * Priority-Based Notification Management System
 * File Storage Implementation
 * File: backend/storage.c
 *
 * File Handling Operations:
 * 1. Directory creation with cross-platform compatibility (Linux / Windows).
 * 2. User credential storage in data/users.txt using hash representation.
 * 3. Priority queue notification records in data/notifications_<username>.txt.
 * 4. Linked list history records in data/history_<username>.txt.
 * 5. Safe parsing handling empty lines, corrupted tokens, or missing files.
 */

#include "storage.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

#ifdef _WIN32
#include <direct.h>
#define CREATE_DIR(dir) _mkdir(dir)
#else
#define CREATE_DIR(dir) mkdir(dir, 0755)
#endif

/**
 * Basic DJB2 string hashing for student demonstration of non-plaintext credentials.
 * NOTE: For academic demonstration only; in production, use bcrypt or Argon2.
 */
static unsigned long simple_hash(const char* str) {
    unsigned long hash = 5381;
    int c;
    while ((c = (unsigned char)*str++)) {
        hash = ((hash << 5) + hash) + c;
    }
    return hash;
}

/**
 * Initializes the storage directory.
 */
int storage_init(void) {
    CREATE_DIR(DATA_DIR);
    /* Ensure users.txt exists */
    FILE* fp = fopen(USERS_FILE, "a");
    if (fp) {
        fclose(fp);
    }
    return 1;
}

/**
 * Registers a new user.
 * Returns 1 on success, 0 if user already exists or error.
 */
int storage_user_signup(const char* username, const char* password) {
    storage_init();
    if (!username || !password || strlen(username) == 0 || strlen(password) == 0) {
        return 0;
    }

    /* Check if username already exists */
    FILE* fp = fopen(USERS_FILE, "r");
    if (fp) {
        char line[256];
        while (fgets(line, sizeof(line), fp)) {
            char existing_user[MAX_USER_LEN];
            unsigned long h;
            if (sscanf(line, "%63s %lu", existing_user, &h) == 2) {
                if (strcmp(existing_user, username) == 0) {
                    fclose(fp);
                    return 0; /* Username taken */
                }
            }
        }
        fclose(fp);
    }

    /* Append new user */
    fp = fopen(USERS_FILE, "a");
    if (!fp) return 0;

    unsigned long pass_hash = simple_hash(password);
    fprintf(fp, "%s %lu\n", username, pass_hash);
    fclose(fp);
    return 1;
}

/**
 * Validates login credentials.
 * Returns 1 if valid, 0 otherwise.
 */
int storage_user_login(const char* username, const char* password) {
    storage_init();
    if (!username || !password) return 0;

    FILE* fp = fopen(USERS_FILE, "r");
    if (!fp) return 0;

    unsigned long target_hash = simple_hash(password);
    char line[256];
    int matched = 0;

    while (fgets(line, sizeof(line), fp)) {
        char existing_user[MAX_USER_LEN];
        unsigned long h;
        if (sscanf(line, "%63s %lu", existing_user, &h) == 2) {
            if (strcmp(existing_user, username) == 0 && h == target_hash) {
                matched = 1;
                break;
            }
        }
    }

    fclose(fp);
    return matched;
}

/**
 * Saves all pending notifications in the heap to data/notifications_<username>.txt.
 * Uses pipe (|) separated format:
 * id|title|description|category|priority|timestamp|status
 */
int storage_save_notifications(const char* username, const MaxHeap* heap) {
    storage_init();
    char filepath[256];
    snprintf(filepath, sizeof(filepath), "%s/notifications_%s.txt", DATA_DIR, username);

    FILE* fp = fopen(filepath, "w");
    if (!fp) {
        fprintf(stderr, "Error opening %s for writing.\n", filepath);
        return 0;
    }

    for (int i = 0; i < heap->size; i++) {
        const Notification* n = &heap->items[i];
        fprintf(fp, "%d|%s|%s|%s|%d|%lld|%s\n",
                n->id,
                n->title,
                n->description,
                n->category,
                n->priority,
                n->timestamp,
                n->status);
    }

    fclose(fp);
    return 1;
}

/**
 * Loads pending notifications for a user into the max-heap.
 * Restores and maintains max ID counter.
 */
int storage_load_notifications(const char* username, MaxHeap* heap, int* next_id) {
    storage_init();
    char filepath[256];
    snprintf(filepath, sizeof(filepath), "%s/notifications_%s.txt", DATA_DIR, username);

    FILE* fp = fopen(filepath, "r");
    if (!fp) {
        return 1; /* File does not exist yet; fresh start */
    }

    heap_clear(heap);
    char line[1024];
    int max_seen_id = 0;

    while (fgets(line, sizeof(line), fp)) {
        /* Strip trailing newlines */
        size_t len = strlen(line);
        while (len > 0 && (line[len - 1] == '\n' || line[len - 1] == '\r')) {
            line[--len] = '\0';
        }
        if (len == 0) continue;

        Notification n;
        memset(&n, 0, sizeof(Notification));

        char* p = line;
        char* token = strtok(p, "|");
        if (!token) continue;
        n.id = atoi(token);

        token = strtok(NULL, "|");
        if (token) strncpy(n.title, token, MAX_TITLE_LEN - 1);

        token = strtok(NULL, "|");
        if (token) strncpy(n.description, token, MAX_DESC_LEN - 1);

        token = strtok(NULL, "|");
        if (token) strncpy(n.category, token, MAX_CAT_LEN - 1);

        token = strtok(NULL, "|");
        if (token) n.priority = atoi(token);

        token = strtok(NULL, "|");
        if (token) n.timestamp = atoll(token);

        token = strtok(NULL, "|");
        if (token) strncpy(n.status, token, MAX_STATUS_LEN - 1);
        else strncpy(n.status, "pending", MAX_STATUS_LEN - 1);

        strncpy(n.username, username, MAX_USER_LEN - 1);

        if (n.id > max_seen_id) {
            max_seen_id = n.id;
        }

        /* Insert into max-heap */
        heap_insert(heap, n);
    }

    fclose(fp);
    if (next_id && max_seen_id >= *next_id) {
        *next_id = max_seen_id + 1;
    }
    return 1;
}

/**
 * Saves processed notification history from the linked list to data/history_<username>.txt.
 */
int storage_save_history(const char* username, const HistoryList* history) {
    storage_init();
    char filepath[256];
    snprintf(filepath, sizeof(filepath), "%s/history_%s.txt", DATA_DIR, username);

    FILE* fp = fopen(filepath, "w");
    if (!fp) return 0;

    HistoryNode* cur = history->head;
    while (cur != NULL) {
        const Notification* n = &cur->data;
        fprintf(fp, "%d|%s|%s|%s|%d|%lld|%lld\n",
                n->id,
                n->title,
                n->description,
                n->category,
                n->priority,
                n->timestamp,
                cur->processed_at);
        cur = cur->next;
    }

    fclose(fp);
    return 1;
}

/**
 * Loads processed history from file into the linked list.
 */
int storage_load_history(const char* username, HistoryList* history) {
    storage_init();
    char filepath[256];
    snprintf(filepath, sizeof(filepath), "%s/history_%s.txt", DATA_DIR, username);

    FILE* fp = fopen(filepath, "r");
    if (!fp) return 1; /* File does not exist yet */

    list_clear(history);
    char line[1024];

    /* Temporary dynamic buffer to read file lines so we can maintain order */
    while (fgets(line, sizeof(line), fp)) {
        size_t len = strlen(line);
        while (len > 0 && (line[len - 1] == '\n' || line[len - 1] == '\r')) {
            line[--len] = '\0';
        }
        if (len == 0) continue;

        Notification n;
        memset(&n, 0, sizeof(Notification));
        long long proc_at = 0;

        char* token = strtok(line, "|");
        if (!token) continue;
        n.id = atoi(token);

        token = strtok(NULL, "|");
        if (token) strncpy(n.title, token, MAX_TITLE_LEN - 1);

        token = strtok(NULL, "|");
        if (token) strncpy(n.description, token, MAX_DESC_LEN - 1);

        token = strtok(NULL, "|");
        if (token) strncpy(n.category, token, MAX_CAT_LEN - 1);

        token = strtok(NULL, "|");
        if (token) n.priority = atoi(token);

        token = strtok(NULL, "|");
        if (token) n.timestamp = atoll(token);

        token = strtok(NULL, "|");
        if (token) proc_at = atoll(token);

        strncpy(n.status, "processed", MAX_STATUS_LEN - 1);
        strncpy(n.username, username, MAX_USER_LEN - 1);

        list_add(history, n, proc_at);
    }

    fclose(fp);
    return 1;
}
