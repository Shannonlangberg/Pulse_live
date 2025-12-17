# Futures Pulse v1 - Production

Production deployment repository for Pulse v1 core features.

## Features
- Homepage
- Input/Stats logging (Campus Pastors, Senior Leaders, Admin)
- Dashboards (role-based)
- Resources (Google Drive integration)
- Settings:
  - Campus Management
  - User Management
  - Role Manager
  - Profile Settings
  - Resource Manager

## Deployment

Deployed via Railway to futures.pulse.com

## Environment Variables

See ENV_TEMPLATE.txt for required environment variables. Configure these in Railway's environment variables panel - never commit actual secrets to git.

## Setup

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
npm run build
```

## Tech Stack

**Backend:**
- Python 3.10+
- Flask
- SQLite (default) / Postgres (optional)
- Google Sheets API
- Google OAuth (Drive)

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- Chart.js

## Support

Contact: shannon.langberg@futures.church

