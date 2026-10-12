# Priority-Based Notification Management System
# Makefile for C Backend

CC ?= gcc
CFLAGS ?= -O2 -Wall -Wextra -Werror -std=c99
LDFLAGS ?= -lm

# Windows MinGW requires -lws2_32 for sockets
ifeq ($(OS),Windows_NT)
    LDFLAGS += -lws2_32
    TARGET_SERVER = bin/c_notification_server.exe
    TARGET_ENGINE = bin/priority_engine.exe
else
    TARGET_SERVER = bin/c_notification_server
    TARGET_ENGINE = bin/priority_engine
endif

SOURCES_SERVER = main.c priority_queue.c queue.c linked_list.c storage.c
SOURCES_ENGINE = priority_engine.c

all: dirs $(TARGET_SERVER) $(TARGET_ENGINE)

dirs:
	mkdir -p bin data

$(TARGET_SERVER): $(SOURCES_SERVER)
	$(CC) $(CFLAGS) $(SOURCES_SERVER) -o $(TARGET_SERVER) $(LDFLAGS)

$(TARGET_ENGINE): $(SOURCES_ENGINE)
	$(CC) $(CFLAGS) $(SOURCES_ENGINE) -o $(TARGET_ENGINE) $(LDFLAGS)

clean:
	rm -rf bin/c_notification_server* bin/priority_engine*

run: $(TARGET_SERVER)
	./$(TARGET_SERVER)

.PHONY: all dirs clean run
