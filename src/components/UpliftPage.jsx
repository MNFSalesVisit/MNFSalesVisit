import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

const MAX_WIDTH = 1200;

function resizeFileToDataUrl(file, maxWidth = MAX_WIDTH, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        const width = Math.min(maxWidth, img.width);
        const height = Math.round(width / ratio);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function UpliftPage() {
  const navigate = useNavigate();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [skuQuantities, setSkuQuantities] = useState({ Chicken: 0, Beef: 0, 'Supa Mojo': 0 });
  const [shopName, setShopName] = useState('');
  const [region, setRegion] = useState('');
  const [regionOther, setRegionOther] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const changeQuantity = (sku, delta) => {
    setSkuQuantities(prev => ({ ...prev, [sku]: Math.max(0, (prev[sku] || 0) + delta) }));
  };

  const handleFiles = async (files) => {
    const arr = Array.from(files || []);
    setSelectedFiles(arr);
    const p = [];
    for (const f of arr) {
      try {
        const dataUrl = await resizeFileToDataUrl(f);
        p.push(dataUrl);
      } catch (e) {
        console.error('Resize failed for', f.name, e);
      }
    }
    setPreviews(p);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) {
      await handleFiles(dt.files);
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };

  const handleDragLeave = (e) => { e.preventDefault(); setDragOver(false); };

  const captureLocation = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject('Geolocation not supported');
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      err => reject(err.message || 'Unable to get location'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const skusPayload = Object.keys(skuQuantities).map(k => ({ name: k, qty: Number(skuQuantities[k] || 0) })).filter(x => x.qty > 0);
    if (skusPayload.length === 0) { alert('Select SKU quantities'); return; }
    if (previews.length === 0) { alert('Upload at least one receipt image'); return; }
    const resolvedRegion = region === 'Other' ? (regionOther || '').trim() : region;
    if (!shopName || shopName.trim().length < 2) { alert('Enter shop name'); return; }
    if (!resolvedRegion || resolvedRegion.length < 2) { alert('Enter region'); return; }

    setIsSubmitting(true);
    let coords = { latitude: '', longitude: '' };
    try { coords = await captureLocation(); } catch (err) { alert('Location failed: ' + err); setIsSubmitting(false); return; }

    const session = localStorage.getItem('userSession');
    const user = session ? JSON.parse(session) : { nationalID: '', name: '' };

    const record = {
      nationalID: user.nationalID,
      name: user.name,
      region: region === 'Other' ? regionOther : region,
      shopName: shopName,
      skus: skusPayload,
      receiptPhoto: previews,
      longitude: coords.longitude,
      latitude: coords.latitude
    };

    try {
      const res = await apiService.saveUpliftVisit(record);
      console.log('saveUpliftVisit response', res);
      alert('Uplift submitted');
      navigate('/');
    } catch (err) {
      console.error(err);
      alert('Submit failed: ' + (err && err.message ? err.message : String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container-root">
      <div className="card-custom" style={{ padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Uplift — Upload Receipt</h2>
        <p className="small-muted">Use this form to submit stock uplifts. Upload receipt images, select SKUs and quantities.</p>

        <style>{`
          .modern-input { background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 12px; padding: 10px 12px; width:100%; font-weight:500; }
          .modern-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 6px 20px rgba(217,4,41,0.08); background: #fff; }
          .btn-primary-custom { background: linear-gradient(135deg, #d90429 0%, #a4031f 100%); border:none; color:white; padding:10px 18px; border-radius:10px; font-weight:700; cursor:pointer; box-shadow: 0 8px 20px rgba(217,4,41,0.12); }
          .btn-primary-custom:hover { transform: translateY(-2px); }
          .btn-secondary-custom { background: #f8f9fa; border: 2px solid #e9ecef; color: #333; padding:8px 14px; border-radius:10px; cursor:pointer; }
          .btn-secondary-custom:hover { transform: translateY(-2px); }
          .dropzone { border: 2px dashed #e9ecef; border-radius:12px; padding:18px; text-align:center; cursor:pointer; transition: all .15s ease; }
          .dropzone.drag { border-color: var(--primary); background: rgba(217,4,41,0.03); }
          .thumb { width:110px; border-radius:8px; border:1px solid #eaeaea; }
        `}</style>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label>📍 Region</label>
            <select className="modern-input" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">Select region</option>
              <option value="Mvita">Mvita</option>
              <option value="Nyali">Nyali</option>
              <option value="Kisauni">Kisauni</option>
              <option value="Likoni">Likoni</option>
              <option value="Changamwe">Changamwe</option>
              <option value="Jomvu">Jomvu</option>
              <option value="Other">Other</option>
            </select>
            {region === 'Other' && (
              <input className="modern-input" style={{ marginTop: 8 }} placeholder="Specify region" value={regionOther} onChange={(e) => setRegionOther(e.target.value)} />
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>🏪 Shop Name</label>
            <input className="modern-input" placeholder="Shop name" value={shopName} onChange={(e) => setShopName(e.target.value)} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>📷 Upload receipt images</label>
            <div
              className={`dropzone ${dragOver ? 'drag' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById('uplift-file-input').click()}
            >
              <div className="small-muted">Drag & drop images here, or click to select files</div>
              <input id="uplift-file-input" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {previews.map((p, i) => (
                <img key={i} src={p} alt={`preview-${i}`} className="thumb" />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>🧾 Select SKU & quantity</label>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              {Object.keys(skuQuantities).map(sku => (
                <div key={sku} style={{ textAlign: 'center', width: 120 }}>
                  <div style={{ fontWeight: 700 }}>{sku}</div>
                  <div className="qty-buttons" style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                    <button type="button" className="btn-secondary-custom" onClick={() => changeQuantity(sku, -1)}>-</button>
                    <div style={{ minWidth: 36, textAlign: 'center', fontWeight: 700 }}>{skuQuantities[sku]}</div>
                    <button type="button" className="btn-primary-custom" onClick={() => changeQuantity(sku, 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button type="submit" className="btn-primary-custom" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit Uplift'}</button>
            <button type="button" className="btn-secondary-custom" onClick={() => navigate(-1)} style={{ marginLeft: 12 }}>Cancel</button>
            <button type="button" className="btn-secondary-custom" onClick={() => navigate('/')} style={{ marginLeft: 12 }}>Back to Home</button>
          </div>
        </form>
      </div>
    </div>
  );
}
