# Team Task Manager

A full-stack task management application where teams can create projects, assign tasks, and track progress with role-based access.

---

## Project Overview

This application helps teams manage work efficiently by allowing admins to create projects, assign tasks to members, and monitor progress through dashboards.

---

## How It Works

### 1. User Signup/Login

- New users create account using:
  - Name
  - Email
  - Password

### Role Logic:
- First registered user automatically becomes **Admin**
- All future users become **Members**

This prevents anyone from selecting admin role manually.

---

## 2. Admin Functionalities

Admins have full access to manage the system.

### Admin can:

### Create Projects
Admin creates project by adding:
- Project Name
- Description

---

### Add Team Members
Admin can add registered users into specific projects.

Example:
- Project → Ecommerce Website
- Add members → Satyam, Rahul

---

### Create Tasks
Admin creates tasks inside projects:

Example:
- Design Login Page
- Build Product API
- Create Dashboard UI

Admin can assign:
- Task title
- Description
- Due date
- Assigned member

---

### Delete Tasks
Admin can delete tasks if required.

---

### Delete Projects
Project owner admin can delete complete project.

---

## 3. Member Functionalities

Members have limited access.

### Members can:

- View projects they are assigned to
- View tasks assigned to them
- Update task status

Members cannot:
- Create projects
- Add members
- Create tasks
- Delete tasks

---

## 4. Task Status Flow

Every task follows:

```bash
Pending → In Progress → Completed
