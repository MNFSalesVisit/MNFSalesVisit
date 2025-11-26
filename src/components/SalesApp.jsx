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
  const [submittedVisitType, setSubmittedVisitType] = useState("");
  const [isDark, setIsDark] = useState(false);
  const [selfieData, setSelfieData] = useState("");
  const [coords, setCoords] = useState({ latitude: "", longitude: "" });
  const [cameraFacing, setCameraFacing] = useState("user");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dashboard, setDashboard] = useState({ visitsMTD: 0, soldMTD: 0, cartonsMTD: 0, efficiency: 0, stockBalance: 0, stockBalanceBySKU: {} });
  const [upliftStatus, setUpliftStatus] = useState([]);
  const [submitError, setSubmitError] = useState("");
  const [progress, setProgress] = useState({ daily: { current: 0, target: 0, percentage: 0 }, weekly: { current: 0, target: 0, percentage: 0 }, monthly: { current: 0, target: 0, percentage: 0 } });
  
  // Form state
  const [loginForm, setLoginForm] = useState({ nationalID: "", password: "" });
  const [visitForm, setVisitForm] = useState({
    visitType: "",
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
      
      // Load uplift status
      const uplifts = await apiService.getUserUpliftStatus(nationalID);
      setUpliftStatus(uplifts);
      
      // Load progress - with error handling
      try {
        const progressData = await apiService.getUserProgress(nationalID);
        if (progressData && progressData.daily && progressData.weekly && progressData.monthly) {
          setProgress(progressData);
        }
      } catch (progressError) {
        console.error('Progress load failed:', progressError);
        // Keep default progress state
      }
    } catch (error) {
      console.error('Dashboard load failed:', error);
    }
  };

  // Start camera
  const startCamera = async (facingMode = "user") => {
    try {
      // Stop existing stream completely
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => {
          track.stop();
          track.enabled = false;
        });
        videoRef.current.srcObject = null;
      }
      
      // Small delay to ensure camera is released
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Use exact constraint to force camera selection with square aspect ratio
      const constraints = {
        video: facingMode === "environment" 
          ? { facingMode: { exact: "environment" }, aspectRatio: 1, width: { ideal: 400 }, height: { ideal: 400 } }
          : { facingMode: "user", aspectRatio: 1, width: { ideal: 400 }, height: { ideal: 400 } }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
    
    // Capture square image
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = 400;
    canvas.height = 400;
    
    // Center crop to square
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    
    canvas.getContext("2d").drawImage(video, sx, sy, size, size, 0, 0, 400, 400);
    
    const dataURL = canvas.toDataURL("image/png");
    setSelfieData(dataURL);
  };

  // Flip camera between front and rear
  const flipCamera = async () => {
    const newFacing = cameraFacing === "user" ? "environment" : "user";
    setCameraFacing(newFacing);
    await startCamera(newFacing);
  };

  // Handle SKU quantity changes
  const changeQuantity = (sku, delta) => {
    setSkuQuantities(prev => ({
      ...prev,
      [sku]: Math.max(0, (prev[sku] || 0) + delta)
    }));
  };

  // Auto-capture location with enhanced accuracy
  const autoCaptureLocation = () => {
    return new Promise((resolve, reject) => {
      console.log("Starting GPS capture...");
      
      if (!navigator.geolocation) {
        console.error("Geolocation not supported");
        reject("GPS not supported");
        return;
      }

      const allReadings = [];
      let readingCount = 0;
      const maxReadings = 3;

      const collectReading = () => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            readingCount++;
            allReadings.push({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy
            });
            
            console.log(`Reading ${readingCount}/${maxReadings} - Accuracy: ${pos.coords.accuracy.toFixed(1)}m`);

            if (readingCount >= maxReadings) {
              // Average all readings for best accuracy
              const avgLat = allReadings.reduce((sum, r) => sum + r.latitude, 0) / allReadings.length;
              const avgLng = allReadings.reduce((sum, r) => sum + r.longitude, 0) / allReadings.length;
              const avgAccuracy = allReadings.reduce((sum, r) => sum + r.accuracy, 0) / allReadings.length;
              
              const newCoords = {
                latitude: avgLat,
                longitude: avgLng
              };
              
              console.log(`GPS complete - ${allReadings.length} readings averaged, Avg accuracy: ${avgAccuracy.toFixed(1)}m`);
              setCoords(newCoords);
              resolve(newCoords);
            } else {
              // Get next reading after short delay
              setTimeout(() => collectReading(), 800);
            }
          },
          (err) => {
            console.error(`Reading ${readingCount + 1} failed:`, err.message);
            
            // If we have at least one reading, use it
            if (allReadings.length > 0) {
              const avgLat = allReadings.reduce((sum, r) => sum + r.latitude, 0) / allReadings.length;
              const avgLng = allReadings.reduce((sum, r) => sum + r.longitude, 0) / allReadings.length;
              
              const newCoords = {
                latitude: avgLat,
                longitude: avgLng
              };
              
              console.log(`GPS using ${allReadings.length} readings`);
              setCoords(newCoords);
              resolve(newCoords);
            } else if (readingCount < maxReadings) {
              // Try again
              setTimeout(() => collectReading(), 800);
            } else {
              reject("Unable to get GPS location");
            }
          },
          { 
            enableHighAccuracy: true, 
            timeout: 8000,
            maximumAge: 0
          }
        );
      };

      collectReading();
    });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting) {
      return; // Prevent double submission
    }
    
    const { visitType } = visitForm;
    const photoLabel = visitType === "Uplift" ? "receipt" : "selfie";
    
    if (!selfieData) {
      alert(`Capture ${photoLabel}`);
      return;
    }

    setIsSubmitting(true);

    let capturedCoords;
    try {
      capturedCoords = await autoCaptureLocation();
      console.log("Location captured successfully:", capturedCoords);
    } catch (e) {
      console.error("Location capture failed:", e);
      alert("GPS location required. Please enable location access and ensure you're in an area with good GPS signal. Error: " + e);
      setIsSubmitting(false);
      return;
    }

    const { region, shop, sold, reason, otherReason } = visitForm;

    // Handle Uplift Visit
    if (visitType === "Uplift") {
      let skusPayload = [];
      availableSKUs.forEach(sku => {
        const qty = skuQuantities[sku];
        if (qty > 0) skusPayload.push({ name: sku, qty });
      });
      if (skusPayload.length === 0) {
        alert("Select SKU quantity");
        setIsSubmitting(false);
        return;
      }

      const record = {
        nationalID: currentUser.nationalID,
        name: currentUser.name,
        region,
        shopName: shop,
        skus: skusPayload,
        receiptPhoto: selfieData,
        longitude: capturedCoords.longitude,
        latitude: capturedCoords.latitude
      };

      console.log("Submitting uplift record with coordinates:", {
        longitude: capturedCoords.longitude,
        latitude: capturedCoords.latitude
      });

      try {
        await apiService.saveUpliftVisit(record);
        
        // Show success overlay
        setSubmittedVisitType("Uplift");
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 1600);

        // Reset form
        setVisitForm({
          visitType: "",
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
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Handle Shop Visit (existing logic)
    let skusPayload = [];
    if (sold === "Yes") {
      availableSKUs.forEach(sku => {
        const qty = skuQuantities[sku];
        if (qty > 0) skusPayload.push({ name: sku, qty });
      });
      if (skusPayload.length === 0) {
        alert("Select SKU quantity");
        setIsSubmitting(false);
        return;
      }

      // Calculate total cartons being sold
      const totalCartonsToSell = skusPayload.reduce((sum, s) => sum + Number(s.qty), 0);

      // Check stock balance
      if (dashboard.stockBalance === 0) {
        alert("Insufficient stock balance. You need to uplift stock before making a sale.");
        setIsSubmitting(false);
        return;
      }

      if (totalCartonsToSell > dashboard.stockBalance) {
        alert(`Insufficient stock balance. You have ${dashboard.stockBalance} cartons available, but trying to sell ${totalCartonsToSell} cartons.`);
        setIsSubmitting(false);
        return;
      }
    }

    let reasonVal = "";
    if (sold === "No") {
      if (!reason) {
        alert("Select reason");
        setIsSubmitting(false);
        return;
      }
      reasonVal = reason === "Other" ? otherReason.trim() : reason;
      if (reason === "Other" && !reasonVal) {
        alert("Specify reason");
        setIsSubmitting(false);
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
      longitude: capturedCoords.longitude,
      latitude: capturedCoords.latitude,
      selfie: selfieData
    };

    console.log("Submitting record with coordinates:", {
      longitude: capturedCoords.longitude,
      latitude: capturedCoords.latitude
    });

    try {
      const result = await apiService.saveVisit(record);
      
      // Check for SKU validation errors
      if (!result.success && result.insufficientSKUs) {
        // Format error message showing each insufficient SKU
        const errorDetails = result.insufficientSKUs
          .map(item => `${item.sku}: requested ${item.requested}, available ${item.available}`)
          .join("\n");
        
        setSubmitError(`❌ Insufficient stock:\n${errorDetails}`);
        setIsSubmitting(false);
        
        // Clear error after 5 seconds
        setTimeout(() => setSubmitError(""), 5000);
        return;
      }
      
      if (!result.success) {
        alert(result.message || "Submission failed. Please try again.");
        setIsSubmitting(false);
        return;
      }
      
      // Show success overlay
      setSubmittedVisitType("Shop Visit");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1600);

      // Reset form and error
      setSubmitError("");
      setVisitForm({
        visitType: "",
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
    } finally {
      setIsSubmitting(false);
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
          <h5>
            {submittedVisitType === "Uplift" 
              ? "Successfully submitted your uplift. Wait for the admin to verify." 
              : "Successfully submitted visit"}
          </h5>
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
          <div className="d-flex justify-content-between mb-2">
            <div>
              <div className="small-muted">Month-to-date</div>
              <h5>Your Analytics</h5>
            </div>
            <div className="text-end small-muted">
              {currentUser?.name}<br />
              {currentUser?.nationalID}
            </div>
          </div>
          
          <div className="row">
            {/* Left Side - Analytics */}
            <div className="col-md-6">
              <div className="small-muted">
                Visits: <strong>{dashboard.visitsMTD}</strong><br />
                Sold: <strong>{dashboard.soldMTD}</strong><br />
                Cartons: <strong>{dashboard.cartonsMTD}</strong><br />
                Efficiency: <strong>{dashboard.efficiency}%</strong>
              </div>
              <div className="small-muted mt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '10px' }}>
                <strong>Your Stock Balance</strong><br />
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: dashboard.stockBalance > 0 ? '#28a745' : '#dc3545' }}>
                  {dashboard.stockBalance} cartons
                </span>
                
                {/* SKU Breakdown */}
                {dashboard.stockBalanceBySKU && Object.keys(dashboard.stockBalanceBySKU).length > 0 && (
                  <div style={{ marginTop: '10px', fontSize: '0.85rem' }}>
                    <strong style={{ display: 'block', marginBottom: '6px' }}>📦 Stock by SKU:</strong>
                    {Object.entries(dashboard.stockBalanceBySKU).map(([sku, qty]) => (
                      <div 
                        key={sku} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          padding: '4px 8px',
                          marginBottom: '4px',
                          backgroundColor: qty > 0 ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
                          borderRadius: '4px',
                          border: qty > 0 ? '1px solid rgba(40, 167, 69, 0.3)' : '1px solid rgba(220, 53, 69, 0.3)'
                        }}
                      >
                        <span>{sku}</span>
                        <span style={{ fontWeight: 'bold', color: qty > 0 ? '#28a745' : '#dc3545' }}>
                          {qty} {qty === 1 ? 'carton' : 'cartons'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Sales Targets Progress */}
              {progress && progress.daily && (
              <div className="mt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '10px' }}>
                <div className="small-muted mb-2">
                  <strong>🎯 Sales Targets</strong>
                </div>
                
                {/* Daily Target */}
                <div className="mb-2">
                  <div className="d-flex justify-content-between align-items-center mb-1" style={{ fontSize: '0.75rem' }}>
                    <span>Daily</span>
                    <span><strong>{progress.daily.current || 0}</strong> / {progress.daily.target || 0} cartons</span>
                  </div>
                  <div style={{ 
                    width: '100%', 
                    height: '8px', 
                    backgroundColor: '#e9ecef', 
                    borderRadius: '4px', 
                    overflow: 'hidden' 
                  }}>
                    <div style={{ 
                      width: `${progress.daily.percentage || 0}%`, 
                      height: '100%', 
                      backgroundColor: (progress.daily.percentage || 0) >= 100 ? '#28a745' : (progress.daily.percentage || 0) >= 50 ? '#ffc107' : '#dc3545',
                      transition: 'width 0.3s ease',
                      borderRadius: '4px'
                    }}></div>
                  </div>
                  <div className="text-end" style={{ fontSize: '0.7rem', marginTop: '2px', fontWeight: 'bold' }}>
                    {progress.daily.percentage || 0}%
                  </div>
                </div>
                
                {/* Weekly Target */}
                <div className="mb-2">
                  <div className="d-flex justify-content-between align-items-center mb-1" style={{ fontSize: '0.75rem' }}>
                    <span>Weekly</span>
                    <span><strong>{progress.weekly.current || 0}</strong> / {progress.weekly.target || 0} cartons</span>
                  </div>
                  <div style={{ 
                    width: '100%', 
                    height: '8px', 
                    backgroundColor: '#e9ecef', 
                    borderRadius: '4px', 
                    overflow: 'hidden' 
                  }}>
                    <div style={{ 
                      width: `${progress.weekly.percentage || 0}%`, 
                      height: '100%', 
                      backgroundColor: (progress.weekly.percentage || 0) >= 100 ? '#28a745' : (progress.weekly.percentage || 0) >= 50 ? '#ffc107' : '#dc3545',
                      transition: 'width 0.3s ease',
                      borderRadius: '4px'
                    }}></div>
                  </div>
                  <div className="text-end" style={{ fontSize: '0.7rem', marginTop: '2px', fontWeight: 'bold' }}>
                    {progress.weekly.percentage || 0}%
                  </div>
                </div>
                
                {/* Monthly Target */}
                <div className="mb-2">
                  <div className="d-flex justify-content-between align-items-center mb-1" style={{ fontSize: '0.75rem' }}>
                    <span>Monthly</span>
                    <span><strong>{progress.monthly.current || 0}</strong> / {progress.monthly.target || 0} cartons</span>
                  </div>
                  <div style={{ 
                    width: '100%', 
                    height: '8px', 
                    backgroundColor: '#e9ecef', 
                    borderRadius: '4px', 
                    overflow: 'hidden' 
                  }}>
                    <div style={{ 
                      width: `${progress.monthly.percentage || 0}%`, 
                      height: '100%', 
                      backgroundColor: (progress.monthly.percentage || 0) >= 100 ? '#28a745' : (progress.monthly.percentage || 0) >= 50 ? '#ffc107' : '#dc3545',
                      transition: 'width 0.3s ease',
                      borderRadius: '4px'
                    }}></div>
                  </div>
                  <div className="text-end" style={{ fontSize: '0.7rem', marginTop: '2px', fontWeight: 'bold' }}>
                    {progress.monthly.percentage || 0}%
                  </div>
                </div>
              </div>
              )}
            </div>

            {/* Right Side - Uplift Status */}
            <div className="col-md-6" style={{ borderLeft: '1px solid rgba(0,0,0,0.1)' }}>
              <div className="small-muted mb-2">
                <strong>Uplift Status (MTD)</strong>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {upliftStatus.length === 0 ? (
                  <div className="text-center text-muted small" style={{ padding: '20px 0' }}>
                    No uplift requests this month
                  </div>
                ) : (
                  upliftStatus.map((uplift, index) => (
                    <div 
                      key={index} 
                      className="small mb-2 p-2" 
                      style={{ 
                        border: '1px solid #dee2e6', 
                        borderRadius: '6px',
                        backgroundColor: uplift.status === 'Approved' ? '#d4edda' : 
                                       uplift.status === 'Rejected' ? '#f8d7da' : '#fff3cd'
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <strong style={{ fontSize: '0.85rem' }}>{uplift.skus}</strong>
                        <span 
                          className="badge" 
                          style={{ 
                            backgroundColor: uplift.status === 'Approved' ? '#28a745' : 
                                           uplift.status === 'Rejected' ? '#dc3545' : '#ffc107',
                            color: uplift.status === 'Pending' ? '#000' : '#fff',
                            fontSize: '0.7rem'
                          }}
                        >
                          {uplift.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                        <strong>{uplift.totalCartons}</strong> cartons
                        <span className="text-muted ms-2">
                          {new Date(uplift.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      {uplift.status === 'Rejected' && uplift.rejectionReason && (
                        <div style={{ 
                          fontSize: '0.75rem', 
                          marginTop: '6px', 
                          padding: '6px', 
                          backgroundColor: 'rgba(220, 53, 69, 0.1)',
                          borderRadius: '4px'
                        }}>
                          <strong>Reason:</strong> {uplift.rejectionReason}
                          <div style={{ color: '#dc3545', fontWeight: '500', marginTop: '4px' }}>
                            Please uplift again
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Error Message Display */}
        {submitError && (
          <div 
            style={{
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              color: '#721c24',
              whiteSpace: 'pre-line',
              fontSize: '0.9rem'
            }}
          >
            {submitError}
          </div>
        )}

        {/* Form Card */}
        <div className="card-custom">
          <form onSubmit={handleSubmit}>
            <label>Visit Type</label>
            <select 
              className="form-select" 
              value={visitForm.visitType}
              onChange={(e) => {
                const newType = e.target.value;
                setVisitForm(prev => ({ ...prev, visitType: newType }));
                // Switch camera based on visit type
                if (newType === "Uplift") {
                  startCamera("environment"); // Rear camera
                } else if (newType === "Shop Visit") {
                  startCamera("user"); // Front camera
                }
                // Reset photo when changing visit type
                setSelfieData("");
              }}
              required
            >
              <option value="">Select visit type</option>
              <option>Uplift</option>
              <option>Shop Visit</option>
            </select>

            {visitForm.visitType && (
              <>
                <label className="mt-3">Region</label>
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

                {visitForm.visitType === "Shop Visit" && (
                  <>
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
                  </>
                )}

                {/* SKU Section */}
                {(visitForm.visitType === "Uplift" || visitForm.sold === "Yes") && (
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
                {visitForm.visitType === "Shop Visit" && visitForm.sold === "No" && (
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

                {/* Photo Capture */}
                <label className="mt-3">
                  {visitForm.visitType === "Uplift" ? "Receipt Photo" : "Selfie"}
                </label>
                <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                  <video 
                    ref={videoRef}
                    id="camera" 
                    autoPlay 
                    muted 
                    playsInline
                  />
                  <button
                    type="button"
                    onClick={flipCamera}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: 'rgba(0,0,0,0.5)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      color: 'white',
                      fontSize: '20px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10
                    }}
                    title="Switch Camera"
                  >
                    🔄
                  </button>
                </div>

                <div className="text-center mt-3">
                  <button type="button" className="btn btn-secondary px-5" onClick={capturePhoto}>
                    Capture
                  </button>
                  {selfieData && (
                    <div className="mt-3">
                      <img 
                        id="preview" 
                        src={selfieData} 
                        alt="Preview" 
                      />
                    </div>
                  )}
                </div>

                <button 
                  type="submit" 
                  className="btn btn-danger w-100 mt-4"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Submitting...
                    </>
                  ) : (
                    visitForm.visitType === "Uplift" ? 'Submit Uplift' : 'Submit Visit'
                  )}
                </button>
              </>
            )}
          </form>
          
          {/* Footer */}
          <div className="mt-4 text-center small text-muted">
            <div className="mb-1">
              <a href="#" className="text-decoration-none text-muted">Terms & Conditions</a> | 
              <a href="#" className="text-decoration-none text-muted ms-1">Privacy Policy</a>
            </div>
            <div style={{ fontSize: '11px' }}>
              © 2025 MNF Sales. All rights reserved.
            </div>
          </div>
        </div>
      </div>

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </>
  );
};

export default SalesApp;