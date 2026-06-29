<div align="center">

# ⚙️ GymPilot — Backend API Server

**The RESTful backend powering the GymPilot fitness & gym management platform**

[![Express.js](https://img.shields.io/badge/Express.js-5-000000?style=for-the-badge&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=for-the-badge&logo=mongodb)](https://mongodb.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/)
[![License](https://img.shields.io/badge/License-ISC-blue?style=for-the-badge)](LICENSE)

</div>

---

## 📖 Overview

**gym-pilot-server** is the backend REST API for the [GymPilot](https://gym-pilot-client.vercel.app/) platform. Built with Express.js 5 and MongoDB, it handles data persistence, JWT-based authentication verification, CORS management, and serves all the data consumed by the Next.js frontend.

> 🔗 **Frontend repo:** [gym-pilot-client](https://github.com/mehedi-hasan2006/gym-pilot-client)
> 🌐 **Live frontend:** [https://gym-pilot-client.vercel.app/](https://gym-pilot-client.vercel.app/)

---

## ✨ Features

- 🚀 **Express.js 5** — Fast, minimal, and flexible Node.js web framework
- 🗄️ **MongoDB** — NoSQL database for flexible data storage (classes, users, bookings, forum posts)
- 🔐 **JWT Verification** — Secure token validation via `jose-cjs` for protected routes
- 🌐 **CORS Configured** — Cross-origin requests enabled for the frontend client
- ☁️ **Vercel Serverless** — Deployed as a serverless function via `@vercel/node`
- 🛡️ **Environment Variables** — Secrets managed securely with `dotenv`

---

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| **Runtime** | Node.js 18+ |
| **Framework** | Express.js 5 |
| **Database** | MongoDB 7 (native driver) |
| **Auth** | jose-cjs (JWT verification) |
| **Middleware** | CORS, dotenv |
| **Deployment** | Vercel (serverless) |

---

## 📁 Project Structure

```
gym-pilot-server/
├── index.js          # Main entry point — Express app, routes, DB connection
├── vercel.json       # Vercel deployment configuration
├── package.json      # Project metadata and dependencies
├── .env              # Environment variables (not committed)
└── .gitignore
```

> All routes are currently handled within `index.js`. As the project scales, consider splitting into a `routes/` and `controllers/` structure.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **npm** or **yarn**
- A **MongoDB** instance (local or [MongoDB Atlas](https://www.mongodb.com/atlas))

### 1. Clone the Repository

```bash
git clone https://github.com/mehedi-hasan2006/gym-pilot-server.git
cd gym-pilot-server
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# MongoDB
MONGODB_URI=your_mongodb_connection_string
DB_NAME=gym-pilot

# JWT / Auth
BETTER_AUTH_SECRET=your_auth_secret_key

# CORS
CLIENT_URL=http://localhost:3000
```

### 4. Start the Development Server

```bash
nodemon index.js
```

The server will start at [http://localhost:5000](http://localhost:5000) (or whichever port you configure).

---

## 📡 API Endpoints

> Base URL (production): your deployed Vercel URL

All routes are routed through `index.js`. Below are the expected resource endpoints based on the GymPilot platform's features:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/classes` | Fetch all gym classes |
| `GET` | `/classes/:id` | Fetch a single class by ID |
| `POST` | `/classes` | Create a new class (admin) |
| `PUT` | `/classes/:id` | Update a class (admin) |
| `DELETE` | `/classes/:id` | Delete a class (admin) |
| `GET` | `/forum` | Fetch community forum posts |
| `POST` | `/forum` | Create a new forum post |
| `GET` | `/trainers` | Fetch all trainers |
| `GET` | `/users` | Fetch all users (admin) |
| `PATCH` | `/users/:id` | Update user role/status (admin) |

> Protected routes require a valid JWT token in the `Authorization` header as `Bearer <token>`.

---

## ☁️ Deployment

This server is configured for **Vercel Serverless** deployment via `vercel.json`:

```json
{
  "version": 2,
  "builds": [{ "src": "index.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "index.js", "methods": ["GET","POST","PUT","PATCH","DELETE","OPTIONS"] }]
}
```

### Deploy to Vercel

1. Push your code to GitHub.
2. Import the repo at [vercel.com/new](https://vercel.com/new).
3. Add all environment variables from `.env` in the Vercel dashboard under **Settings → Environment Variables**.
4. Click **Deploy**.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/mehedi-hasan2006/gym-pilot-server)

---

## 🔗 Related

| Repository | Description |
|---|---|
| [gym-pilot-client](https://github.com/mehedi-hasan2006/gym-pilot-client) | Next.js 16 frontend |
| [Live Site](https://gym-pilot-client.vercel.app/) | Deployed GymPilot application |

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).

---

<div align="center">

Made with ❤️ by [mehedi-hasan2006](https://github.com/mehedi-hasan2006)

⭐ Star this repo if it was helpful!

</div>