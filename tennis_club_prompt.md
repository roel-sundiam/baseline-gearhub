# 🎾 Tennis Club Management System – Full Development Prompt

## 📌 Project Overview
Build a **mobile-first, modern, and professional tennis club management system** using:

- **Frontend:** Angular (hosted on Netlify)
- **Backend:** Express.js (serverless via Netlify Functions)
- **Database:** MongoDB (Atlas)

The system is **NOT just a booking app** — it is a **court usage + billing + player management platform** with admin control and player accounts.

---

# 🎯 Core Requirements

## 1. 🔐 Authentication System

### Registration (Player)
- Fields:
  - Name
  - Email
  - Password
  - (Optional: Contact Number)

- After registration:
  - User status = `pending`
  - Show message:
    "Your account is pending admin approval"

---

### Login
- Validate:
  - Email + password
  - Status must be `active`

- If not approved:
```json
{
  "error": "Account pending admin approval"
}
```

---

### User Roles
- `admin`
- `player`

---

### User Schema (MongoDB)
```js
{
  _id,
  name,
  email,
  passwordHash,
  role: "player" | "admin",
  status: "pending" | "active" | "rejected",
  createdAt
}
```

---

# 🧑‍💼 Admin Features

## 2. 👥 User Approval
- View list of pending users
- Approve / Reject users

---

## 3. 💰 Rate Management (Dynamic Pricing)

Admin can define:
- Game rate (no lights)
- Light rate (per game per player)
- Ball boy fee (per player)

### Rates Collection
```js
{
  _id: "court_rates",
  gameRate,
  lightRate,
  ballBoyRate,
  updatedAt
}
```

---

# 🎾 4. Court Usage & Billing System

## Admin Input Form
Admin selects:
- Date
- Time
- Players (multiple)
- Games played per player
- Light used (yes/no)
- Ball boy used (yes/no)

---

## 💡 Billing Logic

For EACH player:

### Game Fee
gamesPlayed × gameRate

### Light Fee (if used)
gamesPlayed × lightRate

### Ball boy Fee
ballBoyRate

---

### Total per player:
gameFee + lightFee + ballBoyFee

---

### Total session:
sum of all player totals

---

## ⚠️ Backend Rule
- ALL calculations must be done in backend
- NEVER trust frontend values

---

## 📦 Session Schema
```js
{
  _id,
  date,
  startTime,
  endTime,
  lightUsed,
  ballBoyUsed,
  ratesUsed: {
    gameRate,
    lightRate,
    ballBoyRate
  },
  players: [
    {
      playerId,
      name,
      gamesPlayed,
      charges: {
        gameFee,
        lightFee,
        ballBoyFee,
        total
      },
      status: "unpaid"
    }
  ],
  totalAmount,
  createdAt
}
```

---

## 🧾 Player Charges Collection
```js
{
  _id,
  playerId,
  sessionId,
  amount,
  breakdown: {
    gameFee,
    lightFee,
    ballBoyFee
  },
  status: "unpaid",
  createdAt
}
```

---

## 🔁 Submission Flow

When admin submits:

1. Fetch latest rates from DB
2. Compute all charges
3. Save session
4. Create player charge records

---

# 👤 5. Player Dashboard

## Payment Section
Each player sees:

- Session history
- Charges per session
- Status (Paid / Unpaid)

---

# 🎨 UI/UX Requirements

## Mobile-first
- Responsive layout
- Card-based UI
- Large buttons

## Theme
- Dark Green primary
- Light Green accent
- Clean white background

---

# 🔒 Security
- bcrypt password hashing
- JWT authentication
- Admin-only routes

---

# 🚀 Final Goal
Complete tennis club management system with:
- Auth + approval
- Billing system
- Player dashboard
- Mobile-first UI
