# Sales Visit App

A modern React-based sales visit tracking application with GPS location, camera integration, and comprehensive analytics dashboard.

## 🚀 Live Demo
[https://your-vercel-url.vercel.app](https://your-vercel-url.vercel.app)

## 📁 Project Structure

```
MNFSalesVisit/
├── src/
│   ├── components/
│   │   ├── SalesApp.jsx        # Main sales interface
│   │   └── AdminDashboard.jsx  # Admin analytics
│   ├── services/
│   │   └── api.js             # Google Apps Script API
│   ├── App.jsx                # Router configuration
│   ├── main.jsx               # React entry point
│   └── index.css              # Global styles
├── backend/
│   ├── code.gs                # Google Apps Script server
│   └── README.md              # Backend documentation
├── docs/
│   ├── API.md                 # API documentation
│   └── DEPLOYMENT.md          # Deployment guide
├── dist/                      # Built files (auto-generated)
├── package.json               # Dependencies & scripts
├── vite.config.js            # Build configuration
└── vercel.json               # Deployment config
```

## ✨ Features

### Sales Representatives
- **🔐 Secure Login** - National ID and password authentication
- **📍 GPS Tracking** - Automatic location capture (3-second timeout)
- **📸 Photo Verification** - Selfie capture for visit proof
- **🏪 Visit Recording** - Shop details, sales status, and reasons
- **📦 SKU Management** - Product quantities (Chicken, Beef, Supa Mojo)
- **📊 Personal Dashboard** - Month-to-date statistics and efficiency

### Admin Dashboard
- **🗺️ Interactive Maps** - Visit locations with Leaflet integration
- **📈 Analytics** - User and regional performance metrics
- **📅 Time Filtering** - Daily, weekly, monthly reporting
- **📋 Data Export** - CSV export functionality
- **🔍 Visit Details** - Photo viewing and visit information

### Technical Features
- **⚡ Fast Performance** - Vite build system
- **📱 Mobile Optimized** - Responsive design for field use
- **🌙 Dark Mode** - Toggle between light and dark themes
- **🔄 Real-time Updates** - Instant dashboard refresh
- **☁️ Cloud Backend** - Google Apps Script integration

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite, Bootstrap 5
- **Routing:** React Router DOM
- **Maps:** Leaflet, React Leaflet
- **Backend:** Google Apps Script
- **Database:** Google Sheets
- **Deployment:** Vercel
- **Styling:** CSS Custom Properties, Bootstrap

## 🚀 Quick Start

### Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Backend Setup
1. Open [Google Apps Script](https://script.google.com)
2. Create new project and copy `backend/code.gs`
3. Deploy as web app and update API URL in `src/services/api.js`

### Deployment
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions.

## 📖 Documentation

- **[API Documentation](docs/API.md)** - Backend endpoints and responses
- **[Deployment Guide](docs/DEPLOYMENT.md)** - How to deploy to various platforms
- **[Backend Setup](backend/README.md)** - Google Apps Script configuration

## 🔧 Configuration

### GPS Timeout
Location timeout is optimized to 3 seconds for better user experience:
```javascript
{ enableHighAccuracy: true, timeout: 3000 }
```

### Available Regions
- Mvita
- Nyali  
- Kisauni
- Likoni
- Changamwe
- Jomvu

### Product SKUs
- Chicken
- Beef
- Supa Mojo

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For support, email [mnfsalesvisit@gmail.com](mailto:mnfsalesvisit@gmail.com)

---

Built with ❤️ for efficient sales team management