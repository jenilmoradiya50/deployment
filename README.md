# 🚀 Branch & ATM SD-WAN Work Tracker v2.0 (Full-Stack)

An enterprise-grade SD-WAN setup, ISP connectivity, configuration, and handover tracking dashboard with **JWT Authentication**, **MongoDB Database Storage**, and **1-Click Vercel Deployment**.

Built with **React 18**, **Node.js (Express & Vercel Serverless)**, and **MongoDB (Mongoose)**.

---

## 🔑 Default Login Credentials

- **Username**: `admin`
- **Password**: `admin@123`
*(A "Quick Fill Demo" button is available directly on the login screen for 1-click testing!)*

---

## 🌟 What's New in v2.0

1. **🔒 Secure Authentication Portal**:
   - Bank-grade login screen with 256-bit JWT session encryption.
   - Protected API routes — all database reading and writing requires a valid token.
   - User profile badge in header with role display ("ADMIN") and clean Sign Out.

2. **🗄️ Real Database Storage (MongoDB Atlas + Serverless Resilient)**:
   - Full support for cloud **MongoDB Atlas** via `MONGODB_URI`.
   - Dual-mode architecture: if no cloud database is attached yet, it automatically falls back to an encrypted local JSON database (`data/records.json` and `data/users.json`).
   - Browser local storage auto-sync ensures zero data loss during serverless cold starts.

3. **🎨 Complete Enterprise UI Redesign**:
   - Modern Dark-Navy & Slate theme (`#0b1528`) with high-contrast elements.
   - **Interactive KPI Cards**: Total Managed Sites, Operational (with live % calculation and pulse dot), Pending / Issues, and Global Database Counter.
   - **Segmented Site Switcher**: Quick toggle between Branch Routers and ATM Terminals with dynamic site counts.
   - **Deep Network Cards**: Organized visual panels for LAN Configuration, BSNL Circuit, Jio Circuit, Airtel & CE Circuit, and SD-WAN Handover Checklist.
   - **1-Click IP Copy**: Instantly copy any IP address or Gateway with a single click.
   - **Dual Filter Bar**: Search by DP code, ATM ID, or IP + filter by Working Status or ISP Ping Health.
   - **Data Manager**: Export single record, full database backup, or CSV spreadsheet for Excel, plus JSON backup restoration.

---

## 🛠️ What You Need & How to Run

Since you have already installed **Node.js** and **Git**, you are 100% ready to run and deploy!

### 1. Run Locally on Your Machine

```bash
# 1. Start the server (serves both backend API and React frontend)
node server.js
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser!
- Click **"Quick Fill Demo"** and sign in.
- You can add, edit, ping-test, filter, and export records immediately.

---

## 🌐 Deploy to Vercel (Step-by-Step)

### Step 1: Push to Your GitHub Account

In your terminal inside `c:\Users\jenil\Downloads\Deployment`:
```bash
# Initialize git repository
git init
git add .
git commit -m "Branch & ATM Tracker v2.0 with Auth and Database"
git branch -M main

# Link to your GitHub repository
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

### Step 2: (Recommended) Get Free MongoDB Atlas Database

1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and sign up for a free account.
2. Create a free **M0 Shared Cluster** (free forever, 512 MB).
3. Under **Database Access**, create a user (e.g. `trackerAdmin` with a password).
4. Under **Network Access**, click **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`).
5. Click **Connect** → **Drivers** and copy your connection string:
   ```text
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/tracker?retryWrites=true&w=majority
   ```

### Step 3: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and log in.
2. Click **"Add New"** → **"Project"** and select your GitHub repository.
3. Vercel automatically detects the build settings:
   - **Framework Preset**: `Vite`
   - **Build Command**: `vite build`
   - **Output Directory**: `dist`
4. In the **Environment Variables** section, add:
   - `JWT_SECRET`: `any-random-secret-key-phrase`
   - `MONGODB_URI`: *(Your MongoDB Atlas connection string from Step 2)*
   - `ADMIN_USERNAME`: `admin`
   - `ADMIN_PASSWORD`: `admin@123`
5. Click **"Deploy"**.
6. That's it! Your app will be live with a free custom URL (e.g. `https://your-tracker.vercel.app`).

---

## 📡 REST API Reference

| Method | Endpoint | Protection | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Authenticates user and issues JWT token |
| `GET` | `/api/auth/me` | Bearer Token | Returns current session user & DB connection |
| `GET` | `/api/health` | Public | System uptime & database connection status |
| `GET` | `/api/stats` | Public | Aggregated KPI stats (Branch, ATM, Working, Total) |
| `GET` | `/api/records` | Bearer Token | List all records (supports `?kind=`, `?search=`, `?working=`) |
| `GET` | `/api/records/:id` | Bearer Token | Retrieve single deployment site by ID |
| `POST` | `/api/records` | Bearer Token | Create new Branch or ATM site in database |
| `PUT` | `/api/records/:id` | Bearer Token | Update existing record |
| `DELETE` | `/api/records/:id` | Bearer Token | Permanently remove record |
| `POST` | `/api/records/bulk` | Bearer Token | Bulk import records (`mode: "append" \| "replace"`) |
| `GET` | `/api/export` | Bearer/Public | Download database as JSON or CSV (`?format=csv`) |
