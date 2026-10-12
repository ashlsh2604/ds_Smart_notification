/**
 * VigilPriority - Core C Priority Queue & Data Structures Engine
 *
 * Implements:
 * 1. Max-Binary Heap with O(log n) insert/extract, O(1) peek, and O(log n) decrease/increase-key.
 * 2. Hash Map (djb2 hash with separate chaining) for O(1) ID-to-Heap lookup.
 * 3. Fixed-Memory Circular Ring Buffer for Dispatched Alerts history with overwrite tracking.
 * 4. Priority Aging Engine to dynamically boost older alerts and prevent starvation.
 * 5. SLA Deadline Pressure Curve and user-defined weighting formula.
 * 6. Tree-hierarchy generator for direct front-end heap visualization.
 * 7. JSON-RPC protocol over STDIN/STDOUT for Node.js / Express integration.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <time.h>
#include <math.h>

#define MAX_ID_LEN 64
#define MAX_TITLE_LEN 128
#define MAX_SERVICE_LEN 64
#define MAX_MSG_LEN 256
#define MAX_TAGS_LEN 128
#define INITIAL_HEAP_CAPACITY 64
#define HASH_TABLE_SIZE 127
#define RING_BUFFER_CAPACITY 50

/* Urgency Configuration */
typedef struct {
    double weight_urgency;
    double weight_severity;
    double weight_sla;
    double aging_rate_per_min;
    double base_scores[5]; /* 0: Info, 1: Low, 2: Medium, 3: High, 4: Critical */
} UrgencyConfig;

/* Notification Alert Node */
typedef struct {
    char id[MAX_ID_LEN];
    char title[MAX_TITLE_LEN];
    char service[MAX_SERVICE_LEN];
    char message[MAX_MSG_LEN];
    int urgency_level;         /* 0..4 */
    int severity_score;        /* 1..100 */
    int sla_seconds;           /* total SLA allowance */
    long long created_at_ts;   /* epoch milliseconds */
    long long dispatched_at_ts;/* 0 if queued */
    double computed_priority;  /* calculated sorting key */
    int age_boost_count;       /* number of times aged */
    char tags[MAX_TAGS_LEN];
    int heap_index;            /* array position in heap */
} AlertNode;

/* Hash Table Entry for O(1) alert lookup by ID */
typedef struct HashEntry {
    char id[MAX_ID_LEN];
    int heap_index;
    struct HashEntry* next;
} HashEntry;

/* Hash Table */
typedef struct {
    HashEntry* buckets[HASH_TABLE_SIZE];
    int count;
} HashTable;

/* Max-Heap Structure */
typedef struct {
    AlertNode* data;
    int size;
    int capacity;
    long long total_inserts;
    long long total_extracts;
    long long total_comparisons;
    long long total_swaps;
} MaxHeap;

/* Circular Ring Buffer for Dispatched Alerts */
typedef struct {
    AlertNode buffer[RING_BUFFER_CAPACITY];
    int head;  /* insertion point */
    int count; /* current items, max RING_BUFFER_CAPACITY */
    long long total_dispatched;
    long long total_overwritten;
} RingBuffer;

/* Global Engine State */
typedef struct {
    MaxHeap heap;
    HashTable id_index;
    RingBuffer dispatched_ring;
    UrgencyConfig config;
    long long started_at_ts;
} EngineState;

static EngineState g_state;

/* --- DJB2 HASH FUNCTION --- */
static unsigned long hash_djb2(const char* str) {
    unsigned long hash = 5381;
    int c;
    while ((c = (unsigned char)*str++)) {
        hash = ((hash << 5) + hash) + c; /* hash * 33 + c */
    }
    return hash % HASH_TABLE_SIZE;
}

/* --- HASH TABLE FUNCTIONS --- */
static void hash_table_init(HashTable* ht) {
    for (int i = 0; i < HASH_TABLE_SIZE; i++) {
        ht->buckets[i] = NULL;
    }
    ht->count = 0;
}

static void hash_table_insert_or_update(HashTable* ht, const char* id, int heap_index) {
    unsigned long bucket = hash_djb2(id);
    HashEntry* cur = ht->buckets[bucket];
    while (cur != NULL) {
        if (strcmp(cur->id, id) == 0) {
            cur->heap_index = heap_index;
            return;
        }
        cur = cur->next;
    }
    HashEntry* new_entry = (HashEntry*)malloc(sizeof(HashEntry));
    if (!new_entry) return;
    snprintf(new_entry->id, sizeof(new_entry->id), "%s", id);
    new_entry->heap_index = heap_index;
    new_entry->next = ht->buckets[bucket];
    ht->buckets[bucket] = new_entry;
    ht->count++;
}

static int hash_table_get(HashTable* ht, const char* id) {
    unsigned long bucket = hash_djb2(id);
    HashEntry* cur = ht->buckets[bucket];
    while (cur != NULL) {
        if (strcmp(cur->id, id) == 0) {
            return cur->heap_index;
        }
        cur = cur->next;
    }
    return -1; /* not found */
}

static void hash_table_remove(HashTable* ht, const char* id) {
    unsigned long bucket = hash_djb2(id);
    HashEntry* cur = ht->buckets[bucket];
    HashEntry* prev = NULL;
    while (cur != NULL) {
        if (strcmp(cur->id, id) == 0) {
            if (prev == NULL) {
                ht->buckets[bucket] = cur->next;
            } else {
                prev->next = cur->next;
            }
            free(cur);
            ht->count--;
            return;
        }
        prev = cur;
        cur = cur->next;
    }
}

/* --- PRIORITY CALCULATION FORMULA --- */
static double compute_alert_priority(const AlertNode* node, const UrgencyConfig* cfg, long long current_ts) {
    int lvl = node->urgency_level;
    if (lvl < 0) lvl = 0;
    if (lvl > 4) lvl = 4;
    double base = cfg->base_scores[lvl];
    double urgency_part = base * cfg->weight_urgency;
    double severity_part = (double)node->severity_score * cfg->weight_severity;

    /* Aging Bonus: prevents low-priority starvation */
    double minutes_alive = (double)(current_ts - node->created_at_ts) / 60000.0;
    if (minutes_alive < 0) minutes_alive = 0;
    double aging_bonus = minutes_alive * cfg->aging_rate_per_min;

    /* SLA Pressure Curve */
    double elapsed_sec = (double)(current_ts - node->created_at_ts) / 1000.0;
    double sla_pressure = 0.0;
    if (node->sla_seconds > 0) {
        double ratio = elapsed_sec / (double)node->sla_seconds;
        if (ratio >= 1.0) {
            /* Breach: substantial spike */
            sla_pressure = 500.0 + (ratio - 1.0) * 200.0;
        } else if (ratio > 0.7) {
            /* Imminent breach warning curve */
            sla_pressure = ((ratio - 0.7) / 0.3) * 250.0;
        }
        sla_pressure *= cfg->weight_sla;
    }

    return urgency_part + severity_part + aging_bonus + sla_pressure;
}

/* --- MAX-HEAP OPERATIONS --- */
static void max_heap_init(MaxHeap* heap) {
    heap->capacity = INITIAL_HEAP_CAPACITY;
    heap->size = 0;
    heap->data = (AlertNode*)malloc(sizeof(AlertNode) * heap->capacity);
    heap->total_inserts = 0;
    heap->total_extracts = 0;
    heap->total_comparisons = 0;
    heap->total_swaps = 0;
}

static void heap_swap(MaxHeap* heap, HashTable* ht, int i, int j) {
    heap->total_swaps++;
    AlertNode temp = heap->data[i];
    heap->data[i] = heap->data[j];
    heap->data[j] = temp;

    /* Update heap index references */
    heap->data[i].heap_index = i;
    heap->data[j].heap_index = j;
    hash_table_insert_or_update(ht, heap->data[i].id, i);
    hash_table_insert_or_update(ht, heap->data[j].id, j);
}

static void sift_up(MaxHeap* heap, HashTable* ht, int idx) {
    while (idx > 0) {
        int parent = (idx - 1) / 2;
        heap->total_comparisons++;
        if (heap->data[idx].computed_priority > heap->data[parent].computed_priority) {
            heap_swap(heap, ht, idx, parent);
            idx = parent;
        } else {
            break;
        }
    }
}

static void sift_down(MaxHeap* heap, HashTable* ht, int idx) {
    while (1) {
        int left = 2 * idx + 1;
        int right = 2 * idx + 2;
        int largest = idx;

        if (left < heap->size) {
            heap->total_comparisons++;
            if (heap->data[left].computed_priority > heap->data[largest].computed_priority) {
                largest = left;
            }
        }

        if (right < heap->size) {
            heap->total_comparisons++;
            if (heap->data[right].computed_priority > heap->data[largest].computed_priority) {
                largest = right;
            }
        }

        if (largest != idx) {
            heap_swap(heap, ht, idx, largest);
            idx = largest;
        } else {
            break;
        }
    }
}

static bool heap_insert(MaxHeap* heap, HashTable* ht, AlertNode node) {
    if (heap->size >= heap->capacity) {
        int new_cap = heap->capacity * 2;
        AlertNode* new_data = (AlertNode*)realloc(heap->data, sizeof(AlertNode) * new_cap);
        if (!new_data) return false;
        heap->data = new_data;
        heap->capacity = new_cap;
    }

    int idx = heap->size;
    heap->data[idx] = node;
    heap->data[idx].heap_index = idx;
    hash_table_insert_or_update(ht, node.id, idx);
    heap->size++;
    heap->total_inserts++;

    sift_up(heap, ht, idx);
    return true;
}

static bool heap_extract_max(MaxHeap* heap, HashTable* ht, AlertNode* out_node) {
    if (heap->size <= 0) return false;

    *out_node = heap->data[0];
    hash_table_remove(ht, out_node->id);

    heap->size--;
    heap->total_extracts++;

    if (heap->size > 0) {
        heap->data[0] = heap->data[heap->size];
        heap->data[0].heap_index = 0;
        hash_table_insert_or_update(ht, heap->data[0].id, 0);
        sift_down(heap, ht, 0);
    }
    return true;
}

static bool heap_delete_by_id(MaxHeap* heap, HashTable* ht, const char* id, AlertNode* out_node) {
    int idx = hash_table_get(ht, id);
    if (idx < 0 || idx >= heap->size) return false;

    if (out_node) {
        *out_node = heap->data[idx];
    }
    hash_table_remove(ht, id);

    heap->size--;
    if (idx == heap->size) {
        return true;
    }

    heap->data[idx] = heap->data[heap->size];
    heap->data[idx].heap_index = idx;
    hash_table_insert_or_update(ht, heap->data[idx].id, idx);

    /* May need sift up or sift down */
    int parent = (idx - 1) / 2;
    if (idx > 0 && heap->data[idx].computed_priority > heap->data[parent].computed_priority) {
        sift_up(heap, ht, idx);
    } else {
        sift_down(heap, ht, idx);
    }
    return true;
}

/* Linear-time Floyd Heapify for rebuilding after bulk priority updates */
static void heap_rebuild(MaxHeap* heap, HashTable* ht) {
    for (int i = 0; i < heap->size; i++) {
        heap->data[i].heap_index = i;
        hash_table_insert_or_update(ht, heap->data[i].id, i);
    }
    for (int i = (heap->size / 2) - 1; i >= 0; i--) {
        sift_down(heap, ht, i);
    }
}

/* Heap Invariant Checker: O(n) check that parent >= children */
static bool heap_verify_invariants(const MaxHeap* heap, int* violated_idx) {
    for (int i = 0; i < heap->size; i++) {
        int left = 2 * i + 1;
        int right = 2 * i + 2;
        if (left < heap->size && heap->data[i].computed_priority < heap->data[left].computed_priority) {
            if (violated_idx) *violated_idx = i;
            return false;
        }
        if (right < heap->size && heap->data[i].computed_priority < heap->data[right].computed_priority) {
            if (violated_idx) *violated_idx = i;
            return false;
        }
    }
    return true;
}

/* --- CIRCULAR RING BUFFER OPERATIONS --- */
static void ring_buffer_init(RingBuffer* rb) {
    rb->head = 0;
    rb->count = 0;
    rb->total_dispatched = 0;
    rb->total_overwritten = 0;
}

static void ring_buffer_push(RingBuffer* rb, AlertNode node) {
    if (rb->count < RING_BUFFER_CAPACITY) {
        rb->count++;
    } else {
        rb->total_overwritten++;
    }
    rb->buffer[rb->head] = node;
    rb->head = (rb->head + 1) % RING_BUFFER_CAPACITY;
    rb->total_dispatched++;
}

/* --- JSON OUTPUT UTILITIES --- */
static void json_escape_print(const char* s) {
    if (!s) return;
    putchar('"');
    while (*s) {
        if (*s == '"') printf("\\\"");
        else if (*s == '\\') printf("\\\\");
        else if (*s == '\n') printf("\\n");
        else if (*s == '\r') printf("\\r");
        else if (*s == '\t') printf("\\t");
        else putchar(*s);
        s++;
    }
    putchar('"');
}

static void print_node_json(const AlertNode* n) {
    printf("{");
    printf("\"id\":"); json_escape_print(n->id); printf(",");
    printf("\"title\":"); json_escape_print(n->title); printf(",");
    printf("\"service\":"); json_escape_print(n->service); printf(",");
    printf("\"message\":"); json_escape_print(n->message); printf(",");
    printf("\"urgencyLevel\":%d,", n->urgency_level);
    printf("\"severityScore\":%d,", n->severity_score);
    printf("\"slaSeconds\":%d,", n->sla_seconds);
    printf("\"createdAt\":%lld,", n->created_at_ts);
    printf("\"dispatchedAt\":%lld,", n->dispatched_at_ts);
    printf("\"computedPriority\":%.2f,", n->computed_priority);
    printf("\"ageBoostCount\":%d,", n->age_boost_count);
    printf("\"tags\":"); json_escape_print(n->tags); printf(",");
    printf("\"heapIndex\":%d", n->heap_index);
    printf("}");
}

/* --- COMMAND HANDLERS --- */

/* GET_STATE: returns heap array, top node, dispatched ring buffer, and data structure stats */
static void handle_get_state(long long current_ts) {
    (void)current_ts;
    int violated = -1;
    bool invariants_ok = heap_verify_invariants(&g_state.heap, &violated);
    int heap_depth = g_state.heap.size > 0 ? (int)(log2(g_state.heap.size)) + 1 : 0;

    printf("{\"status\":\"ok\",\"data\":{");
    
    /* Stats */
    printf("\"stats\":{");
    printf("\"heapSize\":%d,", g_state.heap.size);
    printf("\"heapCapacity\":%d,", g_state.heap.capacity);
    printf("\"heapDepth\":%d,", heap_depth);
    printf("\"invariantsValid\":%s,", invariants_ok ? "true" : "false");
    printf("\"violatedIndex\":%d,", violated);
    printf("\"totalInserts\":%lld,", g_state.heap.total_inserts);
    printf("\"totalExtracts\":%lld,", g_state.heap.total_extracts);
    printf("\"totalComparisons\":%lld,", g_state.heap.total_comparisons);
    printf("\"totalSwaps\":%lld,", g_state.heap.total_swaps);
    printf("\"hashEntries\":%d,", g_state.id_index.count);
    printf("\"dispatchedCount\":%d,", g_state.dispatched_ring.count);
    printf("\"totalDispatched\":%lld,", g_state.dispatched_ring.total_dispatched);
    printf("\"totalOverwritten\":%lld,", g_state.dispatched_ring.total_overwritten);
    printf("\"memoryFootprintBytes\":%zu", sizeof(EngineState) + (sizeof(AlertNode) * g_state.heap.capacity));
    printf("},");

    /* Config */
    printf("\"config\":{");
    printf("\"weightUrgency\":%.2f,", g_state.config.weight_urgency);
    printf("\"weightSeverity\":%.2f,", g_state.config.weight_severity);
    printf("\"weightSla\":%.2f,", g_state.config.weight_sla);
    printf("\"agingRatePerMin\":%.2f,", g_state.config.aging_rate_per_min);
    printf("\"baseScores\":[%.1f,%.1f,%.1f,%.1f,%.1f]",
        g_state.config.base_scores[0],
        g_state.config.base_scores[1],
        g_state.config.base_scores[2],
        g_state.config.base_scores[3],
        g_state.config.base_scores[4]);
    printf("},");

    /* Heap items in direct array order */
    printf("\"heap\":[");
    for (int i = 0; i < g_state.heap.size; i++) {
        if (i > 0) printf(",");
        print_node_json(&g_state.heap.data[i]);
    }
    printf("],");

    /* Dispatched Ring Buffer items, most recent first */
    printf("\"dispatched\":[");
    int count = g_state.dispatched_ring.count;
    int head = g_state.dispatched_ring.head;
    for (int i = 0; i < count; i++) {
        if (i > 0) printf(",");
        int idx = (head - 1 - i + RING_BUFFER_CAPACITY) % RING_BUFFER_CAPACITY;
        print_node_json(&g_state.dispatched_ring.buffer[idx]);
    }
    printf("]");

    printf("}}\n");
}

/* ENQUEUE */
static void handle_enqueue(const char* id, const char* title, const char* service,
                           const char* message, int urgency, int severity, int sla,
                           const char* tags, long long current_ts) {
    /* Check if duplicate */
    if (hash_table_get(&g_state.id_index, id) >= 0) {
        printf("{\"status\":\"error\",\"message\":\"Alert with this ID already exists in queue\"}\n");
        return;
    }

    AlertNode node;
    memset(&node, 0, sizeof(AlertNode));
    snprintf(node.id, sizeof(node.id), "%s", id);
    snprintf(node.title, sizeof(node.title), "%s", title);
    snprintf(node.service, sizeof(node.service), "%s", service);
    snprintf(node.message, sizeof(node.message), "%s", message);
    node.urgency_level = urgency;
    node.severity_score = severity;
    node.sla_seconds = sla;
    node.created_at_ts = current_ts;
    node.dispatched_at_ts = 0;
    node.age_boost_count = 0;
    snprintf(node.tags, sizeof(node.tags), "%s", tags);

    node.computed_priority = compute_alert_priority(&node, &g_state.config, current_ts);

    if (heap_insert(&g_state.heap, &g_state.id_index, node)) {
        printf("{\"status\":\"ok\",\"action\":\"enqueued\",\"id\":");
        json_escape_print(id);
        printf(",\"priority\":%.2f,\"heapIndex\":%d}\n",
            node.computed_priority, hash_table_get(&g_state.id_index, id));
    } else {
        printf("{\"status\":\"error\",\"message\":\"Failed to allocate memory for heap insert\"}\n");
    }
}

/* DISPATCH (Extract-Max) */
static void handle_dispatch(long long current_ts) {
    AlertNode top;
    if (!heap_extract_max(&g_state.heap, &g_state.id_index, &top)) {
        printf("{\"status\":\"empty\",\"message\":\"Priority queue is empty\"}\n");
        return;
    }

    top.dispatched_at_ts = current_ts;
    ring_buffer_push(&g_state.dispatched_ring, top);

    printf("{\"status\":\"ok\",\"action\":\"dispatched\",\"alert\":");
    print_node_json(&top);
    printf("}\n");
}

/* BATCH DISPATCH */
static void handle_batch_dispatch(int count, long long current_ts) {
    if (count <= 0) count = 1;
    printf("{\"status\":\"ok\",\"action\":\"batch_dispatched\",\"dispatched\":[");
    int actual = 0;
    for (int i = 0; i < count; i++) {
        AlertNode top;
        if (heap_extract_max(&g_state.heap, &g_state.id_index, &top)) {
            top.dispatched_at_ts = current_ts;
            ring_buffer_push(&g_state.dispatched_ring, top);
            if (actual > 0) printf(",");
            print_node_json(&top);
            actual++;
        } else {
            break;
        }
    }
    printf("],\"count\":%d}\n", actual);
}

/* ESCALATE / DECREASE-KEY */
static void handle_escalate(const char* id, int new_urgency, int new_severity, long long current_ts) {
    int idx = hash_table_get(&g_state.id_index, id);
    if (idx < 0 || idx >= g_state.heap.size) {
        printf("{\"status\":\"error\",\"message\":\"Alert ID not found in queue\"}\n");
        return;
    }

    AlertNode* n = &g_state.heap.data[idx];
    double old_priority = n->computed_priority;
    if (new_urgency >= 0) n->urgency_level = new_urgency;
    if (new_severity > 0) n->severity_score = new_severity;
    n->computed_priority = compute_alert_priority(n, &g_state.config, current_ts);

    if (n->computed_priority > old_priority) {
        sift_up(&g_state.heap, &g_state.id_index, idx);
    } else {
        sift_down(&g_state.heap, &g_state.id_index, idx);
    }

    int new_idx = hash_table_get(&g_state.id_index, id);
    printf("{\"status\":\"ok\",\"action\":\"escalated\",\"id\":");
    json_escape_print(id);
    printf(",\"oldPriority\":%.2f,\"newPriority\":%.2f,\"newHeapIndex\":%d}\n",
        old_priority, g_state.heap.data[new_idx].computed_priority, new_idx);
}

/* DELETE / DISMISS */
static void handle_delete(const char* id) {
    AlertNode removed;
    if (heap_delete_by_id(&g_state.heap, &g_state.id_index, id, &removed)) {
        printf("{\"status\":\"ok\",\"action\":\"deleted\",\"id\":");
        json_escape_print(id);
        printf("}\n");
    } else {
        printf("{\"status\":\"error\",\"message\":\"Alert not found in queue\"}\n");
    }
}

/* AGE TICK: Apply starvation prevention aging across all pending alerts */
static void handle_age_tick(long long current_ts) {
    int boosted_count = 0;
    for (int i = 0; i < g_state.heap.size; i++) {
        AlertNode* n = &g_state.heap.data[i];
        double old_p = n->computed_priority;
        n->computed_priority = compute_alert_priority(n, &g_state.config, current_ts);
        if (n->computed_priority > old_p) {
            n->age_boost_count++;
            boosted_count++;
        }
    }

    /* Heapify to restore binary heap property in O(n) */
    heap_rebuild(&g_state.heap, &g_state.id_index);

    printf("{\"status\":\"ok\",\"action\":\"age_ticked\",\"boostedCount\":%d,\"heapSize\":%d}\n",
        boosted_count, g_state.heap.size);
}

/* UPDATE CONFIG */
static void handle_update_config(double w_urgency, double w_severity, double w_sla,
                                 double aging_rate, double b0, double b1, double b2, double b3, double b4,
                                 long long current_ts) {
    if (w_urgency >= 0) g_state.config.weight_urgency = w_urgency;
    if (w_severity >= 0) g_state.config.weight_severity = w_severity;
    if (w_sla >= 0) g_state.config.weight_sla = w_sla;
    if (aging_rate >= 0) g_state.config.aging_rate_per_min = aging_rate;
    if (b0 >= 0) g_state.config.base_scores[0] = b0;
    if (b1 >= 0) g_state.config.base_scores[1] = b1;
    if (b2 >= 0) g_state.config.base_scores[2] = b2;
    if (b3 >= 0) g_state.config.base_scores[3] = b3;
    if (b4 >= 0) g_state.config.base_scores[4] = b4;

    /* Recompute priorities with new weights */
    for (int i = 0; i < g_state.heap.size; i++) {
        g_state.heap.data[i].computed_priority =
            compute_alert_priority(&g_state.heap.data[i], &g_state.config, current_ts);
    }
    heap_rebuild(&g_state.heap, &g_state.id_index);

    printf("{\"status\":\"ok\",\"action\":\"config_updated\"}\n");
}

/* CLEAR ALL */
static void handle_clear() {
    g_state.heap.size = 0;
    hash_table_init(&g_state.id_index);
    printf("{\"status\":\"ok\",\"action\":\"cleared\"}\n");
}

/* --- INITIALIZATION & CLI PARSER --- */
static void init_engine() {
    max_heap_init(&g_state.heap);
    hash_table_init(&g_state.id_index);
    ring_buffer_init(&g_state.dispatched_ring);

    /* Default Configuration */
    g_state.config.weight_urgency = 10.0;
    g_state.config.weight_severity = 1.5;
    g_state.config.weight_sla = 2.0;
    g_state.config.aging_rate_per_min = 5.0;
    g_state.config.base_scores[0] = 5.0;   /* Info */
    g_state.config.base_scores[1] = 15.0;  /* Low */
    g_state.config.base_scores[2] = 40.0;  /* Medium */
    g_state.config.base_scores[3] = 75.0;  /* High */
    g_state.config.base_scores[4] = 100.0; /* Critical */

    g_state.started_at_ts = (long long)time(NULL) * 1000LL;
}

/* Simple helper to strip surrounding quotes if any */
static void unquote(char* dst, const char* src, size_t max_len) {
    size_t len = strlen(src);
    if (len >= 2 && src[0] == '"' && src[len - 1] == '"') {
        size_t copy_len = len - 2 < max_len - 1 ? len - 2 : max_len - 1;
        strncpy(dst, src + 1, copy_len);
        dst[copy_len] = '\0';
    } else {
        strncpy(dst, src, max_len - 1);
        dst[max_len - 1] = '\0';
    }
}

int main(int argc, char* argv[]) {
    (void)argc;
    (void)argv;
    /* Disable stdio buffering for responsive IPC with Node.js child_process */
    setvbuf(stdin, NULL, _IONBF, 0);
    setvbuf(stdout, NULL, _IONBF, 0);

    init_engine();

    char line[4096];
    while (fgets(line, sizeof(line), stdin) != NULL) {
        /* Strip trailing newline */
        size_t len = strlen(line);
        while (len > 0 && (line[len - 1] == '\n' || line[len - 1] == '\r')) {
            line[--len] = '\0';
        }
        if (len == 0) continue;

        char cmd[64] = {0};
        int parsed = sscanf(line, "%63s", cmd);
        if (parsed <= 0) continue;

        long long now_ms = (long long)time(NULL) * 1000LL;

        if (strcmp(cmd, "PING") == 0) {
            printf("{\"status\":\"ok\",\"pong\":true}\n");
        } else if (strcmp(cmd, "GET_STATE") == 0) {
            long long custom_ts = 0;
            if (sscanf(line, "%*s %lld", &custom_ts) == 1 && custom_ts > 0) {
                now_ms = custom_ts;
            }
            handle_get_state(now_ms);
        } else if (strcmp(cmd, "ENQUEUE") == 0) {
            /* Format: ENQUEUE <id> <urgency> <severity> <sla> <ts> <service> <tags> | <title> | <message> */
            char id[MAX_ID_LEN] = {0};
            int urgency = 0, severity = 0, sla = 0;
            long long custom_ts = 0;
            char service[MAX_SERVICE_LEN] = {0};
            char tags[MAX_TAGS_LEN] = {0};

            char* bar1 = strchr(line, '|');
            if (!bar1) {
                printf("{\"status\":\"error\",\"message\":\"Malformed ENQUEUE command: missing | delimiter\"}\n");
                continue;
            }
            *bar1 = '\0';
            char* rest1 = bar1 + 1;

            char* bar2 = strchr(rest1, '|');
            char title[MAX_TITLE_LEN] = {0};
            char msg[MAX_MSG_LEN] = {0};

            if (bar2) {
                *bar2 = '\0';
                unquote(title, rest1, sizeof(title));
                unquote(msg, bar2 + 1, sizeof(msg));
            } else {
                unquote(title, rest1, sizeof(title));
                strcpy(msg, "");
            }

            sscanf(line, "%*s %63s %d %d %d %lld %63s %127s",
                   id, &urgency, &severity, &sla, &custom_ts, service, tags);
            if (custom_ts > 0) now_ms = custom_ts;

            handle_enqueue(id, title, service, msg, urgency, severity, sla, tags, now_ms);
        } else if (strcmp(cmd, "DISPATCH") == 0) {
            long long custom_ts = 0;
            if (sscanf(line, "%*s %lld", &custom_ts) == 1 && custom_ts > 0) {
                now_ms = custom_ts;
            }
            handle_dispatch(now_ms);
        } else if (strcmp(cmd, "BATCH_DISPATCH") == 0) {
            int count = 1;
            long long custom_ts = 0;
            sscanf(line, "%*s %d %lld", &count, &custom_ts);
            if (custom_ts > 0) now_ms = custom_ts;
            handle_batch_dispatch(count, now_ms);
        } else if (strcmp(cmd, "ESCALATE") == 0) {
            char id[MAX_ID_LEN] = {0};
            int new_urgency = -1;
            int new_severity = -1;
            long long custom_ts = 0;
            sscanf(line, "%*s %63s %d %d %lld", id, &new_urgency, &new_severity, &custom_ts);
            if (custom_ts > 0) now_ms = custom_ts;
            handle_escalate(id, new_urgency, new_severity, now_ms);
        } else if (strcmp(cmd, "DELETE") == 0) {
            char id[MAX_ID_LEN] = {0};
            sscanf(line, "%*s %63s", id);
            handle_delete(id);
        } else if (strcmp(cmd, "AGE_TICK") == 0) {
            long long custom_ts = 0;
            if (sscanf(line, "%*s %lld", &custom_ts) == 1 && custom_ts > 0) {
                now_ms = custom_ts;
            }
            handle_age_tick(now_ms);
        } else if (strcmp(cmd, "UPDATE_CONFIG") == 0) {
            double w_u = -1, w_s = -1, w_sla = -1, a_rate = -1;
            double b0 = -1, b1 = -1, b2 = -1, b3 = -1, b4 = -1;
            long long custom_ts = 0;
            sscanf(line, "%*s %lf %lf %lf %lf %lf %lf %lf %lf %lf %lld",
                   &w_u, &w_s, &w_sla, &a_rate, &b0, &b1, &b2, &b3, &b4, &custom_ts);
            if (custom_ts > 0) now_ms = custom_ts;
            handle_update_config(w_u, w_s, w_sla, a_rate, b0, b1, b2, b3, b4, now_ms);
        } else if (strcmp(cmd, "CLEAR") == 0) {
            handle_clear();
        } else {
            printf("{\"status\":\"error\",\"message\":\"Unknown command\"}\n");
        }
    }

    return 0;
}
