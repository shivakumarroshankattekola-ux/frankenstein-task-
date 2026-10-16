# JARVIS Task Command Center

A responsive, neon-blue sci-fi task dashboard inspired by the supplied JARVIS reference. Frontend: HTML, CSS, Bootstrap 5, JavaScript. Backend/database: Google Apps Script + Google Sheets. Deploy the static frontend to Vercel.

## Features
- Create, edit, complete/uncomplete, and delete tasks
- Task title, description, priority, due date/time, and category
- Desktop and in-dashboard reminders 15 minutes before a deadline
- Overdue alerts for incomplete tasks
- Search and filters (All, Today, Pending, Completed, priority)
- Dashboard stats and completion ring
- Responsive layout for desktop, tablet, and mobile
- Google Sheets persistence through Apps Script

## 1. Create the Google Sheet
1. Create a new Google Spreadsheet.
2. Open **Extensions → Apps Script**.
3. Replace the editor contents with `apps-script/Code.gs`.
4. In `Code.gs`, set `SPREADSHEET_ID` to the ID in your spreadsheet URL. For a URL like `https://docs.google.com/spreadsheets/d/abc123/edit`, the ID is `abc123`.
5. Save. Select `setupSheet` from the function dropdown and click **Run**. Approve the requested permissions.
6. The script creates a `Tasks` tab with these columns: ID, Title, Description, Priority, Due Date, Category, Completed, Created At, Updated At, Due Time. Existing sheets gain the Due Time column automatically when the script next runs.

## 2. Deploy Apps Script as a Web App
1. Click **Deploy → New deployment**.
2. Select type **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone** (required for this public static frontend).
5. Click Deploy, authorize if prompted, and copy the URL ending in `/exec`.
6. If you edit the Apps Script later, use **Deploy → Manage deployments → Edit → New version → Deploy**.

> Security note: anyone who can access the deployed endpoint can read, add, change, and delete tasks. This starter is suitable for a personal/demo project, not confidential or multi-user data. Do not store sensitive information. For a private or multi-user production app, add authentication and server-side authorization.

## 3. Connect the frontend
Open `js/app.js` and replace:
```js
const API_URL = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";
```
with your deployed `/exec` URL. Keep the URL inside quotes. Save the file.

## 4. Test locally
Open `index.html` with a local static server (recommended: VS Code Live Server), or deploy to Vercel. Verify the Apps Script URL has been added and the Sheet is connected.

## 5. Reminders
1. Create or edit a task with both a due date and due time. If no time is supplied, reminders treat the deadline as 11:59 PM local browser time.
2. Open the dashboard and click the bell icon beside Refresh. Allow desktop notifications when your browser asks.
3. The dashboard checks reminders every 30 seconds. Upcoming reminders fire during the 15 minutes before a deadline; overdue tasks alert once per day while incomplete.

Reminders run in the browser, so the dashboard must remain open for alerts. Browser notification permission must be allowed for desktop popups; the in-dashboard toast is also shown. This is not a server-side push notification system.

## 6. Deploy to Vercel
1. Put `index.html`, `css/`, and `js/` at the root of a GitHub repository. The `apps-script/` folder is source reference only; it does not need to be served by Vercel.
2. Import the repository in Vercel.
3. Framework Preset: **Other**.
4. Build Command: leave empty.
5. Output Directory: `.` (or leave the default for a plain static project).
6. Deploy.

## Troubleshooting
- **Unable to connect / failed to fetch:** confirm the `/exec` URL, redeploy the Apps Script as a Web App, and set access to Anyone. Try opening the URL in a browser; it should return JSON.
- **Google sign-in / authorization page:** authorize the script owner, then redeploy. The web app must be accessible to the intended audience.
- **Changes in Code.gs do not appear:** create a new deployment version.
- **Sheet tab missing:** run `setupSheet()` once in the Apps Script editor.
- **Tasks don't save:** open browser DevTools → Console and check the returned error message.

## Project structure
```text
jarvis-todo-dashboard/
├── index.html
├── css/
│   ├── style.css
│   └── responsive.css
├── js/
│   └── app.js
├── apps-script/
│   └── Code.gs
└── README.md
```
