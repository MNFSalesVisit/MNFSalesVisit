# API Documentation

## Sales Visit App Backend API

Base URL: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`

### Authentication

#### Login
- **Endpoint:** `POST /`
- **Action:** `login`
- **Parameters:**
  ```json
  {
    "action": "login",
    "nationalID": "string",
    "password": "string"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "nationalID": "string",
    "name": "string", 
    "role": "user|admin"
  }
  ```

### Visit Management

#### Save Visit
- **Endpoint:** `POST /`
- **Action:** `saveVisit`
- **Parameters:**
  ```json
  {
    "action": "saveVisit",
    "record": {
      "nationalID": "string",
      "name": "string",
      "region": "string",
      "shopName": "string",
      "sold": "Yes|No",
      "skus": [{"name": "string", "qty": number}],
      "reason": "string",
      "longitude": number,
      "latitude": number,
      "selfie": "base64string"
    }
  }
  ```

#### Get Dashboard
- **Endpoint:** `POST /`
- **Action:** `dashboard`
- **Parameters:**
  ```json
  {
    "action": "dashboard",
    "nationalID": "string"
  }
  ```
- **Response:**
  ```json
  {
    "visitsMTD": number,
    "soldMTD": number,
    "cartonsMTD": number,
    "efficiency": number
  }
  ```

### Admin Endpoints

#### Get All Visits
- **Endpoint:** `POST /`
- **Action:** `getAllVisits`

#### Get Admin Summary
- **Endpoint:** `POST /`
- **Action:** `adminSummary`
- **Parameters:**
  ```json
  {
    "action": "adminSummary",
    "params": {
      "type": "daily|weekly|monthly",
      "month": number,
      "year": number
    }
  }
  ```

## Error Handling

All endpoints return:
```json
{
  "success": false,
  "message": "Error description"
}
```