import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { apiService } from '../services/api';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const AdminDashboard = () => {
  const navigate = useNavigate();
  
  // State management
  const [currentUser, setCurrentUser] = useState(null);
  const [allVisits, setAllVisits] = useState([]);
  const [summaryData, setSummaryData] = useState({ users: [], regions: [] });
  const [totals, setTotals] = useState({ visits: 0, sold: 0, cartons: 0 });
  const [mapCenter, setMapCenter] = useState([-1.286389, 36.817223]); // Nairobi
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    month: "",
    type: "monthly"
  });

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
    loadSummary();
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

  // Load summary data
  const loadSummary = async () => {
    const params = {
      type: filters.type,
      month: filters.month ? Number(filters.month) : null,
      year: Number(filters.year)
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

  // Filter visits for map display
  const getFilteredVisits = () => {
    return allVisits.filter(visit => {
      if (!visit.timestamp) return false;
      const visitDate = new Date(visit.timestamp);
      
      if (filters.month) {
        return (visitDate.getMonth() + 1) === Number(filters.month) && 
               visitDate.getFullYear() === Number(filters.year);
      }
      return visitDate.getFullYear() === Number(filters.year);
    });
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

  return (
    <div style={{ padding: '12px', background: '#f8f9fa', minHeight: '100vh' }}>
      {/* Header */}
      <div className="d-flex align-items-center mb-3">
        <h4 className="me-3">Admin Dashboard</h4>
        <div className="ms-auto">
          <button className="btn btn-outline-secondary" onClick={goBack}>
            Back
          </button>
          <button className="btn btn-danger ms-2" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="row g-3">
        {/* Left Panel - Controls */}
        <div className="col-md-4">
          <div className="card p-3" style={{ borderRadius: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }}>
            <label className="small-muted">Select Year</label>
            <select 
              className="form-select"
              value={filters.year}
              onChange={(e) => handleFilterChange('year', e.target.value)}
            >
              {getYearOptions().map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            <label className="small-muted mt-2">Select Month</label>
            <select 
              className="form-select"
              value={filters.month}
              onChange={(e) => handleFilterChange('month', e.target.value)}
            >
              <option value="">All</option>
              <option value="1">Jan</option><option value="2">Feb</option>
              <option value="3">Mar</option><option value="4">Apr</option>
              <option value="5">May</option><option value="6">Jun</option>
              <option value="7">Jul</option><option value="8">Aug</option>
              <option value="9">Sep</option><option value="10">Oct</option>
              <option value="11">Nov</option><option value="12">Dec</option>
            </select>

            <label className="small-muted mt-2">Period Type</label>
            <select 
              className="form-select"
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>

            <div className="d-grid mt-3">
              <button className="btn btn-primary" onClick={loadSummary}>
                Load Summary
              </button>
              <button className="btn btn-outline-secondary mt-2" onClick={exportCSV}>
                Export Visits (CSV)
              </button>
            </div>
          </div>

          <div className="card p-3 mt-3" style={{ borderRadius: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }}>
            <h6>Quick totals</h6>
            <div className="small-muted">Visits: <strong>{totals.visits}</strong></div>
            <div className="small-muted">Sold: <strong>{totals.sold}</strong></div>
            <div className="small-muted">Cartons: <strong>{totals.cartons}</strong></div>
          </div>
        </div>

        {/* Right Panel - Data */}
        <div className="col-md-8">
          {/* Map */}
          <div className="card p-3 mb-3" style={{ borderRadius: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }}>
            <h6>Map view</h6>
            <div style={{ height: '420px', borderRadius: '10px', overflow: 'hidden' }}>
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
          <div className="card p-3 mb-3" style={{ borderRadius: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }}>
            <h6>By User</h6>
            <div style={{ maxHeight: '260px', overflow: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Visits</th>
                    <th>Sold</th>
                    <th>Cartons</th>
                    <th>Efficiency</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.users
                    .sort((a, b) => b.visits - a.visits)
                    .map((user, index) => (
                      <tr key={index}>
                        <td>{user.name || user.nationalID}</td>
                        <td>{user.visits}</td>
                        <td>{user.sold}</td>
                        <td>{user.cartons}</td>
                        <td>{user.efficiency}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Regions Table */}
          <div className="card p-3" style={{ borderRadius: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }}>
            <h6>By Region</h6>
            <div style={{ maxHeight: '220px', overflow: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Region</th>
                    <th>Visits</th>
                    <th>Sold</th>
                    <th>Cartons</th>
                    <th>Efficiency</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.regions
                    .sort((a, b) => b.visits - a.visits)
                    .map((region, index) => (
                      <tr key={index}>
                        <td>{region.region}</td>
                        <td>{region.visits}</td>
                        <td>{region.sold}</td>
                        <td>{region.cartons}</td>
                        <td>{region.efficiency}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Visit Details Modal */}
      {showModal && selectedVisit && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
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
    </div>
  );
};

export default AdminDashboard;