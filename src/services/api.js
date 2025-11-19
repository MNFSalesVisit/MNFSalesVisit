const BACKEND_URL = "https://script.google.com/macros/s/AKfycbxPuK8Vwl30zuyrutpLZfu81LYjPzPMUPCFBNxWzL-w5grgcx0vDtMBp9l5WJRuj2cC/exec";

class ApiService {
  async request(payload) {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    return await response.json();
  }

  async login(nationalID, password) {
    return await this.request({
      action: "login",
      nationalID,
      password
    });
  }

  async saveVisit(record) {
    return await this.request({
      action: "saveVisit",
      record
    });
  }

  async getDashboard(nationalID) {
    return await this.request({
      action: "dashboard",
      nationalID
    });
  }

  async getAllVisits() {
    return await this.request({
      action: "getAllVisits"
    });
  }

  async getAdminSummary(params) {
    return await this.request({
      action: "adminSummary",
      params
    });
  }
}

export const apiService = new ApiService();