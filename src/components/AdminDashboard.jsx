import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { apiService } from '../services/api';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];

const AdminDashboard = () => {
  const navigate = useNavigate();
  
  // UI State
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // State management
  const [currentUser, setCurrentUser] = useState(null);
  const [allVisits, setAllVisits] = useState([]);
  const [allUplifts, setAllUplifts] = useState([]);
  const [summaryData, setSummaryData] = useState({ users: [], regions: [], timeseries: { daily: [], weekly: [], monthly: [] } });
  const [totals, setTotals] = useState({ visits: 0, sold: 0, cartons: 0 });
  const [mapCenter, setMapCenter] = useState([-1.286389, 36.817223]); // Nairobi
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [mapType, setMapType] = useState('visits'); // 'visits' or 'uplifts'
  
  // Uplift verification state
  const [pendingUplifts, setPendingUplifts] = useState([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedUplift, setSelectedUplift] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  
  // Filter state
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    month: "",
    type: "monthly",
    salesperson: ""
  });

  // Targets state
  const [allTargets, setAllTargets] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [targetEdits, setTargetEdits] = useState({});

  // Auth check and initial data load
  useEffect(() => {
    const session = localStorage.getItem("userSession");
    if (!session) {
      alert("Not logged in.");
      navigate('/');
      return;
    }

    const user = JSON.parse(session);
    if (!user.role || user.role.toLowerCase() !== "admin") {
      alert("Unauthorized. This page is for admins only.");
      navigate('/');
      return;
    }

    setCurrentUser(user);
    fetchAllVisits();
    fetchAllUplifts();
    loadSummary();
    fetchPendingUplifts();
    fetchAllTargets();
    fetchUsers();
  }, [navigate]);

  // Fetch all visits
  const fetchAllVisits = async () => {
    try {
      const visits = await apiService.getAllVisits();
      setAllVisits(visits);
    } catch (error) {
      console.error('Failed to fetch visits:', error);
      setAllVisits([]);
    }
  };

  // Fetch all uplifts
  const fetchAllUplifts = async () => {
    try {
      const uplifts = await apiService.getAllUpliftVisits();
      setAllUplifts(uplifts);
    } catch (error) {
      console.error('Failed to fetch uplifts:', error);
      setAllUplifts([]);
    }
  };

  // Load summary data
  const loadSummary = async () => {
    const params = {
      type: filters.type,
      month: filters.month ? Number(filters.month) : null,
      year: Number(filters.year),
      salesperson: filters.salesperson || null
    };

    try {
      const data = await apiService.getAdminSummary(params);
      setSummaryData(data);

      // Calculate totals
      let totalVisits = 0, totalSold = 0, totalCartons = 0;
      data.users.forEach(user => {
        totalVisits += user.visits;
        totalSold += user.sold;
        totalCartons += user.cartons;
      });
      setTotals({ visits: totalVisits, sold: totalSold, cartons: totalCartons });

    } catch (error) {
      console.error('Failed to load summary:', error);
    }
  };

  // Fetch pending uplifts
  const fetchPendingUplifts = async () => {
    try {
      const uplifts = await apiService.getPendingUplifts();
      setPendingUplifts(uplifts);
    } catch (error) {
      console.error('Failed to fetch pending uplifts:', error);
      setPendingUplifts([]);
    }
  };

  // Approve uplift
  const handleApproveUplift = async (uplift) => {
    if (!confirm(`Approve uplift from ${uplift.name} for ${uplift.totalCartons} cartons?`)) {
      return;
    }

    try {
      await apiService.approveUplift(uplift.rowIndex, currentUser.name);
      alert('Uplift approved successfully!');
      fetchPendingUplifts();
    } catch (error) {
      console.error('Failed to approve uplift:', error);
      alert('Failed to approve uplift. Please try again.');
    }
  };

  // Show reject modal
  const showRejectModalFor = (uplift) => {
    setSelectedUplift(uplift);
    setRejectionReason("");
    setShowRejectModal(true);
  };

  // Reject uplift
  const handleRejectUplift = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason.');
      return;
    }

    try {
      await apiService.rejectUplift(selectedUplift.rowIndex, rejectionReason, currentUser.name);
      alert('Uplift rejected successfully!');
      setShowRejectModal(false);
      setSelectedUplift(null);
      setRejectionReason("");
      fetchPendingUplifts();
    } catch (error) {
      console.error('Failed to reject uplift:', error);
      alert('Failed to reject uplift. Please try again.');
    }
  };

  // Fetch all targets
  const fetchAllTargets = async () => {
    try {
      const targets = await apiService.getAllTargets();
      setAllTargets(targets);
    } catch (error) {
      console.error('Failed to fetch targets:', error);
      setAllTargets([]);
    }
  };

  // Fetch all users
  const fetchUsers = async () => {
    try {
      const uniqueUsers = {};
      allVisits.forEach(visit => {
        if (visit.nationalID && !uniqueUsers[visit.nationalID]) {
          uniqueUsers[visit.nationalID] = {
            nationalID: visit.nationalID,
            name: visit.name || visit.nationalID
          };
        }
      });
      setAllUsers(Object.values(uniqueUsers));
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setAllUsers([]);
    }
  };

  // Handle target input change
  const handleTargetChange = (nationalID, field, value) => {
    setTargetEdits(prev => ({
      ...prev,
      [nationalID]: {
        ...prev[nationalID],
        [field]: value
      }
    }));
  };

  // Get target value for display
  const getTargetValue = (nationalID, field) => {
    if (targetEdits[nationalID] && targetEdits[nationalID][field] !== undefined) {
      return targetEdits[nationalID][field];
    }
    const existing = allTargets.find(t => t.nationalID === nationalID);
    return existing ? existing[field] : 0;
  };

  // Save target for a user
  const handleSaveTarget = async (user) => {
    const dailyTarget = getTargetValue(user.nationalID, 'dailyTarget');
    const weeklyTarget = getTargetValue(user.nationalID, 'weeklyTarget');
    const monthlyTarget = getTargetValue(user.nationalID, 'monthlyTarget');

    try {
      const result = await apiService.setUserTargets(
        user.nationalID,
        user.name,
        dailyTarget,
        weeklyTarget,
        monthlyTarget
      );

      if (result.success) {
        alert(`Targets saved for ${user.name}`);
        fetchAllTargets();
        // Clear edits for this user
        setTargetEdits(prev => {
          const newEdits = { ...prev };
          delete newEdits[user.nationalID];
          return newEdits;
        });
      } else {
        alert('Failed to save targets');
      }
    } catch (error) {
      console.error('Error saving targets:', error);
      alert('Failed to save targets');
    }
  };

  // Filter visits for map display
  const getFilteredVisits = () => {
    return allVisits.filter(visit => {
      if (!visit.timestamp) return false;
      const visitDate = new Date(visit.timestamp);
      
      // Filter by year and month
      if (filters.month) {
        const monthMatch = (visitDate.getMonth() + 1) === Number(filters.month) && 
                          visitDate.getFullYear() === Number(filters.year);
        if (!monthMatch) return false;
      } else {
        if (visitDate.getFullYear() !== Number(filters.year)) return false;
      }
      
      // Filter by salesperson if selected
      if (filters.salesperson) {
        const matchesName = visit.name && visit.name.toLowerCase().includes(filters.salesperson.toLowerCase());
        const matchesID = visit.nationalID && visit.nationalID.toLowerCase().includes(filters.salesperson.toLowerCase());
        if (!matchesName && !matchesID) return false;
      }
      
      return true;
    });
  };

  // Generate unique salespeople list
  const getSalespeopleOptions = () => {
    const uniqueNames = new Set();
    allVisits.forEach(visit => {
      if (visit.name) {
        uniqueNames.add(visit.name);
      }
    });
    return Array.from(uniqueNames).sort();
  };

  // Generate year options
  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 3; y--) {
      years.push(y);
    }
    return years;
  };

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  // Export CSV
  const exportCSV = () => {
    if (!allVisits || allVisits.length === 0) {
      alert("No visits to export");
      return;
    }

    const headers = [
      "timestamp", "nationalID", "name", "region", "shopName", 
      "sold", "skus", "totalCartons", "reason", "longitude", "latitude"
    ];
    
    const csvContent = [
      headers.join(","),
      ...allVisits.map(visit => [
        visit.timestamp ? new Date(visit.timestamp).toISOString() : "",
        csvSafe(visit.nationalID),
        csvSafe(visit.name),
        csvSafe(visit.region),
        csvSafe(visit.shopName),
        csvSafe(visit.sold),
        csvSafe(visit.skus),
        csvSafe(String(visit.totalCartons || 0)),
        csvSafe(visit.reason),
        csvSafe(String(visit.longitude || "")),
        csvSafe(String(visit.latitude || ""))
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `visits_export_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // Download map as HTML
  const downloadMapHTML = () => {
    const filteredVisits = getFilteredVisits();
    
    if (filteredVisits.length === 0) {
      alert("No visits to display on map");
      return;
    }

    // Generate markers JavaScript
    const markersJS = filteredVisits.map(visit => {
      const lat = Number(visit.latitude);
      const lng = Number(visit.longitude);
      
      if (!lat || !lng) return null;
      
      const popupContent = `
        <div style="min-width: 180px; text-align: center;">
          <strong>${visit.name || visit.nationalID}</strong><br />
          <small>${visit.shopName || ''}</small><br />
          <small>${visit.region || ''}</small><br />
          <small>${new Date(visit.timestamp).toLocaleString()}</small>
          ${visit.selfie ? `<br /><img src="${visit.selfie}" style="width: 160px; border-radius: 8px; display: block; margin: 6px auto;" alt="Visit selfie" />` : ''}
          <div style="margin-top: 6px;">
            <strong>Sold:</strong> ${visit.sold || 'No'}<br />
            <strong>Cartons:</strong> ${visit.totalCartons || 0}
            ${visit.reason ? `<br /><strong>Reason:</strong> ${visit.reason}` : ''}
          </div>
        </div>
      `.replace(/\n/g, '').replace(/"/g, '\\"');
      
      return `L.marker([${lat}, ${lng}]).addTo(map).bindPopup("${popupContent}");`;
    }).filter(marker => marker !== null).join('\n        ');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sales Visits Map - ${new Date().toLocaleDateString()}</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        #map { height: 100vh; width: 100%; }
        .header { 
            position: absolute; 
            top: 10px; 
            left: 10px; 
            z-index: 1000; 
            background: white; 
            padding: 10px; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header h3 { margin: 0 0 5px 0; color: #333; }
        .header p { margin: 0; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="header">
        <h3>Sales Visits Map</h3>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <p>Total Visits: ${filteredVisits.length}</p>
        ${filters.salesperson ? `<p>Salesperson: ${filters.salesperson}</p>` : ''}
        ${filters.month ? `<p>Period: ${filters.month}/${filters.year}</p>` : `<p>Year: ${filters.year}</p>`}
    </div>
    <div id="map"></div>
    
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        // Initialize map
        var map = L.map('map').setView([${mapCenter[0]}, ${mapCenter[1]}], 11);
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // Add markers
        ${markersJS}
        
        // Fit bounds to markers if there are any
        var group = new L.featureGroup();
        map.eachLayer(function(layer) {
            if (layer instanceof L.Marker) {
                group.addLayer(layer);
            }
        });
        if (group.getLayers().length > 0) {
            map.fitBounds(group.getBounds().pad(0.1));
        }
    </script>
</body>
</html>`;

    // Download the HTML file
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    // Generate filename with current filters
    const dateStr = new Date().toISOString().slice(0,10);
    const filterStr = filters.salesperson ? `_${filters.salesperson.replace(/\s+/g, '_')}` : '';
    const periodStr = filters.month ? `_${filters.month}-${filters.year}` : `_${filters.year}`;
    
    link.download = `sales_visits_map${filterStr}${periodStr}_${dateStr}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // CSV safe string formatting
  const csvSafe = (value) => {
    if (value === null || value === undefined) return "";
    const str = String(value).replace(/"/g, '""');
    if (str.includes(",") || str.includes("\n")) return `"${str}"`;
    return str;
  };

  // Show visit details modal
  const showVisitDetails = (visit) => {
    setSelectedVisit(visit);
    setShowModal(true);
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("userSession");
    navigate('/');
  };

  // Go back to main app
  const goBack = () => {
    navigate('/');
  };

  const filteredVisits = getFilteredVisits();

  // Get filtered uplifts for map
  const getFilteredUplifts = () => {
    return allUplifts.filter(uplift => {
      if (!uplift.timestamp) return false;
      const upliftDate = new Date(uplift.timestamp);
      
      // Filter by year and month
      if (filters.month) {
        const monthMatch = (upliftDate.getMonth() + 1) === Number(filters.month) && 
                          upliftDate.getFullYear() === Number(filters.year);
        if (!monthMatch) return false;
      } else {
        if (upliftDate.getFullYear() !== Number(filters.year)) return false;
      }
      
      // Filter by salesperson if selected
      if (filters.salesperson) {
        const matchesName = uplift.name && uplift.name.toLowerCase().includes(filters.salesperson.toLowerCase());
        const matchesID = uplift.nationalID && uplift.nationalID.toLowerCase().includes(filters.salesperson.toLowerCase());
        if (!matchesName && !matchesID) return false;
      }
      
      return true;
    });
  };

  const filteredUplifts = getFilteredUplifts();

  // Export functions for analytics
  const exportUserCSV = () => {
    const headers = ["Name", "National ID", "Visits", "Sold", "Cartons", "Efficiency"];
    const csvContent = [
      headers.join(","),
      ...summaryData.users.map(user => [
        csvSafe(user.name),
        csvSafe(user.nationalID),
        user.visits,
        user.sold,
        user.cartons,
        user.efficiency
      ].join(","))
    ].join("\n");

    downloadCSV(csvContent, `user_performance_${new Date().toISOString().slice(0,10)}.csv`);
  };

  const exportRegionCSV = () => {
    const headers = ["Region", "Visits", "Sold", "Cartons", "Efficiency"];
    const csvContent = [
      headers.join(","),
      ...summaryData.regions.map(region => [
        csvSafe(region.region),
        region.visits,
        region.sold,
        region.cartons,
        region.efficiency
      ].join(","))
    ].join("\n");

    downloadCSV(csvContent, `region_performance_${new Date().toISOString().slice(0,10)}.csv`);
  };

  const downloadCSV = (content, filename) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // Export map for current map type
  const exportCurrentMap = () => {
    if (mapType === 'visits') {
      downloadMapHTML();
    } else {
      downloadUpliftMapHTML();
    }
  };

  // Download uplift map as HTML
  const downloadUpliftMapHTML = () => {
    if (filteredUplifts.length === 0) {
      alert("No uplifts to display on map");
      return;
    }

    const markersJS = filteredUplifts.map(uplift => {
      const lat = Number(uplift.latitude);
      const lng = Number(uplift.longitude);
      
      if (!lat || !lng) return null;
      
      const statusColor = uplift.status === 'Approved' ? 'green' : uplift.status === 'Rejected' ? 'red' : 'orange';
      
      const popupContent = `
        <div style="min-width: 180px; text-align: center;">
          <strong>${uplift.name || uplift.nationalID}</strong><br />
          <small>${uplift.shopName || ''}</small><br />
          <small>${uplift.region || ''}</small><br />
          <small>${new Date(uplift.timestamp).toLocaleString()}</small>
          <div style="margin: 8px 0;">
            <span style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${uplift.status}</span>
          </div>
          ${uplift.receiptPhoto ? `<br /><img src="${uplift.receiptPhoto}" style="width: 160px; border-radius: 8px; display: block; margin: 6px auto;" alt="Receipt" />` : ''}
          <div style="margin-top: 6px;">
            <strong>Cartons:</strong> ${uplift.totalCartons || 0}<br />
            <strong>SKUs:</strong> ${uplift.skus || ''}
            ${uplift.rejectionReason ? `<br /><strong>Reason:</strong> ${uplift.rejectionReason}` : ''}
          </div>
        </div>
      `.replace(/\n/g, '').replace(/"/g, '\\"');
      
      return `L.marker([${lat}, ${lng}], {
        icon: L.divIcon({
          className: 'custom-marker',
          html: '<div style="background: ${statusColor}; width: 25px; height: 25px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
          iconSize: [25, 25]
        })
      }).addTo(map).bindPopup("${popupContent}");`;
    }).filter(marker => marker !== null).join('\n        ');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Uplift Map - ${new Date().toLocaleDateString()}</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        #map { height: 100vh; width: 100%; }
        .header { 
            position: absolute; 
            top: 10px; 
            left: 10px; 
            z-index: 1000; 
            background: white; 
            padding: 10px; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header h3 { margin: 0 0 5px 0; color: #333; }
        .header p { margin: 0; color: #666; font-size: 14px; }
        .legend {
            position: absolute;
            bottom: 30px;
            right: 10px;
            background: white;
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
        }
        .legend-item { display: flex; align-items: center; margin: 4px 0; }
        .legend-color { width: 20px; height: 20px; border-radius: 50%; margin-right: 8px; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
    </style>
</head>
<body>
    <div class="header">
        <h3>Uplift Map</h3>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <p>Total Uplifts: ${filteredUplifts.length}</p>
        ${filters.salesperson ? `<p>Salesperson: ${filters.salesperson}</p>` : ''}
        ${filters.month ? `<p>Period: ${filters.month}/${filters.year}</p>` : `<p>Year: ${filters.year}</p>`}
    </div>
    <div class="legend">
        <strong>Status</strong>
        <div class="legend-item"><div class="legend-color" style="background: green;"></div><span>Approved</span></div>
        <div class="legend-item"><div class="legend-color" style="background: orange;"></div><span>Pending</span></div>
        <div class="legend-item"><div class="legend-color" style="background: red;"></div><span>Rejected</span></div>
    </div>
    <div id="map"></div>
    
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        var map = L.map('map').setView([${mapCenter[0]}, ${mapCenter[1]}], 11);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        ${markersJS}
        
        var group = new L.featureGroup();
        map.eachLayer(function(layer) {
            if (layer instanceof L.Marker) {
                group.addLayer(layer);
            }
        });
        if (group.getLayers().length > 0) {
            map.fitBounds(group.getBounds().pad(0.1));
        }
    </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    const dateStr = new Date().toISOString().slice(0,10);
    const filterStr = filters.salesperson ? `_${filters.salesperson.replace(/\s+/g, '_')}` : '';
    const periodStr = filters.month ? `_${filters.month}-${filters.year}` : `_${filters.year}`;
    
    link.download = `uplift_map${filterStr}${periodStr}_${dateStr}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ 
      padding: '24px', 
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', 
      minHeight: '100vh',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
          }
          
          .dashboard-card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.9);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(10px);
          }
          
          .dashboard-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
          }
          
          .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 20px;
            padding: 24px;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
          }
          
          .stat-card::before {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 100px;
            height: 100px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            transform: translate(30px, -30px);
          }
          
          .stat-card:hover {
            transform: translateY(-4px) scale(1.02);
            box-shadow: 0 12px 40px rgba(102, 126, 234, 0.3);
          }
          
          .btn-primary-custom {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            color: white;
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 600;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
          }
          
          .btn-primary-custom:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
            color: white;
          }
          
          .btn-secondary-custom {
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            color: #495057;
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 500;
            transition: all 0.3s ease;
          }
          
          .btn-secondary-custom:hover {
            background: #e9ecef;
            border-color: #dee2e6;
            transform: translateY(-2px);
            color: #495057;
          }
          
          .modern-input {
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 12px;
            padding: 12px 16px;
            transition: all 0.3s ease;
            color: #495057;
            font-weight: 500;
          }
          
          .modern-input:focus {
            background: white;
            border-color: #667eea;
            box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
            color: #495057;
          }
          
          .modern-input option {
            background: white;
            color: #495057;
            padding: 8px;
          }
          
          .data-table {
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          }
          
          .data-table thead th {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            color: #495057;
            font-weight: 600;
            padding: 16px;
            border: none;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .data-table tbody td {
            padding: 16px;
            border: none;
            border-bottom: 1px solid #f1f3f4;
            color: #495057;
            font-weight: 500;
          }
          
          .data-table tbody tr:hover {
            background: #f8f9fa;
          }
          
          .data-table tbody tr:last-child td {
            border-bottom: none;
          }
          
          .section-title {
            color: #2d3748;
            font-weight: 700;
            font-size: 20px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .section-subtitle {
            color: #718096;
            font-size: 14px;
            margin-bottom: 20px;
          }
          
          .filter-label {
            color: #4a5568;
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 8px;
            display: block;
          }
          
          .map-container {
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            border: 4px solid white;
          }
          
          .efficiency-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
          }
          
          .efficiency-high { background: #d4edda; color: #155724; }
          .efficiency-medium { background: #fff3cd; color: #856404; }
          .efficiency-low { background: #f8d7da; color: #721c24; }
        `}
      </style>
      {/* Header */}
      <div className="dashboard-card p-4 mb-4" style={{
        animation: 'slideUp 0.6s ease-out',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <div style={{
              width: '60px',
              height: '60px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '20px',
              backdropFilter: 'blur(10px)'
            }}>
              <span style={{ fontSize: '28px' }}>📊</span>
            </div>
            <div>
              <h1 style={{ 
                margin: 0, 
                fontSize: '28px', 
                fontWeight: '700',
                letterSpacing: '-0.5px'
              }}>Sales Analytics</h1>
              <p style={{ 
                margin: 0, 
                opacity: 0.9, 
                fontSize: '16px',
                fontWeight: '400'
              }}>Comprehensive dashboard for sales performance tracking</p>
            </div>
          </div>
          <div className="d-flex align-items-center gap-4">
            <div className="text-end">
              <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '2px' }}>Logged in as</div>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>
                👤 {currentUser?.name || currentUser?.nationalID || 'Administrator'}
              </div>
            </div>
            <button className="btn" onClick={handleLogout} style={{
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              padding: '12px 24px',
              borderRadius: '12px',
              fontWeight: '500'
            }}>
              Logout →
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <div className="dashboard-card p-3 mb-4" style={{ animation: 'slideUp 0.7s ease-out 0.1s both' }}>
        <div className="d-flex gap-2 flex-wrap">
          <button 
            className={`btn ${activeTab === 'overview' ? 'btn-primary-custom' : 'btn-secondary-custom'}`}
            onClick={() => setActiveTab('overview')}
            style={{ flex: '1 1 auto', minWidth: '120px' }}
          >
            📊 Overview
          </button>
          <button 
            className={`btn ${activeTab === 'analytics' ? 'btn-primary-custom' : 'btn-secondary-custom'}`}
            onClick={() => setActiveTab('analytics')}
            style={{ flex: '1 1 auto', minWidth: '120px' }}
          >
            📈 Analytics
          </button>
          <button 
            className={`btn ${activeTab === 'map' ? 'btn-primary-custom' : 'btn-secondary-custom'}`}
            onClick={() => setActiveTab('map')}
            style={{ flex: '1 1 auto', minWidth: '120px' }}
          >
            🗺️ Map Analysis
          </button>
          <button 
            className={`btn ${activeTab === 'targets' ? 'btn-primary-custom' : 'btn-secondary-custom'}`}
            onClick={() => setActiveTab('targets')}
            style={{ flex: '1 1 auto', minWidth: '120px' }}
          >
            🎯 Set Targets
          </button>
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
      <div className="row g-3">
        {/* Left Panel - Controls */}
        <div className="col-lg-4" style={{ animation: 'slideUp 0.8s ease-out' }}>
          <div className="dashboard-card p-4 mb-4">
            <div className="section-title">🔍 Filters & Controls</div>
            <div className="section-subtitle">Customize your data view and export options</div>
            
            <div className="mb-3">
              <label className="filter-label">📅 Year</label>
              <select 
                className="form-select modern-input"
                value={filters.year}
                onChange={(e) => handleFilterChange('year', e.target.value)}
              >
                {getYearOptions().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="filter-label">🗓️ Month</label>
              <select 
                className="form-select modern-input"
                value={filters.month}
                onChange={(e) => handleFilterChange('month', e.target.value)}
              >
                <option value="">All Months</option>
                <option value="1">January</option><option value="2">February</option>
                <option value="3">March</option><option value="4">April</option>
                <option value="5">May</option><option value="6">June</option>
                <option value="7">July</option><option value="8">August</option>
                <option value="9">September</option><option value="10">October</option>
                <option value="11">November</option><option value="12">December</option>
              </select>
            </div>

            <div className="mb-3">
              <label className="filter-label">⏱️ Period Type</label>
              <select 
                className="form-select modern-input"
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
              >
                <option value="daily">Daily View</option>
                <option value="weekly">Weekly View</option>
                <option value="monthly">Monthly View</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="filter-label">👤 Salesperson</label>
              <select 
                className="form-select modern-input"
                value={filters.salesperson}
                onChange={(e) => handleFilterChange('salesperson', e.target.value)}
              >
                <option value="">All Salespeople</option>
                {getSalespeopleOptions().map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div className="d-grid gap-3">
              <button className="btn btn-primary-custom" onClick={loadSummary}>
                📈 Update Dashboard
              </button>
              <button className="btn btn-secondary-custom" onClick={exportCSV}>
                📊 Export Data (CSV)
              </button>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="stat-card" style={{ animation: 'slideUp 1s ease-out' }}>
            <div className="section-title" style={{ color: 'white', marginBottom: '16px' }}>📈 Quick Overview</div>
            <div className="row g-0">
              <div className="col-4 text-center">
                <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>{totals.visits}</div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>Total Visits</div>
              </div>
              <div className="col-4 text-center">
                <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px', color: '#4CAF50' }}>{totals.sold}</div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>Sales Made</div>
              </div>
              <div className="col-4 text-center">
                <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px', color: '#FFC107' }}>{totals.cartons}</div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>Cartons Sold</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Data */}
        <div className="col-lg-8" style={{ animation: 'slideUp 0.6s ease-out 0.2s both' }}>
          {/* Uplift Verification Requests */}
          <div className="dashboard-card p-4 mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <div className="section-title">
                  📦 Uplift Verification Requests
                  {pendingUplifts.length > 0 && (
                    <span 
                      className="badge bg-danger ms-2" 
                      style={{ 
                        fontSize: '0.8rem', 
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'pulse 2s infinite'
                      }}
                    >
                      {pendingUplifts.length}
                    </span>
                  )}
                </div>
                <div className="section-subtitle">Review and approve stock uplift requests</div>
              </div>
            </div>
            
            {pendingUplifts.length === 0 ? (
              <div className="text-center text-muted py-4">
                <i className="bi bi-check-circle" style={{ fontSize: '3rem' }}></i>
                <p className="mt-2">No pending uplift requests</p>
              </div>
            ) : (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {pendingUplifts.map((uplift, index) => (
                  <div 
                    key={index} 
                    className="card mb-3"
                    style={{ 
                      border: '1px solid #dee2e6',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}
                  >
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-3">
                          <div className="mb-2">
                            <small className="text-muted">Receipt Photo</small>
                            {uplift.receiptPhoto ? (
                              <>
                                <img 
                                  src={uplift.receiptPhoto} 
                                  alt="Receipt" 
                                  style={{
                                    width: '100%',
                                    maxWidth: '200px',
                                    borderRadius: '8px',
                                    border: '2px solid #ddd',
                                    cursor: 'pointer',
                                    display: 'block',
                                    marginBottom: '8px'
                                  }}
                                  onClick={() => window.open(uplift.receiptPhoto, '_blank')}
                                />
                                <div className="d-flex gap-2">
                                  <button 
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => window.open(uplift.receiptPhoto, '_blank')}
                                  >
                                    <i className="bi bi-eye me-1"></i>View
                                  </button>
                                  <a 
                                    href={uplift.receiptPhoto} 
                                    download={`receipt_${uplift.nationalID}_${new Date(uplift.timestamp).toISOString().slice(0,10)}.jpg`}
                                    className="btn btn-sm btn-outline-success"
                                  >
                                    <i className="bi bi-download me-1"></i>Download
                                  </a>
                                </div>
                              </>
                            ) : (
                              <div className="text-muted">No photo</div>
                            )}
                          </div>
                        </div>
                        <div className="col-md-6">
                          <h6 className="mb-2">
                            <i className="bi bi-person-circle me-2"></i>
                            {uplift.name}
                          </h6>
                          <div className="small mb-1">
                            <strong>National ID:</strong> {uplift.nationalID}
                          </div>
                          <div className="small mb-1">
                            <strong>Region:</strong> {uplift.region}
                          </div>
                          <div className="small mb-1">
                            <strong>Shop:</strong> {uplift.shopName}
                          </div>
                          <div className="small mb-1">
                            <strong>SKUs:</strong> {uplift.skus}
                          </div>
                          <div className="small mb-1">
                            <strong>Total Cartons:</strong> 
                            <span className="badge bg-primary ms-1">{uplift.totalCartons}</span>
                          </div>
                          <div className="small mb-1 text-muted">
                            <i className="bi bi-clock me-1"></i>
                            {new Date(uplift.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div className="col-md-3 d-flex flex-column justify-content-center">
                          <button 
                            className="btn btn-success btn-sm mb-2 w-100"
                            onClick={() => handleApproveUplift(uplift)}
                          >
                            <i className="bi bi-check-circle me-1"></i>
                            Approve
                          </button>
                          <button 
                            className="btn btn-danger btn-sm w-100"
                            onClick={() => showRejectModalFor(uplift)}
                          >
                            <i className="bi bi-x-circle me-1"></i>
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Map */}
          <div className="dashboard-card p-4 mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <div className="section-title">🗺️ Visit Locations</div>
                <div className="section-subtitle">Interactive map showing all filtered visits</div>
              </div>
              <button 
                className="btn btn-primary-custom"
                onClick={downloadMapHTML}
                title="Download current map view as HTML file"
              >
                📄 Export Map
              </button>
            </div>
            <div className="map-container" style={{ height: '400px' }}>
              <MapContainer
                center={mapCenter}
                zoom={11}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {filteredVisits.map((visit, index) => {
                  const lat = Number(visit.latitude);
                  const lng = Number(visit.longitude);
                  
                  if (!lat || !lng) return null;
                  
                  return (
                    <Marker key={index} position={[lat, lng]}>
                      <Popup>
                        <div style={{ minWidth: '180px' }}>
                          <strong>{visit.name || visit.nationalID}</strong><br />
                          <small>{visit.shopName || ''}</small><br />
                          <small>{visit.region || ''}</small><br />
                          <small>{new Date(visit.timestamp).toLocaleString()}</small>
                          {visit.selfie && (
                            <img 
                              src={visit.selfie} 
                              style={{
                                width: '160px',
                                borderRadius: '8px',
                                display: 'block',
                                margin: '6px auto'
                              }} 
                              alt="Visit selfie"
                            />
                          )}
                          <div style={{ textAlign: 'center', marginTop: '6px' }}>
                            <button 
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => showVisitDetails(visit)}
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </div>

          {/* Users Table */}
          <div className="dashboard-card p-4 mb-4" style={{ animation: 'slideUp 0.8s ease-out 0.4s both' }}>
            <div className="section-title">👥 Performance by User</div>
            <div className="section-subtitle">Individual salesperson performance metrics</div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table className="table data-table mb-0">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Visits</th>
                    <th>Sales</th>
                    <th>Cartons</th>
                    <th>Efficiency</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.users
                    .sort((a, b) => b.visits - a.visits)
                    .map((user, index) => {
                      const efficiency = parseInt(user.efficiency);
                      const badgeClass = efficiency >= 70 ? 'efficiency-high' : efficiency >= 40 ? 'efficiency-medium' : 'efficiency-low';
                      
                      return (
                        <tr key={index}>
                          <td style={{ fontWeight: '600' }}>{user.name || user.nationalID}</td>
                          <td>{user.visits}</td>
                          <td><span style={{ color: user.sold > 0 ? '#28a745' : '#dc3545', fontWeight: '600' }}>{user.sold}</span></td>
                          <td>{user.cartons}</td>
                          <td><span className={`efficiency-badge ${badgeClass}`}>{user.efficiency}%</span></td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Regions Table */}
          <div className="dashboard-card p-4 mb-4" style={{ animation: 'slideUp 1s ease-out 0.6s both' }}>
            <div className="section-title">🌍 Performance by Region</div>
            <div className="section-subtitle">Regional sales performance breakdown</div>
            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
              <table className="table data-table mb-0">
                <thead>
                  <tr>
                    <th>Region</th>
                    <th>Visits</th>
                    <th>Sales</th>
                    <th>Cartons</th>
                    <th>Efficiency</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.regions
                    .sort((a, b) => b.visits - a.visits)
                    .map((region, index) => {
                      const efficiency = parseInt(region.efficiency);
                      const badgeClass = efficiency >= 70 ? 'efficiency-high' : efficiency >= 40 ? 'efficiency-medium' : 'efficiency-low';
                      
                      return (
                        <tr key={index}>
                          <td style={{ fontWeight: '600' }}>{region.region}</td>
                          <td>{region.visits}</td>
                          <td><span style={{ color: region.sold > 0 ? '#28a745' : '#dc3545', fontWeight: '600' }}>{region.sold}</span></td>
                          <td>{region.cartons}</td>
                          <td><span className={`efficiency-badge ${badgeClass}`}>{region.efficiency}%</span></td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Time Series Table */}
          <div className="dashboard-card p-4" style={{ animation: 'slideUp 1.2s ease-out 0.8s both' }}>
            <div className="section-title">📈 Time Series Analysis</div>
            <div className="section-subtitle">{filters.type.charAt(0).toUpperCase() + filters.type.slice(1)} performance trends</div>
            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
              <table className="table data-table mb-0">
                <thead>
                  <tr>
                    <th>{filters.type === 'daily' ? 'Date' : filters.type === 'weekly' ? 'Week' : 'Month'}</th>
                    <th>Visits</th>
                    <th>Sold</th>
                    <th>Cartons</th>
                    <th>Efficiency</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.timeseries && summaryData.timeseries[filters.type] &&
                    summaryData.timeseries[filters.type]
                      .sort((a, b) => {
                        const aKey = a.date || a.week || a.month;
                        const bKey = b.date || b.week || b.month;
                        return bKey.localeCompare(aKey);
                      })
                      .map((item, index) => {
                        const displayKey = item.date || item.week || item.month;
                        const formattedKey = filters.type === 'daily' 
                          ? new Date(displayKey).toLocaleDateString()
                          : displayKey;
                        
                        return (
                          <tr key={index}>
                            <td>{formattedKey}</td>
                            <td>{item.visits}</td>
                            <td>{item.sold}</td>
                            <td>{item.cartons}</td>
                            <td>{item.efficiency}%</td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      )}{/* End Overview Tab */}

      {/* ANALYTICS TAB */}
      {activeTab === 'analytics' && (
      <div className="dashboard-card p-4" style={{ animation: 'slideUp 0.6s ease-out' }}>
        <div className="section-title">📊 Analytics Dashboard</div>
        <div className="section-subtitle">Detailed performance analytics and insights</div>
        <div className="text-center text-muted py-5">
          <i className="bi bi-bar-chart" style={{ fontSize: '4rem' }}></i>
          <p className="mt-3">Advanced analytics features coming soon</p>
          <p className="small">Charts, graphs, and detailed performance breakdowns will be available here</p>
        </div>
      </div>
      )}

      {/* MAP ANALYSIS TAB */}
      {activeTab === 'map' && (
      <div className="dashboard-card p-4" style={{ animation: 'slideUp 0.6s ease-out' }}>
        <div className="section-title">🗺️ Map Analysis</div>
        <div className="section-subtitle">Geographic analysis of sales activities</div>
        <div className="text-center text-muted py-5">
          <i className="bi bi-map" style={{ fontSize: '4rem' }}></i>
          <p className="mt-3">Interactive map analysis features coming soon</p>
          <p className="small">Heat maps, route optimization, and territory analysis will be available here</p>
        </div>
      </div>
      )}

      {/* SET TARGETS TAB */}
      {activeTab === 'targets' && (
      <div className="dashboard-card p-4" style={{ animation: 'slideUp 0.6s ease-out' }}>
        <div className="section-title">🎯 Sales Targets Management</div>
        <div className="section-subtitle">Set daily, weekly, and monthly sales targets for each user (measured in cartons sold)</div>
        
        <div className="mb-4">
          <button 
            className="btn btn-primary-custom"
            onClick={() => {
              fetchAllTargets();
              fetchUsers();
            }}
          >
            🔄 Refresh Data
          </button>
        </div>

        {allUsers.length === 0 ? (
          <div className="text-center text-muted py-5">
            <i className="bi bi-people" style={{ fontSize: '4rem' }}></i>
            <p className="mt-3">No users found</p>
            <p className="small">Users will appear here once visits are recorded</p>
          </div>
        ) : (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table className="table data-table mb-0">
              <thead>
                <tr>
                  <th>National ID</th>
                  <th>Name</th>
                  <th>Daily Target (Cartons)</th>
                  <th>Weekly Target (Cartons)</th>
                  <th>Monthly Target (Cartons)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((user, index) => {
                  const hasChanges = targetEdits[user.nationalID] !== undefined;
                  return (
                    <tr key={index}>
                      <td style={{ fontWeight: '600' }}>{user.nationalID}</td>
                      <td style={{ fontWeight: '600' }}>{user.name}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          className="form-control form-control-sm modern-input"
                          style={{ width: '140px' }}
                          value={getTargetValue(user.nationalID, 'dailyTarget')}
                          onChange={(e) => handleTargetChange(user.nationalID, 'dailyTarget', e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          className="form-control form-control-sm modern-input"
                          style={{ width: '140px' }}
                          value={getTargetValue(user.nationalID, 'weeklyTarget')}
                          onChange={(e) => handleTargetChange(user.nationalID, 'weeklyTarget', e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          className="form-control form-control-sm modern-input"
                          style={{ width: '140px' }}
                          value={getTargetValue(user.nationalID, 'monthlyTarget')}
                          onChange={(e) => handleTargetChange(user.nationalID, 'monthlyTarget', e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleSaveTarget(user)}
                          style={{ 
                            background: hasChanges ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#6c757d',
                            border: 'none',
                            color: 'white',
                            fontWeight: '600',
                            padding: '8px 20px',
                            borderRadius: '8px',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          {hasChanges ? '💾 Save Changes' : '✓ Saved'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="alert alert-info mt-4" style={{ borderRadius: '12px', border: '2px solid #bee5eb' }}>
          <strong>💡 Tip:</strong> Targets are measured in total cartons sold. Make changes in any field and click 'Save Changes' to update the targets for that user.
        </div>
      </div>
      )}

      {/* Visit Details Modal */}
      {showModal && selectedVisit && (
        <div className="modal fade show" style={{ 
          display: 'block', 
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)'
        }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{
              background: 'white',
              borderRadius: '20px',
              border: 'none',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden'
            }}>
              <div className="modal-header">
                <h5 className="modal-title">Visit Details</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <div className="modal-body" style={{ textAlign: 'center' }}>
                {selectedVisit.selfie ? (
                  <img 
                    src={selectedVisit.selfie} 
                    style={{ 
                      maxWidth: '100%', 
                      borderRadius: '10px', 
                      marginBottom: '8px' 
                    }} 
                    alt="Visit selfie"
                  />
                ) : (
                  <div className="small-muted">No selfie available</div>
                )}
                <div><strong>{selectedVisit.name || selectedVisit.nationalID}</strong></div>
                <div className="small-muted">{selectedVisit.shopName || ''} — {selectedVisit.region || ''}</div>
                <div className="small-muted">Sold: {selectedVisit.sold}</div>
                <div className="small-muted">Cartons: {selectedVisit.totalCartons || 0}</div>
                {selectedVisit.reason && (
                  <div className="small-muted">Reason: {selectedVisit.reason}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && selectedUplift && (
        <div className="modal d-block" style={{ 
          position: 'fixed',
          zIndex: 2000,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)'
        }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{
              background: 'white',
              borderRadius: '20px',
              border: 'none',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden'
            }}>
              <div className="modal-header">
                <h5 className="modal-title">Reject Uplift</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowRejectModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <p>Rejecting uplift from <strong>{selectedUplift.name}</strong> for <strong>{selectedUplift.totalCartons} cartons</strong>.</p>
                <div className="mb-3">
                  <label className="form-label">Rejection Reason *</label>
                  <textarea 
                    className="form-control"
                    rows="4"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Please provide a reason for rejection..."
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowRejectModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={handleRejectUplift}
                >
                  Reject Uplift
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;