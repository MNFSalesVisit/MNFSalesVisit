# Sales Visit App - Backend

## Google Apps Script Integration

This folder contains the backend code for the Sales Visit App.

### Files:
- `code.gs` - Google Apps Script server code

### Setup:
1. Open [Google Apps Script](https://script.google.com)
2. Create a new project
3. Copy the contents of `code.gs` into the script editor
4. Save and deploy as a web app
5. Update the `BACKEND_URL` in `src/services/api.js` with your deployed URL

### API Endpoints:
- `login` - User authentication
- `saveVisit` - Save visit records
- `dashboard` - Get user analytics
- `getAllVisits` - Get all visits (admin)
- `adminSummary` - Get aggregated data (admin)

### Database:
Uses Google Sheets with two sheets:
- `Users` - Store user credentials and roles
- `Visits` - Store visit records and analytics