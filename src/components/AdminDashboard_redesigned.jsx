import React, { useState, useEffect, useCallback } from 'react';
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
  const [skuData, setSKUData] = useState([]);
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
    salesperson: "",
    sku: "",
    region: "",
    subregion: ""
  });

  // Targets state (per-user)
  const [allTargets, setAllTargets] = useState([]);
  const [targetEdits, setTargetEdits] = useState({});
  const [bulkSaving, setBulkSaving] = useState(false);
  // Users management state
  const [allUsers, setAllUsers] = useState([]);
  const [userForm, setUserForm] = useState({ nationalID: '', password: '', name: '', role: 'user', vehicle: '', region: '' });

  // Auth check and initial data load
  useEffect(() => {

  // load targets when targets tab is opened
  }, [/* keep placeholder for existing effect end */]);

  useEffect(() => {
    if (activeTab === 'targets') {
      fetchAllTargets();
    }
    if (activeTab === 'usersetup') {
      fetchAllUsers();
    }
  }, [activeTab]);

  // Fetch users for User Setup tab
  const fetchAllUsers = async () => {
    try {
      const users = await apiService.getAllUsers();
      setAllUsers(Array.isArray(users) ? users : []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setAllUsers([]);
    }
  };

  // Render User Setup tab
  const renderUsersTab = () => {
    return (
      <div className="tab-content-wrapper">
        <div className="dashboard-card p-4 mb-4">
          <div className="section-title">👥 User Setup</div>
          <div className="section-subtitle">Create or edit salesperson accounts</div>
          <div className="row g-2 mt-3">
            <div className="col-md-2">
              <input className="form-control" placeholder="National ID" value={userForm.nationalID} onChange={(e) => handleUserFormChange('nationalID', e.target.value)} />
            </div>
            <div className="col-md-2">
              <input className="form-control" placeholder="Password" type="password" value={userForm.password} onChange={(e) => handleUserFormChange('password', e.target.value)} />
            </div>
            <div className="col-md-3">
              <input className="form-control" placeholder="Name" value={userForm.name} onChange={(e) => handleUserFormChange('name', e.target.value)} />
            </div>
            <div className="col-md-2">
              <select className="form-select" value={userForm.role} onChange={(e) => handleUserFormChange('role', e.target.value)}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="visually-hidden">Vehicle</label>
              <select className="form-select" value={userForm.vehicle} onChange={(e) => handleUserFormChange('vehicle', e.target.value)}>
                <option value="">Select vehicle</option>
                <option value="Van">Van</option>
                <option value="Motorbike">Motorbike</option>
                <option value="Bicycle">Bicycle</option>
                <option value="Tuk-tuk">Tuk-tuk</option>
              </select>
            </div>
            <div className="col-md-1">
              <label className="visually-hidden">Region</label>
              <select className="form-select" value={userForm.region} onChange={(e) => handleUserFormChange('region', e.target.value)}>
                <option value="">Select region</option>
                <option value="Mombasa">Mombasa</option>
                <option value="Nairobi">Nairobi</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <button className="btn btn-primary" onClick={handleCreateUser}>Create / Save</button>
            <button className="btn btn-outline-secondary ms-2" onClick={fetchAllUsers}>Refresh</button>
          </div>
        </div>

        <div className="dashboard-card p-4">
          <div className="section-title">Existing Users</div>
          <div className="table-responsive mt-3">
            <table className="data-table">
              <thead>
                <tr>
                  <th>National ID</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Vehicle</th>
                  <th>Region</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u, idx) => (
                  <tr key={idx}>
                    <td>{u.nationalID}</td>
                    <td>{u.name}</td>
                    <td>{u.role}</td>
                    <td>{u.vehicle}</td>
                    <td>{u.region}</td>
                    <td>
                      <button className="btn btn-sm btn-success me-2" onClick={() => {
                        // populate form for edit
                        setUserForm({ nationalID: u.nationalID, password: '', name: u.name, role: u.role || 'user', vehicle: u.vehicle || '', region: u.region || '' });
                      }}>Edit</button>
                      <button className="btn btn-sm btn-primary me-2" onClick={() => handleSaveUser({ nationalID: u.nationalID, password: '', name: u.name, role: u.role || 'user', vehicle: u.vehicle || '', region: u.region || '' })}>Save</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeleteUser(u.nationalID)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const handleUserFormChange = (field, value) => {
    setUserForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveUser = async (user) => {
    try {
      const res = await apiService.setUser(user.nationalID, user.password || '', user.name || '', user.role || 'user', user.vehicle || '', user.region || '');
      if (res && res.success) {
        alert('User saved');
        fetchAllUsers();
      } else {
        alert('Save failed');
      }
    } catch (err) {
      console.error(err);
      alert('Save failed');
    }
  };

  const handleCreateUser = async () => {
    if (!userForm.nationalID || !userForm.password || !userForm.name) return alert('National ID, password and name are required');
    await handleSaveUser(userForm);
    setUserForm({ nationalID: '', password: '', name: '', role: 'user', vehicle: '', region: '' });
  };

  const handleDeleteUser = async (nationalID) => {
    if (!confirm('Delete user ' + nationalID + '?')) return;
    try {
      const res = await apiService.deleteUser(nationalID);
      if (res && res.success) {
        alert('Deleted');
        fetchAllUsers();
      } else {
        alert('Delete failed');
      }
    } catch (err) {
      console.error(err);
      alert('Delete failed');
    }
  };

  // Auth check and initial data load (mount)
  useEffect(() => {
    const init = async () => {
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

      try {
        const visits = await apiService.getAllVisits();
        setAllVisits(Array.isArray(visits) ? visits : []);
      } catch (err) {
        console.error('Failed to load visits:', err);
      }

      try {
        const uplifts = await apiService.getAllUpliftVisits();
        setAllUplifts(Array.isArray(uplifts) ? uplifts : []);
      } catch (err) {
        console.error('Failed to load uplifts:', err);
      }

      try {
        const p = await apiService.getPendingUplifts();
        setPendingUplifts(Array.isArray(p) ? p : []);
      } catch (err) {
        console.error('Failed to load pending uplifts:', err);
      }

      try {
        const summary = await apiService.getAdminSummary({ type: 'monthly', year: new Date().getFullYear() });
        setSummaryData(summary || { users: [], regions: [], timeseries: { daily: [], weekly: [], monthly: [] } });
      } catch (err) {
        console.error('Failed to load summary:', err);
      }

      try {
        const sku = await apiService.getSKUAnalysis({ year: new Date().getFullYear() });
        setSKUData(Array.isArray(sku) ? sku : []);
      } catch (err) {
        console.error('Failed to load SKU analysis:', err);
      }

      // fetch targets if admin lands on page
      fetchAllTargets();
    };

    init();
  }, [navigate]);

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
    if (field === 'region') {
      setFilters(prev => ({ ...prev, region: value, subregion: '' }));
      return;
    }
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  // CSV safe string formatting
  const csvSafe = (value) => {
    if (value === null || value === undefined) return "";
    const str = String(value).replace(/"/g, '""');
    if (str.includes(",") || str.includes("\n")) return `"${str}"`;
    return str;
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("userSession");
    navigate('/');
  };

  // Render Tab 1: Overview
  const renderOverviewTab = () => {
    // Build SKU options from visits/uplifts
    const getSKUOptions = () => {
      const set = new Set();
      const collectFrom = (arr) => arr.forEach(v => {
        const s = String(v.skus || '');
        if (!s) return;
        s.split('|').map(x => x.trim()).forEach(pair => {
          const parts = pair.split(':');
          if (parts[0]) set.add(parts[0].trim());
        });
      });
      collectFrom(allVisits || []);
      collectFrom(allUplifts || []);
      return Array.from(set).sort();
    };

    // Fixed region list and subregions mapping
    const REGION_OPTIONS = ['Mombasa', 'Nairobi'];
    const SUBREGIONS = {
      Mombasa: ['', 'Mvita'], // '' means All Subregions
      Nairobi: ['']
    };

    const getRegionOptions = () => REGION_OPTIONS;

    const getFilteredOverviewVisits = () => {
      return (allVisits || []).filter(v => {
        if (!v.timestamp) return false;
        const d = new Date(v.timestamp);
        if (filters.year && Number(filters.year) !== d.getFullYear()) return false;
        if (filters.month && Number(filters.month) !== (d.getMonth() + 1)) return false;
        if (filters.salesperson) {
          const nameMatch = v.name && v.name.toLowerCase().includes(String(filters.salesperson).toLowerCase());
          const idMatch = v.nationalID && v.nationalID.toLowerCase().includes(String(filters.salesperson).toLowerCase());
          if (!nameMatch && !idMatch) return false;
        }
        if (filters.region) {
          const reg = String(v.region || '').toLowerCase();
          if (reg !== String(filters.region).toLowerCase()) return false;
        }
        if (filters.subregion) {
          const sub = String(filters.subregion).toLowerCase();
          if (sub !== '') {
            const visitSub = String(v.subregion || '').toLowerCase();
            const shop = String(v.shopName || '').toLowerCase();
            if (visitSub !== sub && !shop.includes(sub)) return false;
          }
        }
        if (filters.sku) {
          const skuStr = String(v.skus || '').toLowerCase();
          if (!skuStr.includes(String(filters.sku).toLowerCase())) return false;
        }
        return true;
      });
    };

    const exportFilteredToCSV = () => {
      const rows = getFilteredOverviewVisits();
      if (!rows || rows.length === 0) return alert('No data to export');

      const headers = ["timestamp","nationalID","name","region","shopName","sold","skus","totalCartons","reason","longitude","latitude"];
      const csvContent = [
        headers.join(','),
        ...rows.map(r => [
          r.timestamp ? new Date(r.timestamp).toISOString() : '',
          csvSafe(r.nationalID),
          csvSafe(r.name),
          csvSafe(r.region),
          csvSafe(r.shopName),
          csvSafe(r.sold),
          csvSafe(r.skus),
          csvSafe(String(r.totalCartons || 0)),
          csvSafe(r.reason),
          csvSafe(String(r.longitude || '')),
          csvSafe(String(r.latitude || ''))
        ].join(','))
      ].join('\n');

      const filename = `visits_filtered_${new Date().toISOString().slice(0,10)}.csv`;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    };

    const skuOptions = getSKUOptions();
    const regionOptions = getRegionOptions();

    const filteredVisitsForDisplay = getFilteredOverviewVisits();

    return (
      <div className="tab-content-wrapper">
        {/* Filters row */}
        <div className="dashboard-card p-3 mb-4">
          <div className="row g-2 align-items-end">
              <div className="col-md-3">
              <label className="filter-label">Salesperson</label>
              <select className="form-select modern-input" value={filters.salesperson} onChange={(e) => handleFilterChange('salesperson', e.target.value)}>
                <option value="">All Salespeople</option>
                {getSalespeopleOptions().map(name => (<option key={name} value={name}>{name}</option>))}
              </select>
            </div>
              <div className="col-md-2">
              <label className="filter-label">Year</label>
              <select className="form-select modern-input" value={filters.year} onChange={(e) => handleFilterChange('year', e.target.value)}>
                <option value="">All Years</option>
                {getYearOptions().map(y => (<option key={y} value={y}>{y}</option>))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="filter-label">Month</label>
              <select className="form-select modern-input" value={filters.month} onChange={(e) => handleFilterChange('month', e.target.value)}>
                <option value="">All Months</option>
                <option value="1">January</option><option value="2">February</option>
                <option value="3">March</option><option value="4">April</option>
                <option value="5">May</option><option value="6">June</option>
                <option value="7">July</option><option value="8">August</option>
                <option value="9">September</option><option value="10">October</option>
                <option value="11">November</option><option value="12">December</option>
              </select>
            </div>
              <div className="col-md-2">
                <label className="filter-label">Region</label>
                <select className="form-select modern-input" value={filters.region} onChange={(e) => handleFilterChange('region', e.target.value)}>
                  <option value="">All Regions</option>
                  {regionOptions.map(r => (<option key={r} value={r}>{r}</option>))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="filter-label">Subregion</label>
                <select className="form-select modern-input" value={filters.subregion} onChange={(e) => handleFilterChange('subregion', e.target.value)} disabled={!filters.region}>
                  <option value="">All Subregions</option>
                  {(SUBREGIONS[filters.region] || []).filter(s => s).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="filter-label">SKU</label>
                <select className="form-select modern-input" value={filters.sku} onChange={(e) => handleFilterChange('sku', e.target.value)}>
                  <option value="">All SKUs</option>
                  {skuOptions.map(s => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
              <div className="col-md-1 text-end">
                <button className="btn btn-primary" onClick={exportFilteredToCSV}>Export CSV</button>
              </div>
          </div>
        </div>
        {/* Quick Stats Cards (based on filtered data) */}
        <div className="row g-4 mb-4">
          <div className="col-md-4">
            <div className="stat-card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <div className="stat-icon">📊</div>
              <div className="stat-value">{filteredVisitsForDisplay.length}</div>
              <div className="stat-label">Total Visits</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="stat-card" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
              <div className="stat-icon">✅</div>
              <div className="stat-value">{filteredVisitsForDisplay.filter(v => String(v.sold) === 'Yes').length}</div>
              <div className="stat-label">Sales Made</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="stat-card" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
              <div className="stat-icon">📦</div>
              <div className="stat-value">{filteredVisitsForDisplay.reduce((s, r) => s + (Number(r.totalCartons) || 0), 0)}</div>
              <div className="stat-label">Cartons Sold</div>
            </div>
          </div>
        </div>

        {/* Uplift Verification Section */}
        <div className="dashboard-card p-4 mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <div className="section-title">
                📦 Uplift Verification Requests
                {pendingUplifts.length > 0 && (
                  <span className="badge-notification">{pendingUplifts.length}</span>
                )}
              </div>
              <div className="section-subtitle">Review and approve stock uplift requests</div>
            </div>
          </div>
          
          {pendingUplifts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✓</div>
              <p>No pending uplift requests</p>
            </div>
          ) : (
            <div className="uplift-list">
              {pendingUplifts.map((uplift, index) => (
                <div key={index} className="uplift-card">
                  <div className="row align-items-center">
                    <div className="col-md-3">
                      {uplift.receiptPhoto ? (
                        <img 
                          src={uplift.receiptPhoto} 
                          alt="Receipt" 
                          className="receipt-image"
                          onClick={() => window.open(uplift.receiptPhoto, '_blank')}
                        />
                      ) : (
                        <div className="no-photo">No photo</div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <h6 className="uplift-name">👤 {uplift.name}</h6>
                      <div className="uplift-detail"><strong>National ID:</strong> {uplift.nationalID}</div>
                      <div className="uplift-detail"><strong>Region:</strong> {uplift.region}</div>
                      <div className="uplift-detail"><strong>Shop:</strong> {uplift.shopName}</div>
                      <div className="uplift-detail"><strong>SKUs:</strong> {uplift.skus}</div>
                      <div className="uplift-detail">
                        <strong>Total Cartons:</strong> 
                        <span className="badge bg-primary ms-2">{uplift.totalCartons}</span>
                      </div>
                      <div className="uplift-detail text-muted">
                        🕒 {new Date(uplift.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="col-md-3 d-flex flex-column gap-2">
                      <button 
                        className="btn btn-success w-100"
                        onClick={() => handleApproveUplift(uplift)}
                      >
                        ✓ Approve
                      </button>
                      <button 
                        className="btn btn-danger w-100"
                        onClick={() => showRejectModalFor(uplift)}
                      >
                        ✗ Reject
                      </button>
                      {uplift.receiptPhoto && (
                        <button
                          className="btn btn-outline-secondary w-100"
                          onClick={async () => {
                            if (!currentUser) return alert('Not authenticated');
                            if (!confirm('Delete this uploaded receipt?')) return;
                            try {
                              const res = await apiService.deleteUpliftReceipt(uplift.rowIndex, currentUser.name || currentUser.nationalID);
                              if (res && res.success) {
                                alert('Receipt deleted');
                                // refresh pending uplifts
                                const p = await apiService.getPendingUplifts();
                                setPendingUplifts(p);
                              } else {
                                alert('Delete failed: ' + (res && res.message ? res.message : 'Unknown'));
                              }
                            } catch (err) {
                              console.error(err);
                              alert('Delete failed');
                            }
                          }}
                        >
                          🗑️ Delete Receipt
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User Performance Table */}
        <div className="dashboard-card p-4">
          <div className="section-title">👥 User Performance</div>
          <div className="section-subtitle">Individual salesperson performance metrics</div>
          <div className="table-responsive">
            <table className="data-table">
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
                    const efficiencyClass = efficiency >= 70 ? 'high' : efficiency >= 40 ? 'medium' : 'low';
                    
                    return (
                      <tr key={index}>
                        <td className="fw-bold">{user.name || user.nationalID}</td>
                        <td>{user.visits}</td>
                        <td><span className={user.sold > 0 ? 'text-success' : 'text-danger'}>{user.sold}</span></td>
                        <td>{user.cartons}</td>
                        <td><span className={`efficiency-badge ${efficiencyClass}`}>{user.efficiency}%</span></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Render Tab: Targets (per-user)
  const fetchAllTargets = async () => {
    try {
      const targets = await apiService.getAllTargets();
      setAllTargets(Array.isArray(targets) ? targets : []);
    } catch (err) {
      console.error('Failed to fetch targets:', err);
      setAllTargets([]);
    }
  };

  const handleTargetChange = (nationalID, field, value) => {
    setTargetEdits(prev => ({
      ...prev,
      [nationalID]: {
        ...prev[nationalID],
        [field]: value
      }
    }));
  };

  const getTargetValue = (nationalID, field) => {
    if (targetEdits[nationalID] && targetEdits[nationalID][field] !== undefined) {
      return targetEdits[nationalID][field];
    }
    const existing = allTargets.find(t => t.nationalID === nationalID);
    return existing ? existing[field] : 0;
  };

  const handleSaveTarget = async (user) => {
    const dailyTarget = Number(getTargetValue(user.nationalID, 'dailyTarget')) || 0;
    const weeklyTarget = Number(getTargetValue(user.nationalID, 'weeklyTarget')) || 0;
    const monthlyTarget = Number(getTargetValue(user.nationalID, 'monthlyTarget')) || 0;

    try {
      const res = await apiService.setUserTargets(user.nationalID, user.name, dailyTarget, weeklyTarget, monthlyTarget);
      if (res && res.success) {
        alert(`Targets saved for ${user.name || user.nationalID}`);
        fetchAllTargets();
        setTargetEdits(prev => { const p = { ...prev }; delete p[user.nationalID]; return p; });
      } else {
        alert('Failed to save targets');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save targets');
    }
  };

  // Bulk save all edited targets (or current values)
  const handleSaveAll = async () => {
    if (!allTargets || allTargets.length === 0) return alert('No targets to save');
    if (!confirm('Save targets for all listed salespeople?')) return;

    setBulkSaving(true);
    const promises = allTargets.map(u => {
      const daily = Number(getTargetValue(u.nationalID, 'dailyTarget')) || 0;
      const weekly = Number(getTargetValue(u.nationalID, 'weeklyTarget')) || 0;
      const monthly = Number(getTargetValue(u.nationalID, 'monthlyTarget')) || 0;
      return apiService.setUserTargets(u.nationalID, u.name || u.nationalID, daily, weekly, monthly);
    });

    const results = await Promise.allSettled(promises);
    let success = 0, failed = 0;
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value && r.value.success) success++; else failed++;
    });

    setBulkSaving(false);
    alert(`Bulk save complete — ${success} succeeded, ${failed} failed.`);
    // refresh and clear edits
    fetchAllTargets();
    setTargetEdits({});
  };

  const renderTargetsTab = () => {
    return (
      <div className="tab-content-wrapper">
        <div className="dashboard-card p-4 mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <div className="section-title">🎯 Sales Targets</div>
              <div className="section-subtitle">Set daily / weekly / monthly targets per salesperson</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-outline-secondary" onClick={fetchAllTargets}>Refresh</button>
              <button className="btn btn-primary" onClick={handleSaveAll} disabled={bulkSaving}>
                {bulkSaving ? 'Saving...' : 'Save All'}
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>National ID</th>
                  <th>Daily</th>
                  <th>Weekly</th>
                  <th>Monthly</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {allTargets.map((u, idx) => (
                  <tr key={idx}>
                    <td className="fw-bold">{u.name || u.nationalID}</td>
                    <td>{u.nationalID}</td>
                    <td>
                      <input
                        type="number"
                        className="form-control"
                        value={getTargetValue(u.nationalID, 'dailyTarget')}
                        onChange={(e) => handleTargetChange(u.nationalID, 'dailyTarget', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-control"
                        value={getTargetValue(u.nationalID, 'weeklyTarget')}
                        onChange={(e) => handleTargetChange(u.nationalID, 'weeklyTarget', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-control"
                        value={getTargetValue(u.nationalID, 'monthlyTarget')}
                        onChange={(e) => handleTargetChange(u.nationalID, 'monthlyTarget', e.target.value)}
                      />
                    </td>
                    <td>
                      <button className="btn btn-success" onClick={() => handleSaveTarget(u)}>Save</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Analytics tab removed — retained overview, map and targets only

  // Render Tab 3: Map Analysis
  const renderMapTab = () => {
    // Filter visits for map display
    const getFilteredVisits = () => {
      return allVisits.filter(visit => {
        if (!visit.timestamp) return false;
        const visitDate = new Date(visit.timestamp);
        
        if (filters.month) {
          const monthMatch = (visitDate.getMonth() + 1) === Number(filters.month) && 
                            visitDate.getFullYear() === Number(filters.year);
          if (!monthMatch) return false;
        } else {
          if (visitDate.getFullYear() !== Number(filters.year)) return false;
        }
        
        if (filters.salesperson) {
          const matchesName = visit.name && visit.name.toLowerCase().includes(filters.salesperson.toLowerCase());
          const matchesID = visit.nationalID && visit.nationalID.toLowerCase().includes(filters.salesperson.toLowerCase());
          if (!matchesName && !matchesID) return false;
        }
        
        return true;
      });
    };

    // Filter uplifts for map display
    const getFilteredUplifts = () => {
      return allUplifts.filter(uplift => {
        if (!uplift.timestamp) return false;
        const upliftDate = new Date(uplift.timestamp);
        
        if (filters.month) {
          const monthMatch = (upliftDate.getMonth() + 1) === Number(filters.month) && 
                            upliftDate.getFullYear() === Number(filters.year);
          if (!monthMatch) return false;
        } else {
          if (upliftDate.getFullYear() !== Number(filters.year)) return false;
        }
        
        if (filters.salesperson) {
          const matchesName = uplift.name && uplift.name.toLowerCase().includes(filters.salesperson.toLowerCase());
          const matchesID = uplift.nationalID && uplift.nationalID.toLowerCase().includes(filters.salesperson.toLowerCase());
          if (!matchesName && !matchesID) return false;
        }
        
        return true;
      });
    };

    const filteredVisits = getFilteredVisits();
    const filteredUplifts = getFilteredUplifts();

    // Download visit map as HTML
    const downloadVisitMapHTML = () => {
      if (filteredVisits.length === 0) {
        alert("No visits to display on map");
        return;
      }

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
            ${visit.selfie ? '<br /><img src="' + visit.selfie + '" style="width: 160px; border-radius: 8px; display: block; margin: 6px auto;" alt="Visit selfie" />' : ''}
            <div style="margin-top: 6px;">
              <strong>Sold:</strong> ${visit.sold || 'No'}<br />
              <strong>Cartons:</strong> ${visit.totalCartons || 0}
              ${visit.reason ? '<br /><strong>Reason:</strong> ' + visit.reason : ''}
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
        ${filters.salesperson ? '<p>Salesperson: ' + filters.salesperson + '</p>' : ''}
        ${filters.month ? '<p>Period: ' + filters.month + '/' + filters.year + '</p>' : '<p>Year: ' + filters.year + '</p>'}
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
      
      link.download = `sales_visits_map${filterStr}${periodStr}_${dateStr}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
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
            ${uplift.receiptPhoto ? '<br /><img src="' + uplift.receiptPhoto + '" style="width: 160px; border-radius: 8px; display: block; margin: 6px auto;" alt="Receipt" />' : ''}
            <div style="margin-top: 6px;">
              <strong>Cartons:</strong> ${uplift.totalCartons || 0}<br />
              <strong>SKUs:</strong> ${uplift.skus || ''}
              ${uplift.rejectionReason ? '<br /><strong>Reason:</strong> ' + uplift.rejectionReason : ''}
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
        ${filters.salesperson ? '<p>Salesperson: ' + filters.salesperson + '</p>' : ''}
        ${filters.month ? '<p>Period: ' + filters.month + '/' + filters.year + '</p>' : '<p>Year: ' + filters.year + '</p>'}
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

    // Custom marker icons for uplifts
    const getUpliftMarkerIcon = (status) => {
      const color = status === 'Approved' ? '#10b981' : status === 'Rejected' ? '#ef4444' : '#f59e0b';
      return L.divIcon({
        className: 'custom-marker',
        html: `<div style="background: ${color}; width: 25px; height: 25px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
        iconSize: [25, 25],
        iconAnchor: [12, 12]
      });
    };

    return (
      <div className="tab-content-wrapper">
        {/* Filter and Map Type Toggle */}
        <div className="dashboard-card p-4 mb-4">
          <div className="row g-3">
            <div className="col-md-2">
              <label className="filter-label">Year</label>
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
            <div className="col-md-2">
              <label className="filter-label">Month</label>
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
            <div className="col-md-3">
              <label className="filter-label">Salesperson</label>
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
            <div className="col-md-3">
              <label className="filter-label">Map Type</label>
              <div className="btn-group w-100" role="group">
                <button 
                  type="button" 
                  className={`btn ${mapType === 'visits' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setMapType('visits')}
                  style={{
                    background: mapType === 'visits' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                    color: mapType === 'visits' ? 'white' : '#64748b',
                    border: '2px solid',
                    borderColor: mapType === 'visits' ? '#667eea' : '#e2e8f0',
                    borderRadius: '10px 0 0 10px',
                    fontWeight: '600'
                  }}
                >
                  📍 Visits
                </button>
                <button 
                  type="button" 
                  className={`btn ${mapType === 'uplifts' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setMapType('uplifts')}
                  style={{
                    background: mapType === 'uplifts' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
                    color: mapType === 'uplifts' ? 'white' : '#64748b',
                    border: '2px solid',
                    borderColor: mapType === 'uplifts' ? '#667eea' : '#e2e8f0',
                    borderRadius: '0 10px 10px 0',
                    fontWeight: '600'
                  }}
                >
                  📦 Uplifts
                </button>
              </div>
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button 
                className="btn btn-export w-100"
                onClick={mapType === 'visits' ? downloadVisitMapHTML : downloadUpliftMapHTML}
              >
                📄 Export Map
              </button>
            </div>
          </div>
        </div>

        {/* Map Statistics */}
        <div className="row g-4 mb-4">
          <div className="col-md-4">
            <div className="stat-card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <div className="stat-icon">{mapType === 'visits' ? '📍' : '📦'}</div>
              <div className="stat-value">{mapType === 'visits' ? filteredVisits.length : filteredUplifts.length}</div>
              <div className="stat-label">Total {mapType === 'visits' ? 'Visits' : 'Uplifts'}</div>
            </div>
          </div>
          {mapType === 'uplifts' && (
            <>
              <div className="col-md-2">
                <div className="stat-card" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                  <div className="stat-icon">✓</div>
                  <div className="stat-value">{filteredUplifts.filter(u => u.status === 'Approved').length}</div>
                  <div className="stat-label">Approved</div>
                </div>
              </div>
              <div className="col-md-2">
                <div className="stat-card" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                  <div className="stat-icon">⏳</div>
                  <div className="stat-value">{filteredUplifts.filter(u => u.status === 'Pending').length}</div>
                  <div className="stat-label">Pending</div>
                </div>
              </div>
              <div className="col-md-2">
                <div className="stat-card" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
                  <div className="stat-icon">✗</div>
                  <div className="stat-value">{filteredUplifts.filter(u => u.status === 'Rejected').length}</div>
                  <div className="stat-label">Rejected</div>
                </div>
              </div>
              <div className="col-md-2">
                <div className="stat-card" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
                  <div className="stat-icon">📊</div>
                  <div className="stat-value">{filteredUplifts.reduce((sum, u) => sum + (u.totalCartons || 0), 0)}</div>
                  <div className="stat-label">Total Cartons</div>
                </div>
              </div>
            </>
          )}
          {mapType === 'visits' && (
            <>
              <div className="col-md-4">
                <div className="stat-card" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                  <div className="stat-icon">✓</div>
                  <div className="stat-value">{filteredVisits.filter(v => v.sold === 'Yes').length}</div>
                  <div className="stat-label">Sales Made</div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="stat-card" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
                  <div className="stat-icon">📊</div>
                  <div className="stat-value">{filteredVisits.reduce((sum, v) => sum + (v.sold === 'Yes' ? (v.totalCartons || 0) : 0), 0)}</div>
                  <div className="stat-label">Cartons Sold</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Interactive Map */}
        <div className="dashboard-card p-4">
          <div className="section-title">
            {mapType === 'visits' ? '📍 Visit Locations' : '📦 Uplift Locations'}
          </div>
          <div className="section-subtitle">
            {mapType === 'visits' 
              ? 'Interactive map showing all filtered sales visits' 
              : 'Interactive map showing all uplifts with status indicators'
            }
          </div>
          <div className="map-container" style={{ height: '600px', borderRadius: '16px', overflow: 'hidden', marginTop: '20px' }}>
            <MapContainer
              center={mapCenter}
              zoom={11}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {/* Render Visit Markers */}
              {mapType === 'visits' && filteredVisits.map((visit, index) => {
                const lat = Number(visit.latitude);
                const lng = Number(visit.longitude);
                
                if (!lat || !lng) return null;
                
                return (
                  <Marker key={`visit-${index}`} position={[lat, lng]}>
                    <Popup>
                      <div style={{ minWidth: '180px', textAlign: 'center' }}>
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
                        <div style={{ marginTop: '8px', textAlign: 'left' }}>
                          <strong>Sold:</strong> {visit.sold || 'No'}<br />
                          <strong>Cartons:</strong> {visit.totalCartons || 0}
                          {visit.reason && <><br /><strong>Reason:</strong> {visit.reason}</>}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* Render Uplift Markers */}
              {mapType === 'uplifts' && filteredUplifts.map((uplift, index) => {
                const lat = Number(uplift.latitude);
                const lng = Number(uplift.longitude);
                
                if (!lat || !lng) return null;
                
                return (
                  <Marker 
                    key={`uplift-${index}`} 
                    position={[lat, lng]}
                    icon={getUpliftMarkerIcon(uplift.status)}
                  >
                    <Popup>
                      <div style={{ minWidth: '180px', textAlign: 'center' }}>
                        <strong>{uplift.name || uplift.nationalID}</strong><br />
                        <small>{uplift.shopName || ''}</small><br />
                        <small>{uplift.region || ''}</small><br />
                        <small>{new Date(uplift.timestamp).toLocaleString()}</small>
                        <div style={{ margin: '8px 0' }}>
                          <span style={{
                            background: uplift.status === 'Approved' ? '#10b981' : uplift.status === 'Rejected' ? '#ef4444' : '#f59e0b',
                            color: 'white',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontWeight: 'bold',
                            fontSize: '12px'
                          }}>
                            {uplift.status}
                          </span>
                        </div>
                        {uplift.receiptPhoto && (
                          <img 
                            src={uplift.receiptPhoto} 
                            style={{
                              width: '160px',
                              borderRadius: '8px',
                              display: 'block',
                              margin: '6px auto',
                              cursor: 'pointer'
                            }} 
                            alt="Receipt"
                            onClick={() => window.open(uplift.receiptPhoto, '_blank')}
                          />
                        )}
                        <div style={{ marginTop: '8px', textAlign: 'left' }}>
                          <strong>Cartons:</strong> {uplift.totalCartons || 0}<br />
                          <strong>SKUs:</strong> {uplift.skus || ''}
                          {uplift.rejectionReason && (
                            <>
                              <br /><strong>Rejection Reason:</strong>
                              <div style={{ 
                                background: '#fee2e2', 
                                padding: '6px', 
                                borderRadius: '6px', 
                                marginTop: '4px',
                                fontSize: '12px',
                                color: '#991b1b'
                              }}>
                                {uplift.rejectionReason}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* Map Legend for Uplifts */}
          {mapType === 'uplifts' && (
            <div style={{
              marginTop: '20px',
              display: 'flex',
              justifyContent: 'center',
              gap: '20px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: '#10b981',
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}></div>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>Approved</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: '#f59e0b',
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}></div>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>Pending</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}></div>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>Rejected</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="admin-dashboard-container">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          
          .admin-dashboard-container {
            display: flex;
            height: 100vh;
            background: #f5f7fa;
            font-family: 'Inter', sans-serif;
          }

          /* Sidebar Styles */
          .sidebar {
            width: ${sidebarCollapsed ? '80px' : '260px'};
            background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
            color: white;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            flex-direction: column;
            box-shadow: 4px 0 20px rgba(0, 0, 0, 0.1);
            position: relative;
            z-index: 100;
          }

          .sidebar-header {
            padding: 24px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .sidebar-logo {
            display: flex;
            align-items: center;
            gap: 12px;
            overflow: hidden;
          }

          .sidebar-logo-icon {
            font-size: 28px;
            min-width: 40px;
          }

          .sidebar-logo-text {
            font-size: 20px;
            font-weight: 700;
            white-space: nowrap;
            opacity: ${sidebarCollapsed ? 0 : 1};
            transition: opacity 0.3s;
          }

          .sidebar-toggle {
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
          }

          .sidebar-toggle:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: scale(1.1);
          }

          .sidebar-nav {
            flex: 1;
            padding: 20px 0;
            overflow-y: auto;
          }

          .nav-item {
            padding: 14px 20px;
            margin: 4px 12px;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            gap: 12px;
            color: rgba(255, 255, 255, 0.7);
            font-weight: 500;
          }

          .nav-item:hover {
            background: rgba(255, 255, 255, 0.1);
            color: white;
          }

          .nav-item.active {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
          }

          .nav-item-icon {
            font-size: 20px;
            min-width: 24px;
          }

          .nav-item-text {
            white-space: nowrap;
            opacity: ${sidebarCollapsed ? 0 : 1};
            transition: opacity 0.3s;
          }

          .sidebar-footer {
            padding: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
          }

          .sidebar-user {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            margin-bottom: 12px;
          }

          .sidebar-user-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
          }

          .sidebar-user-info {
            flex: 1;
            overflow: hidden;
            opacity: ${sidebarCollapsed ? 0 : 1};
            transition: opacity 0.3s;
          }

          .sidebar-user-name {
            font-size: 14px;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .sidebar-user-role {
            font-size: 12px;
            opacity: 0.7;
          }

          .btn-logout {
            width: 100%;
            padding: 12px;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #ef4444;
            border-radius: 10px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }

          .btn-logout:hover {
            background: rgba(239, 68, 68, 0.2);
            border-color: rgba(239, 68, 68, 0.5);
          }

          /* Main Content Area */
          .main-content {
            flex: 1;
            overflow-y: auto;
            padding: 32px;
          }

          .content-header {
            margin-bottom: 32px;
          }

          .content-title {
            font-size: 32px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 8px;
          }

          .content-subtitle {
            font-size: 16px;
            color: #64748b;
          }

          /* Tab Content */
          .tab-content-wrapper {
            animation: fadeIn 0.5s ease-out;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          /* Cards */
          .dashboard-card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            transition: all 0.3s;
          }

          .dashboard-card:hover {
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
          }

          .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 20px;
            padding: 28px;
            position: relative;
            overflow: hidden;
            transition: all 0.3s;
          }

          .stat-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 40px rgba(102, 126, 234, 0.3);
          }

          .stat-card::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
          }

          .stat-icon {
            font-size: 40px;
            margin-bottom: 12px;
          }

          .stat-value {
            font-size: 36px;
            font-weight: 700;
            margin-bottom: 8px;
          }

          .stat-label {
            font-size: 14px;
            opacity: 0.9;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          .section-title {
            font-size: 20px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .section-subtitle {
            font-size: 14px;
            color: #64748b;
            margin-bottom: 20px;
          }

          .badge-notification {
            background: #ef4444;
            color: white;
            font-size: 0.8rem;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-left: 8px;
            animation: pulse 2s infinite;
          }

          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }

          /* Empty State */
          .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #94a3b8;
          }

          .empty-icon {
            font-size: 64px;
            margin-bottom: 16px;
            opacity: 0.5;
          }

          /* Uplift Cards */
          .uplift-list {
            max-height: 600px;
            overflow-y: auto;
          }

          .uplift-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 16px;
            transition: all 0.3s;
          }

          .uplift-card:hover {
            border-color: #cbd5e1;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          }

          .receipt-image {
            width: 100%;
            max-width: 200px;
            border-radius: 12px;
            border: 2px solid #e2e8f0;
            cursor: pointer;
            transition: all 0.3s;
          }

          .receipt-image:hover {
            border-color: #667eea;
            transform: scale(1.05);
          }

          .no-photo {
            text-align: center;
            padding: 40px 20px;
            background: #f1f5f9;
            border-radius: 12px;
            color: #94a3b8;
          }

          .uplift-name {
            color: #1e293b;
            font-weight: 600;
            margin-bottom: 12px;
          }

          .uplift-detail {
            font-size: 14px;
            color: #475569;
            margin-bottom: 6px;
          }

          /* Tables */
          .table-responsive {
            max-height: 500px;
            overflow-y: auto;
            margin-top: 20px;
          }

          .data-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
          }

          .data-table thead th {
            background: #f8fafc;
            color: #475569;
            font-weight: 600;
            padding: 16px;
            text-align: left;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            position: sticky;
            top: 0;
            z-index: 10;
          }

          .data-table tbody td {
            padding: 16px;
            border-bottom: 1px solid #f1f5f9;
            color: #1e293b;
          }

          .data-table tbody tr:hover {
            background: #f8fafc;
          }

          .efficiency-badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
          }

          .efficiency-badge.high {
            background: #d1fae5;
            color: #065f46;
          }

          .efficiency-badge.medium {
            background: #fef3c7;
            color: #92400e;
          }

          .efficiency-badge.low {
            background: #fee2e2;
            color: #991b1b;
          }

          /* Buttons */
          .btn {
            padding: 10px 20px;
            border-radius: 10px;
            font-weight: 500;
            border: none;
            cursor: pointer;
            transition: all 0.3s;
            font-size: 14px;
          }

          .btn-success {
            background: #10b981;
            color: white;
          }

          .btn-success:hover {
            background: #059669;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
          }

          .btn-danger {
            background: #ef4444;
            color: white;
          }

          .btn-danger:hover {
            background: #dc2626;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
          }

          .btn-export {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 10px 20px;
            border-radius: 10px;
            font-weight: 500;
            border: none;
            cursor: pointer;
            transition: all 0.3s;
          }

          .btn-export:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          }

          /* Form Inputs */
          .modern-input {
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            padding: 10px 14px;
            transition: all 0.3s;
            font-size: 14px;
          }

          .modern-input:focus {
            background: white;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            outline: none;
          }

          .filter-label {
            font-size: 13px;
            font-weight: 600;
            color: #475569;
            margin-bottom: 6px;
            display: block;
          }

          /* Scrollbar Styles */
          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }

          ::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 10px;
          }

          ::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 10px;
          }

          ::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
        `}
      </style>

      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">📊</div>
            <div className="sidebar-logo-text">Admin</div>
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        <div className="sidebar-nav">
          <div 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <div className="nav-item-icon">📈</div>
            <div className="nav-item-text">Overview</div>
          </div>
          
          <div 
            className={`nav-item ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            <div className="nav-item-icon">🗺️</div>
            <div className="nav-item-text">Map Analysis</div>
          </div>
          <div 
            className={`nav-item ${activeTab === 'usersetup' ? 'active' : ''}`}
            onClick={() => setActiveTab('usersetup')}
          >
            <div className="nav-item-icon">👥</div>
            <div className="nav-item-text">User Setup</div>
          </div>
          <div 
            className={`nav-item ${activeTab === 'targets' ? 'active' : ''}`}
            onClick={() => setActiveTab('targets')}
          >
            <div className="nav-item-icon">🎯</div>
            <div className="nav-item-text">Targets</div>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">👤</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{currentUser?.name || 'Admin'}</div>
              <div className="sidebar-user-role">Administrator</div>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            <span>🚪</span>
            <span style={{ opacity: sidebarCollapsed ? 0 : 1 }}>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="content-header">
          <h1 className="content-title">
            {activeTab === 'overview' && '📈 Overview'}
            {activeTab === 'map' && '🗺️ Map Analysis'}
            {activeTab === 'targets' && '🎯 Targets'}
          </h1>
          <p className="content-subtitle">
            {activeTab === 'overview' && 'Quick insights and pending approvals'}
            {activeTab === 'map' && 'Geographic distribution of visits and uplifts'}
            {activeTab === 'targets' && 'Per-user target management'}
          </p>
        </div>

        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'map' && renderMapTab()}
        {activeTab === 'targets' && renderTargetsTab()}
        {activeTab === 'usersetup' && renderUsersTab && renderUsersTab()}
      </div>

      {/* Rejection Modal */}
      {showRejectModal && selectedUplift && (
        <div className="modal d-block" style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2000,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
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
                  style={{ background: '#94a3b8' }}
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
