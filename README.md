# Cloud-Native Collaborative Shopping List System 🛒☁️

A distributed, cloud-native application designed for collaborative shopping list management, budget tracking, and real-time updates. The system allows multiple users (roommates, family members, event planners) to manage joint shopping lists efficiently, preventing duplicate purchases and optimizing expenses.

---

## 🏗️ Architecture & Component Overview

The application is built on a microservices architecture deployed on **Docker Swarm**, routed via **Kong API Gateway**, and monitored using **Prometheus & Grafana**.

```
                           +------------------+
                           |   User / Client  |
                           +--------+---------+
                                    |
                                    v
                           +------------------+
                           | Kong API Gateway |
                           +--------+---------+
                                    |
     +------------------------------+------------------------------+
     |                              |                              |
     v                              v                              v
+------------+            +------------------+            +--------------------+
| Auth       |            | List Manager     |            | Notification       |
| Service    |            | Service          |            | Service            |
+------------+            +--------+---------+            +--------------------+
                                   |                               ^
                                   v                               |
                          +------------------+            +--------------------+
                          | Items            +----------->| Budget             |
                          | Service          |            | Service            |
                          +--------+---------+            +--------------------+
                                   |
                                   v
                          +------------------+
                          | IO Service       |
                          +--------+---------+
                                   |
                                   v
                          +------------------+
                          | PostgreSQL DB    |
                          +------------------+
```

---

## ✨ Key Features

- **User Authentication & Authorization:** Secure user registration, login, and JWT token issuance/validation via `Auth Service`.
- **Collaborative List Management:** Create, rename, delete, and share shopping lists between multiple users in real time via `List Manager Service`.
- **Item & Inventory Tracking:** Add items, modify quantities, and mark products as bought/unbought via `Items Service`.
- **Budgeting & Cost Calculation:** Define estimated prices per product, compute total list expenses, set spending limits, and receive threshold alerts via `Budget Service`.
- **Real-Time Notifications:** Instant notification delivery when shared lists are updated via `Notification Service`.
- **Data Layer Isolation:** Pure persistence layer abstraction separating business logic from direct database operations using a dedicated `IO Service`.

---

## 🧩 Microservices & Infrastructure

### Core Microservices

| Service | Description |
| :--- | :--- |
| **Auth Service** | Handles authentication, registration, and JWT token lifecycle. |
| **List Manager Service** | Manages list entities, sharing permissions, and collaborative access. |
| **Items Service** | Manages individual product entries, quantities, and completion statuses. |
| **Budget Service** | Calculates total costs, tracks spending thresholds, and budget alerts. |
| **Notification Service** | Sends real-time modification alerts to collaborators. |
| **IO Service** | Abstracts database interaction and isolates the persistent storage layer. |

### Supporting Infrastructure

- **Kong API Gateway:** Handles external routing, traffic control, and public API exposure.
- **PostgreSQL & pgAdmin:** Primary relational storage for users, lists, and items with a web administration UI.
- **Docker Swarm & Portainer:** Container orchestration stack with visual cluster management.
- **Prometheus & Grafana:** Infrastructure metric collection, service health monitoring, and visualization dashboards.

---

## 🌐 Network Segmentation

To ensure security and isolation, services are segregated across three dedicated Docker networks:

1. **`frontend-net`:** Connects Kong Gateway to public-facing microservices (`Auth Service`, `List Manager Service`) via HTTP/REST and JWT.
2. **`backend-net`:** Facilitates internal inter-service communication between `List Manager Service`, `Items Service`, `Budget Service`, and `Notification Service`.
3. **`db-net`:** Isolated database network containing `IO Service`, `PostgreSQL`, and `pgAdmin`.

---

## 📂 Project Repositories

The system is organized under the GitHub Organization:  
👉 **[shopping-list-cloud-native](https://github.com/shopping-list-cloud-native)**

* 🔐 **[Auth Service](https://github.com/shopping-list-cloud-native/shopping-auth-service)**
* 📋 **[List Manager Service](https://github.com/shopping-list-cloud-native/shopping-list-manager-service)**
* 🛒 **[Items Service](https://github.com/shopping-list-cloud-native/shopping-items-service)**
* 💰 **[Budget Service](https://github.com/shopping-list-cloud-native/shopping-budget-service)**
* 🔔 **[Notification Service](https://github.com/shopping-list-cloud-native/shopping-notification-service)**
* 🗄️ **[IO Service](https://github.com/shopping-list-cloud-native/shopping-io-service)**
* 🚀 **[Infrastructure & Deployment](https://github.com/shopping-list-cloud-native/shopping-infra-deployment)**

---

## 🚀 Deployment & Local Setup

### Prerequisites
- [Docker Engine](https://docs.docker.com/get-docker/) (with Docker Swarm enabled)
- [Docker Compose](https://docs.docker.com/compose/)

### Initialization

1. **Enable Docker Swarm:**
   ```bash
   docker swarm init
   ```

2. **Clone the Infrastructure Repository:**
   ```bash
   git clone https://github.com/shopping-list-cloud-native/shopping-infra-deployment.git
   cd shopping-infra-deployment
   ```

3. **Deploy the Stack:**
   ```bash
   docker stack deploy -c docker-compose.yml shopping_stack
   ```

4. **Verify Running Services:**
   ```bash
   docker stack services shopping_stack
   ```

---

## 📊 Observability & Portals

When deployed, the following administrative UI endpoints become available:

- **Kong API Gateway:** `http://localhost:8000`
- **Portainer (Swarm UI):** `http://localhost:9000`
- **pgAdmin (DB Management):** `http://localhost:5050`
- **Grafana Dashboard:** `http://localhost:3000`
