# Deployment Guide

## Vercel Deployment

### Prerequisites
- GitHub account
- Vercel account (linked to GitHub)

### Steps

1. **Push to GitHub** (already done)
   ```bash
   git add .
   git commit -m "Deploy to Vercel"
   git push
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import from GitHub: `MNFSalesVisit/MNFSalesVisit`

3. **Configure Project**
   - **Framework Preset:** Vite
   - **Root Directory:** `.` (repository root)
   - **Build Command:** `npm run vercel-build`
   - **Output Directory:** `dist`

4. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes for first deployment

### Environment Variables (if needed)
- No environment variables required for current setup
- Backend URL is hardcoded in `src/services/api.js`

### Custom Domain (Optional)
1. Go to Vercel project settings
2. Add custom domain
3. Configure DNS records as instructed

## Alternative Deployment Options

### Netlify
1. Connect GitHub repository
2. Build command: `npm run build`
3. Publish directory: `dist`

### GitHub Pages
1. Enable GitHub Pages in repository settings
2. Use GitHub Actions for automated deployment
3. Build and deploy to `gh-pages` branch

### Traditional Hosting
1. Run `npm run build`
2. Upload `dist` folder contents to web server
3. Configure server for SPA routing