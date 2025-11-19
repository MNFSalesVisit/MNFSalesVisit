import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

const SalesApp = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // State management
  const [currentUser, setCurrentUser] = useState(null);
  const [showLogin, setShowLogin] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [selfieData, setSelfieData] = useState("");
  const [coords, setCoords] = useState({ latitude: "", longitude: "" });
  const [dashboard, setDashboard] = useState({ visitsMTD: 0, soldMTD: 0, cartonsMTD: 0, efficiency: 0 });
  
  // Form state
  const [loginForm, setLoginForm] = useState({ nationalID: "", password: "" });
  const [visitForm, setVisitForm] = useState({
    region: "",
    shop: "",
    sold: "",
    reason: "",
    otherReason: ""
  });
  
  // SKU state
  const availableSKUs = ["Chicken", "Beef", "Supa Mojo"];
  const [skuQuantities, setSkuQuantities] = useState(
    availableSKUs.reduce((acc, sku) => ({ ...acc, [sku]: 0 }), {})
  );

  // Format date for heading
  const formatHeadingDate = () => {
    const d = new Date();
    const day = d.toLocaleDateString("en-GB", { weekday: "short" });
    const dd = String(d.getDate()).padStart(2, "0");
    const mon = d.toLocaleDateString("en-GB", { month: "short" });
    const y = d.getFullYear();
    return `${day} ${dd}/${mon}/${y}`;
  };

  // Check for saved session
  useEffect(() => {
    const saved = localStorage.getItem("userSession");
    if (saved) {
      const user = JSON.parse(saved);
      setCurrentUser(user);
      
      // Redirect admin users
      if (user.role && user.role.toLowerCase() === "admin") {
        navigate('/admin');
        return;
      }
      
      setShowLogin(false);
      startCamera();
      loadDashboard(user.nationalID);
    }
  }, [navigate]);

  // Apply dark mode
  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDark]);

  // Login function
  const handleLogin = async () => {
    const { nationalID, password } = loginForm;
    
    if (!nationalID || !password) {
      alert("Enter National ID & Password");
      return;
    }

    try {
      const data = await apiService.login(nationalID, password);
      
      if (!data.success) {
        alert("Invalid credentials");
        return;
      }

      setCurrentUser(data);
      localStorage.setItem("userSession", JSON.stringify(data));

      // Redirect admin users
      if (data.role && data.role.toLowerCase() === "admin") {
        navigate('/admin');
        return;
      }

      setShowLogin(false);
      startCamera();
      loadDashboard(data.nationalID);
    } catch (error) {
      alert("Login failed. Please try again.");
      console.error(error);
    }
  };

  // Load dashboard data
  const loadDashboard = async (nationalID) => {
    try {
      const data = await apiService.getDashboard(nationalID);
      setDashboard(data);
    } catch (error) {
      console.error('Dashboard load failed:', error);
    }
  };

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera access failed:', error);
    }
  };

  // Capture selfie
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = 120;
    canvas.height = 120;
    canvas.getContext("2d").drawImage(video, 0, 0, 120, 120);
    
    const dataURL = canvas.toDataURL("image/png");
    setSelfieData(dataURL);
  };

  // Handle SKU quantity changes
  const changeQuantity = (sku, delta) => {
    setSkuQuantities(prev => ({
      ...prev,
      [sku]: Math.max(0, (prev[sku] || 0) + delta)
    }));
  };

  // Auto-capture location
  const autoCaptureLocation = () => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
          resolve();
        },
        (err) => reject("Location failed"),
        { enableHighAccuracy: true, timeout: 3000 }
      );
    });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selfieData) {
      alert("Capture selfie");
      return;
    }

    try {
      await autoCaptureLocation();
    } catch (e) {
      alert("Enable GPS to continue.");
      return;
    }

    const { region, shop, sold, reason, otherReason } = visitForm;

    let skusPayload = [];
    if (sold === "Yes") {
      availableSKUs.forEach(sku => {
        const qty = skuQuantities[sku];
        if (qty > 0) skusPayload.push({ name: sku, qty });
      });
      if (skusPayload.length === 0) {
        alert("Select SKU quantity");
        return;
      }
    }

    let reasonVal = "";
    if (sold === "No") {
      if (!reason) {
        alert("Select reason");
        return;
      }
      reasonVal = reason === "Other" ? otherReason.trim() : reason;
      if (reason === "Other" && !reasonVal) {
        alert("Specify reason");
        return;
      }
    }

    const record = {
      nationalID: currentUser.nationalID,
      name: currentUser.name,
      region,
      shopName: shop,
      sold,
      skus: skusPayload,
      reason: reasonVal,
      longitude: coords.longitude,
      latitude: coords.latitude,
      selfie: selfieData
    };

    try {
      await apiService.saveVisit(record);
      
      // Show success overlay
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1600);

      // Reset form
      setVisitForm({
        region: "",
        shop: "",
        sold: "",
        reason: "",
        otherReason: ""
      });
      setSelfieData("");
      setSkuQuantities(availableSKUs.reduce((acc, sku) => ({ ...acc, [sku]: 0 }), {}));
      
      // Reload dashboard
      loadDashboard(currentUser.nationalID);
    } catch (error) {
      alert("Submission failed. Please try again.");
      console.error(error);
    }
  };

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem("userSession");
    window.location.reload();
  };

  if (showLogin) {
    return (
      <div className="container-root">
        <div className="card-custom">
          <h4 style={{ textAlign: "center" }}>Sales Visit App</h4>
          <p className="small-muted text-center">Enter your National ID and password.</p>

          <label>National ID</label>
          <input
            className="form-control"
            type="text"
            value={loginForm.nationalID}
            onChange={(e) => setLoginForm(prev => ({ ...prev, nationalID: e.target.value }))}
          />

          <label className="mt-3">Password</label>
          <input
            className="form-control"
            type="password"
            value={loginForm.password}
            onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          />

          <button className="btn btn-danger w-100 mt-3" onClick={handleLogin}>
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Success Overlay */}
      <div className={`success-overlay ${showSuccess ? 'show' : ''}`}>
        <div className="success-box card-custom" style={{ textAlign: "center", maxWidth: "260px" }}>
          <div className="check">
            <i className="bi bi-check-lg"></i>
          </div>
          <h5>Successfully submitted visit</h5>
        </div>
      </div>

      <div className="container-root">
        {/* Top Bar */}
        <div id="topHeading">
          <div className="dateText">{formatHeadingDate()}</div>
          <div id="centerTitle">Sales Visit App</div>
          <div className="rightControls">
            <button 
              className="dark-toggle" 
              onClick={() => setIsDark(!isDark)}
            >
              <i className={`bi bi-${isDark ? 'sun' : 'moon'}`}></i>
            </button>
            <button id="logoutBtn2" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right"></i>
            </button>
          </div>
        </div>

        {/* Dashboard Card */}
        <div className="card-custom">
          <div className="d-flex justify-content-between">
            <div>
              <div className="small-muted">Month-to-date</div>
              <h5>Your Analytics</h5>
            </div>
            <div className="text-end small-muted">
              {currentUser?.name}<br />
              {currentUser?.nationalID}
            </div>
          </div>
          <div className="small-muted mt-2">
            Visits: <strong>{dashboard.visitsMTD}</strong><br />
            Sold: <strong>{dashboard.soldMTD}</strong><br />
            Cartons: <strong>{dashboard.cartonsMTD}</strong><br />
            Efficiency: <strong>{dashboard.efficiency}%</strong>
          </div>
        </div>

        {/* Form Card */}
        <div className="card-custom">
          <form onSubmit={handleSubmit}>
            <label>Region</label>
            <select 
              className="form-select" 
              value={visitForm.region}
              onChange={(e) => setVisitForm(prev => ({ ...prev, region: e.target.value }))}
              required
            >
              <option value="">Select region</option>
              <option>Mvita</option>
              <option>Nyali</option>
              <option>Kisauni</option>
              <option>Likoni</option>
              <option>Changamwe</option>
              <option>Jomvu</option>
            </select>

            <label className="mt-3">Shop Name</label>
            <input 
              className="form-control" 
              value={visitForm.shop}
              onChange={(e) => setVisitForm(prev => ({ ...prev, shop: e.target.value }))}
              required 
            />

            <label className="mt-3">Sold?</label>
            <select 
              className="form-select" 
              value={visitForm.sold}
              onChange={(e) => setVisitForm(prev => ({ ...prev, sold: e.target.value }))}
              required
            >
              <option value="">Select</option>
              <option>Yes</option>
              <option>No</option>
            </select>

            {/* SKU Section */}
            {visitForm.sold === "Yes" && (
              <div className="mt-3">
                <label><strong>Select SKU & quantity</strong></label>
                <div className="mt-2">
                  {availableSKUs.map(sku => (
                    <div key={sku} className="sku-item">
                      <strong>{sku}</strong>
                      <div className="qty-buttons">
                        <button 
                          type="button" 
                          onClick={() => changeQuantity(sku, -1)}
                        >
                          -
                        </button>
                        <span style={{ padding: "0 10px" }}>{skuQuantities[sku]}</span>
                        <button 
                          type="button" 
                          onClick={() => changeQuantity(sku, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reason Section */}
            {visitForm.sold === "No" && (
              <div className="mt-3">
                <label>Reason for not selling</label>
                <select 
                  className="form-select"
                  value={visitForm.reason}
                  onChange={(e) => setVisitForm(prev => ({ ...prev, reason: e.target.value }))}
                >
                  <option value="">Select</option>
                  <option>Financial Constraint</option>
                  <option>Not Moving</option>
                  <option>Prefers Competitor Product</option>
                  <option>Other</option>
                </select>
                {visitForm.reason === "Other" && (
                  <input 
                    className="form-control mt-2" 
                    placeholder="Specify reason"
                    value={visitForm.otherReason}
                    onChange={(e) => setVisitForm(prev => ({ ...prev, otherReason: e.target.value }))}
                  />
                )}
              </div>
            )}

            {/* Selfie */}
            <label className="mt-3">Selfie</label>
            <video 
              ref={videoRef}
              id="camera" 
              autoPlay 
              muted 
              playsInline
            />

            <div className="d-flex gap-2 mt-2">
              <button type="button" className="btn btn-secondary" onClick={capturePhoto}>
                Capture
              </button>
              {selfieData && (
                <img 
                  id="preview" 
                  src={selfieData} 
                  alt="Preview" 
                />
              )}
            </div>

            <button type="submit" className="btn btn-danger w-100 mt-4">
              Submit Visit
            </button>
          </form>
        </div>
      </div>

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </>
  );
};

export default SalesApp;