# PM Calendar

<div align="center">
  <a href="https://pm-calendar-frontend-1065468614106.asia-southeast1.run.app/" target="_blank">
    <strong>Live Project:</strong> pm-calendar-frontend-1065468614106.asia-southeast1.run.app
  </a>
  <br />
  <br />
  <img alt="React" src="https://img.shields.io/badge/React-19.2-0ea5e9?style=for-the-badge&logo=react&logoColor=white" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8.x-7c3aed?style=for-the-badge&logo=vite&logoColor=white" />
  <img alt="Express" src="https://img.shields.io/badge/Express-4.21-111827?style=for-the-badge&logo=express&logoColor=white" />
  <img alt="Firestore" src="https://img.shields.io/badge/Firestore-Cloud-ef4444?style=for-the-badge&logo=firebase&logoColor=white" />
  <img alt="Cloud Run" src="https://img.shields.io/badge/Google_Cloud-Run-2563eb?style=for-the-badge&logo=googlecloud&logoColor=white" />
</div>

---

## 1) What Is This Project?

PM Calendar is a team productivity platform that combines:

- Multi-project calendar planning (split and merge view)
- Team collaboration with role-based project access
- Realtime Team Notes with both Doc and Sheet editors

The goal is to keep planning, communication, and execution inside one system.

---

## 2) Tech Stack (Grouped by Category)

### Frontend

| Category | Technology | Purpose |
|---|---|---|
| UI Framework | React 19 | Interactive component-based UI |
| Build Tool | Vite 8 | Fast dev server and production builds |
| Styling | Tailwind CSS + custom CSS | Layout, design system, responsive behavior |
| Icons | lucide-react | Consistent iconography for toolbars and actions |

### Backend

| Category | Technology | Purpose |
|---|---|---|
| Runtime | Node.js (ESM) | API runtime |
| Framework | Express 4 | REST endpoints and server logic |
| Security | helmet + cors | Security headers and CORS policy |
| Authentication Utils | bcryptjs | Password hashing/verification |
| Mail | nodemailer | OTP email delivery |
| OAuth | google-auth-library | Google token verification |

### Data and Cloud

| Category | Technology | Purpose |
|---|---|---|
| Database | Google Firestore | Persistent app data |
| Deployment | Google Cloud Run | Containerized frontend/backend deployment |
| Secret Storage | Secret Manager | Secure storage of sensitive credentials |

### Dev and Quality

| Category | Technology | Purpose |
|---|---|---|
| Package Manager | npm | Dependency and script management |
| Linting | ESLint | Code quality and consistency |
| Container | Docker | Portable builds and deployment flow |

---

## 3) Why This Project Exists

- Teams often split work across separate calendar, notes, and tracking tools
- Cross-project planning needs a merged timeline view
- Documentation and spreadsheet workflows are both required in real projects
- Realtime collaboration should be native, not a disconnected add-on

---

## 4) Why This Tech Stack

- **React + Vite** for high iteration speed and complex interactive UI
- **Express + Node.js** for simple, maintainable API development
- **Firestore** for flexible document-based app state and cloud persistence
- **Cloud Run** for easy scaling and clean separation of frontend/backend services
- **Google OAuth** for lower login friction and trusted identity flow

---

## 5) Local Setup (From a Brand-New Machine)

> This setup uses Bash (Linux/WSL/macOS terminal style).  
> Each command is intentionally separated into its own code block.

### 5.1 Install base tools

Update package index:

```bash
sudo apt update
```

Install git, curl, and build tools:

```bash
sudo apt install -y git curl build-essential
```

Install nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

Reload shell profile:

```bash
source ~/.bashrc
```

Install Node.js 20:

```bash
nvm install 20
```

Use Node.js 20:

```bash
nvm use 20
```

Verify Node.js:

```bash
node -v
```

Verify npm:

```bash
npm -v
```

### 5.2 Get the source code

Clone repository:

```bash
git clone <YOUR_REPOSITORY_URL> pm-calendar
```

Enter project directory:

```bash
cd pm-calendar
```

### 5.3 Install dependencies

Install frontend dependencies:

```bash
npm install
```

Enter backend directory:

```bash
cd server
```

Install backend dependencies:

```bash
npm install
```

Return to project root:

```bash
cd ..
```

### 5.4 Create environment files

Create frontend env file from template:

```bash
cp .env.example .env
```

Create backend env file from template:

```bash
cp server/.env.example server/.env
```

Edit frontend env:

```bash
nano .env
```

Edit backend env:

```bash
nano server/.env
```

Minimum required values to set correctly:

- `VITE_AUTH_API_BASE_URL`
- `VITE_GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `CLIENT_ORIGIN`

### 5.5 Run the system (two terminals)

Terminal A: enter backend folder:

```bash
cd server
```

Terminal A: start backend:

```bash
npm run dev
```

Terminal B (project root): start frontend:

```bash
npm run dev
```

### 5.6 Verify backend health

Health check:

```bash
curl http://localhost:8080/health
```

If successful, open:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:8080/health`

---

## Project Structure (Short)

```text
.
|-- src/                 # React frontend
|-- server/              # Express auth/api backend
|-- docker/              # runtime config entrypoint
|-- Dockerfile           # frontend container build
|-- .env.example         # frontend env template
`-- server/.env.example  # backend env template
```

---

## Important OAuth Note

- `VITE_GOOGLE_CLIENT_ID` must be a full value ending with `.apps.googleusercontent.com`
- OAuth client type must be **Web application**
- Authorized JavaScript origins must exactly match the frontend URL

