# Sales Visit React App

A React Vite conversion of the Sales Visit tracking application.

## Installation & Setup

1. Navigate to the project directory:
```bash
cd sales-visit-react
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:3000`

## Features

- **Sales Visit Tracking**: Record shop visits with GPS location and selfies
- **Real-time Dashboard**: Month-to-date analytics and performance metrics  
- **Admin Panel**: Comprehensive analytics with interactive maps
- **Mobile Optimized**: Responsive design for field sales teams
- **Google Apps Script Backend**: Seamless integration with existing backend

## Components

- **SalesApp**: Main sales representative interface
- **AdminDashboard**: Management analytics and reporting
- **API Service**: Backend communication layer

## Backend Configuration

The app connects to the existing Google Apps Script backend:
```
https://script.google.com/macros/s/AKfycbxPuK8Vwl30zuyrutpLZfu81LYjPzPMUPCFBNxWzL-w5grgcx0vDtMBp9l5WJRuj2cC/exec
```

No backend changes are required - the React app maintains full compatibility with the existing API.

## Build for Production

```bash
npm run build
```

This creates a `dist` folder with production-ready files that can be deployed to any web server.