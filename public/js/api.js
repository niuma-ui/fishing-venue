// API 客户端 - 与后端通信
const API = {
  baseUrl: '/api',
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  accessKey: localStorage.getItem('accessKey') || 'fishing-gate-2026-x7k9m2',

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },

  clearAuth() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  async request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Access-Key': this.accessKey,
      ...(options.headers || {}),
    };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    try {
      const res = await fetch(`${this.baseUrl}${path}`, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) { this.clearAuth(); }
        throw new Error(data.error || `请求失败 (${res.status})`);
      }
      return data;
    } catch (err) {
      if (err.message.includes('Failed to fetch')) throw new Error('网络连接失败，请检查服务器是否启动');
      throw err;
    }
  },

  // 认证
  async login(phone, password) { return this.request('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) }); },
  async register(phone, password, name) { return this.request('/auth/register', { method: 'POST', body: JSON.stringify({ phone, password, name }) }); },
  async getMe() { return this.request('/auth/me'); },

  // 钓场配置
  async getVenue() { return this.request('/venue'); },
  async updateVenue(data) { return this.request('/venue', { method: 'PUT', body: JSON.stringify(data) }); },

  // 项目与场次
  async getProjects() { return this.request('/projects'); },
  async getSlots(date, projectId) {
    const params = new URLSearchParams({ date });
    if (projectId) params.set('projectId', projectId);
    return this.request(`/slots?${params}`);
  },

  // 钓位地图
  async getSeatMap(projectId, date, sessionCode) {
    const params = new URLSearchParams({ projectId, date, sessionCode });
    return this.request(`/seat-map?${params}`);
  },

  // 订单
  async createOrder(data) { return this.request('/orders', { method: 'POST', body: JSON.stringify(data) }); },
  async getOrders() { return this.request('/orders'); },
  async getOrder(id) { return this.request(`/orders/${id}`); },
  async cancelOrder(id) { return this.request(`/orders/${id}/cancel`, { method: 'POST' }); },

  // 鱼情
  async getFishReports(projectId) {
    const params = projectId ? `?projectId=${projectId}` : '';
    return this.request(`/fish-reports${params}`);
  },
  async createFishReport(data) { return this.request('/fish-reports', { method: 'POST', body: JSON.stringify(data) }); },

  // 管理
  async updateCapacity(data) { return this.request('/admin/capacity', { method: 'PUT', body: JSON.stringify(data) }); },
  async checkin(data) { return this.request('/admin/checkin', { method: 'POST', body: JSON.stringify(data) }); },
  async adminGetOrders(date, status) {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (status) params.set('status', status);
    return this.request(`/admin/orders?${params}`);
  },
};
