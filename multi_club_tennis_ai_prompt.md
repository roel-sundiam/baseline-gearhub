# 🧠 AI Assistant Prompt — Multi-Club Tennis Tournament & Reservation System

## 📌 Project Overview
I am building a **multi-club tennis management system** using:

- Frontend: Angular (latest version)
- Backend: Express.js (Node.js)
- Database: MongoDB

I already have an existing base project that I want to use as a starting point:

👉 https://github.com/roel-sundiam/TenisuTennisClub

Your task is to **pull this repository and transform it into a dynamic, multi-tenant system** that can support multiple tennis clubs instead of just one.

---

## 🎯 Main Goal
Convert the existing system into a **multi-club platform** where:

- Multiple clubs can use the same system
- Each club has its own:
  - Members
  - Courts
  - Reservations
  - Tournaments

---

## 🧩 Core Requirements

### 1. Clone and Setup Base Project
- Pull the repository
- Install dependencies
- Run the project locally
- Ensure the current system works before modifying anything

---

### 2. Introduce Multi-Tenant Architecture

Create a new **Club model**:

```js
Club {
  _id,
  name,
  location,
  logo,
  createdAt
}
```

---

### 3. Update Existing Models

Modify all relevant entities to include `clubId`:

```js
User {
  _id,
  name,
  email,
  clubId
}

Court {
  _id,
  name,
  clubId
}

Reservation {
  _id,
  clubId,
  courtId,
  userId,
  startTime,
  endTime
}

Tournament {
  _id,
  clubId,
  name,
  players,
  bracket
}
```

---

### 4. Backend Changes (Express.js)

- Add `clubId` filtering to ALL queries
- Ensure no data is shared across clubs
- Create API endpoints:
  - Create Club
  - Get Clubs
  - Select Active Club

Example:
```js
GET /api/reservations?clubId=123
```

---

### 5. Frontend Changes (Angular)

- Add **club selection (dropdown or selector)**
- Store selected `clubId` (localStorage or state)
- Pass `clubId` in all API requests
- Remove hardcoded values (club name, courts, members)

---

### 6. Database Setup

- Use a **new MongoDB database** (not tied to a single club name)
- Suggested name:
  - `tennis_platform`
  - `multi_tenant_tennis`

- Use environment variables for connection string (`.env`)
- Never expose DB credentials in frontend

---

### 7. Admin Features (Basic)

- Create a new club
- View list of clubs
- Assign users to a club

---

## ⚙️ Technical Constraints

- Use clean, modular structure
- Follow best practices for Angular + Express
- Keep components reusable and scalable
- Avoid hardcoding anything related to a single club

---

## 🚀 Expected Outcome

A working system where:
- Multiple clubs can be created
- Each club has isolated data
- Users can switch between clubs
- Existing functionality (reservations, tournaments) still works

---

## 📌 Notes

- Do NOT rewrite everything from scratch
- Refactor the existing codebase incrementally
- Keep backward compatibility where possible
- Focus on scalability and clean architecture

---

## 👉 Next Steps After This Task

- Add authentication per club
- Add role-based access (admin, member)
- Add analytics dashboard per club
- Deploy (Frontend + Backend)

---

## ✅ Deliverables

- Updated backend with multi-club support
- Updated Angular frontend with club selection
- Clean folder structure
- Instructions to run locally

---

If something is unclear, ask before proceeding. Do not assume missing requirements.