# 📅 Collaborative Calendar for Event Scheduling

## 🔍 Project Overview

The **Event Management System** is a collaborative calendar platform designed to streamline group scheduling, event coordination, and participant interaction. It supports real-time updates, role-based access control, notification handling, and client-side caching to ensure high performance and consistency.

This project enables users to:
- Create and manage groups with distinct roles (Admin, Editor, Viewer)
- Schedule events collaboratively
- Handle invitations and notifications
- Optimize performance through local caching
- Prevent conflicts via version-controlled concurrency mechanisms

---

## 👥 Team

**Group Name:** Invalid Query  
**Group Members:**
- Aashirwad Mishra - `22CS30001`
- Dev Butani - `22CS30022`
- Kondapalli Mohan Balasubramanyam - `22CS10036`
- Lakshya Agrawal - `22CS30036`

---

## 📐 ER Diagram & Schema

### 🔗 Entities and Relationships

#### `User`
- `user_id` (PK)
- `name`, `email`, `password`

#### `Group`
- `group_id` (PK)
- `group_name`, `description`
- `version_number`

#### `Member`
- `member_id` (PK)
- `user_id` (FK), `group_id` (FK)
- `permission`: {`Admin`, `Editor`, `Viewer`}
- `status`: {`Accepted`, `Declined`, `Pending`}
- `read_status`: {`Read`, `Unread`}

#### `Event`
- `event_id` (PK)
- `event_name`, `description`, `start_time`, `end_time`
- `version_number`, `cache_number`
- `creator` (FK to `User`), `group_id` (FK to `Group`)

#### `Participate`
- `participate_id` (PK)
- `user_id` (FK), `event_id` (FK)
- `status`: {`Accepted`, `Declined`, `Pending`}
- `read_status`, `invite_time`

---

## 🚀 Core Functionalities

### 🏠 Dashboard
- Unified calendar view showing both personal and group events
- Real-time event sync and time zone conversion
- Client-side caching to reduce server queries

### 📆 Group Calendar
- Role-based access:
  - **Admin**: Full control (events & group management)
  - **Editor**: Event creation & modification
  - **Viewer**: Read-only access
- Version-based concurrency to prevent update conflicts

### 🔔 Notifications & Invitations
- Real-time alerts for events and group invites
- Response options: Accept or Decline
- Smart highlighting of unread items

### 🔁 Concurrency Control
- **Optimistic concurrency** using `version_number`
- Validates data consistency during updates
- Critical transactions (like group deletion) use **serializable isolation**

---

## 🛠️ Backend Architecture

### 🌐 Flask Framework
- **Authentication:** `Flask-Login`, session handling, password hashing
- **Template Rendering:** `Jinja2` for dynamic HTML
- **Form Handling:** `Flask-WTF` with CSRF protection

### 🔒 Key Operations
- **Event Creation/Update/Delete:** Role validation, version checks, cascading deletions
- **Group Membership:** Admin-controlled, permission management
- **Serializable Transactions:** For operations like group deletion

---

## ⚙️ Client-Side Caching

### 🔄 Mechanism
- Uses `localStorage` via the WebStorage API
- Events are cached by group or user context
- Updates managed via a **Version Map** with event_id and cache_number

### 🧹 Cache Behaviors
- **On Event Add/Delete/Update:** Cache updated to reflect DB state
- **On Invite Response:** Participant status updated in cache
- **On Group Removal/Sign-out:** Cache is cleared for security

---

## 💻 Front-End Stack

- **HTML + CSS + Bootstrap 5.3.3**: Responsive UI design
- **JavaScript + jQuery**: Client-side logic and AJAX interactions
- **FullCalendar.js**: Dynamic and interactive calendar interface

---

## 🔐 Role Permissions Matrix

| Role   | Create/Edit Events | Manage Group Members | View Events |
|--------|---------------------|----------------------|-------------|
| Admin  | ✅                  | ✅                   | ✅          |
| Editor | ✅                  | ❌                   | ✅          |
| Viewer | ❌                  | ❌                   | ✅          |

---

## 📈 Future Enhancements

- 🔍 Fuzzy search for group discovery
- 🤖 AI-driven scheduling suggestions
- 💬 Integrated group messaging/chat

---

## 📚 References

- **Database System Concepts** by Silberschatz, Korth, Sudarshan (7th ed.)
  - Transaction Isolation, Optimistic Concurrency, Caching
- **Flask Documentation**
- **SQLAlchemy Documentation**
- **FullCalendar.js Documentation**

---

## 📸 Screenshots

> Refer to the original project documentation PDF for:
- Dashboard View
- Event Creation/Edit Forms
- Group Creation & Settings
- Notifications Panel
- Client-side Caching Visualization

---

## ✅ Conclusion

The Event Management System provides a full-featured, efficient platform for collaborative scheduling with robust support for concurrency, permissions, and performance optimization. It is designed for seamless real-time collaboration and a smooth user experience.
