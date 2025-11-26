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

  async saveUpliftVisit(record) {
    return await this.request({
      action: "saveUpliftVisit",
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

  async getAllUpliftVisits() {
    return await this.request({
      action: "getAllUpliftVisits"
    });
  }

  async getPendingUplifts() {
    return await this.request({
      action: "getPendingUplifts"
    });
  }

  async approveUplift(rowIndex, approvedBy) {
    return await this.request({
      action: "approveUplift",
      rowIndex,
      approvedBy
    });
  }

  async rejectUplift(rowIndex, reason, rejectedBy) {
    return await this.request({
      action: "rejectUplift",
      rowIndex,
      reason,
      rejectedBy
    });
  }

  async getUserUpliftStatus(nationalID) {
    return await this.request({
      action: "getUserUpliftStatus",
      nationalID
    });
  }

  async getAdminSummary(params) {
    return await this.request({
      action: "adminSummary",
      params
    });
  }

  async getSKUAnalysis(params) {
    return await this.request({
      action: "getSKUAnalysis",
      params
    });
  }

  async setUserTargets(nationalID, name, dailyTarget, weeklyTarget, monthlyTarget) {
    return await this.request({
      action: "setUserTargets",
      nationalID,
      name,
      dailyTarget,
      weeklyTarget,
      monthlyTarget
    });
  }

  async getUserTargets(nationalID) {
    return await this.request({
      action: "getUserTargets",
      nationalID
    });
  }

  async getAllTargets() {
    return await this.request({
      action: "getAllTargets"
    });
  }

  async getUserProgress(nationalID) {
    return await this.request({
      action: "getUserProgress",
      nationalID
    });
  }

  async getStockBalanceBySKU(nationalID) {
    return await this.request({
      action: "getStockBalanceBySKU",
      nationalID
    });
  }

  async getAllUsersStockBalance() {
    return await this.request({
      action: "getAllUsersStockBalance"
    });
  }
}

export const apiService = new ApiService();