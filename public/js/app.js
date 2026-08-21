// 主应用 - 路由与页面渲染
const App = {
  currentRoute: '',
  bookingDraft: JSON.parse(localStorage.getItem('bookingDraft') || 'null'),

  init() {
    window.addEventListener('hashchange', () => this.router());
    document.getElementById('loginBtn').addEventListener('click', () => location.hash = '#/login');
    document.getElementById('navToggle').addEventListener('click', () => {
      document.getElementById('navLinks').classList.toggle('open');
    });
    this.updateNav();
    this.router();
  },

  router() {
    const hash = location.hash.slice(1) || '/';
    this.currentRoute = hash;
    document.getElementById('navLinks').classList.remove('open');
    this.updateActiveNav();

    const routes = {
      '/': () => this.renderHome(),
      '/booking': () => this.renderBooking(),
      '/seat-map': () => this.renderSeatMap(),
      '/confirm': () => this.renderConfirm(),
      '/orders': () => this.renderOrders(),
      '/order': () => this.renderOrderDetail(),
      '/fish': () => this.renderFish(),
      '/login': () => this.renderLogin(),
      '/admin': () => this.renderAdmin(),
    };

    const route = Object.keys(routes).find(r => hash === r || hash.startsWith(r + '/'));
    if (route) routes[route]();
    else this.renderHome();
    window.scrollTo(0, 0);
  },

  updateActiveNav() {
    document.querySelectorAll('.nav-link').forEach(link => {
      const r = link.dataset.route;
      link.classList.toggle('active', this.currentRoute === r || (r !== '/' && this.currentRoute.startsWith(r)));
    });
  },

  updateNav() {
    const navUser = document.getElementById('navUser');
    if (API.user) {
      const initial = (API.user.name || API.user.phone).charAt(0).toUpperCase();
      const isAdmin = API.user.role === 'admin';
      navUser.innerHTML = `
        <div class="user-avatar" id="userAvatar">${initial}</div>
        <div class="user-menu" id="userMenu" style="display:none">
          ${isAdmin ? '<a class="user-menu-item" href="#/admin">管理后台</a>' : ''}
          <a class="user-menu-item" href="#/orders">我的订单</a>
          <button class="user-menu-item danger" id="logoutBtn">退出登录</button>
        </div>
      `;
      document.getElementById('userAvatar').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('userMenu').style.display = 'block';
      });
      document.addEventListener('click', () => {
        const m = document.getElementById('userMenu');
        if (m) m.style.display = 'none';
      });
      document.getElementById('logoutBtn').addEventListener('click', () => {
        API.clearAuth();
        this.updateNav();
        this.toast('已退出登录', 'success');
        location.hash = '#/';
      });
    } else {
      navUser.innerHTML = '<button class="btn btn-outline btn-sm" id="loginBtn">登录</button>';
      document.getElementById('loginBtn').addEventListener('click', () => location.hash = '#/login');
    }
  },

  toast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-10px)'; setTimeout(() => el.remove(), 300); }, 2500);
  },

  requireAuth() {
    if (!API.user) { this.toast('请先登录', 'error'); location.hash = '#/login'; return false; }
    return true;
  },

  // ========== 首页 ==========
  async renderHome() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="card" style="text-align:center"><p>加载中...</p></div>';
    try {
      const [venue, reports] = await Promise.all([API.getVenue(), API.getFishReports()]);
      const liveReports = reports.reports.filter(r => r.isLive);
      app.innerHTML = `
        <div class="hero">
          <div class="hero-kicker">FISHING · 垂钓预约</div>
          <h1 class="hero-title">${venue.name}</h1>
          <p class="hero-subtitle">${venue.slogan}</p>
          <div class="hero-actions">
            <a href="#/booking" class="btn btn-accent btn-lg">立即预约钓位 →</a>
            <a href="#/fish" class="btn btn-outline btn-lg" style="border-color:rgba(255,255,255,0.4);color:#fff">查看实时鱼情</a>
          </div>
          <div class="hero-stats">
            <div><div class="hero-stat-num">2</div><div class="hero-stat-label">垂钓塘口</div></div>
            <div><div class="hero-stat-num">60</div><div class="hero-stat-label">钓位总数</div></div>
            <div><div class="hero-stat-num">${liveReports.length}</div><div class="hero-stat-label">今日实时播报</div></div>
          </div>
        </div>

        ${venue.notice ? `<div class="card" style="margin-bottom:24px;display:flex;align-items:center;gap:16px">
          <span style="font-size:24px">📢</span>
          <div><strong style="font-size:15px">今日公告</strong><p style="color:var(--muted);font-size:14px;margin-top:4px">${venue.notice}</p></div>
        </div>` : ''}

        <div class="home-grid">
          <div class="card home-card" onclick="location.hash='#/booking'">
            <div class="home-card-icon">🎣</div>
            <div class="home-card-title">在线预约</div>
            <div class="home-card-desc">选择日期、塘口和场次，在地图上挑选心仪钓位，一键完成预约。</div>
            <div class="home-card-arrow">去预约 →</div>
          </div>
          <div class="card home-card" onclick="location.hash='#/fish'">
            <div class="home-card-icon">🐟</div>
            <div class="home-card-title">实时鱼情</div>
            <div class="home-card-desc">现场值班人员实时更新放鱼、出鱼和水情，帮你判断最佳出钓时机。</div>
            <div class="home-card-arrow">看鱼情 →</div>
          </div>
        </div>

        ${reports.reports.length ? `
        <div class="fish-preview">
          <div class="section-header">
            <div><div class="section-title">最新鱼情</div><div class="section-subtitle">来自现场的实时播报</div></div>
            <a href="#/fish" class="section-link">查看全部 →</a>
          </div>
          ${reports.reports.slice(0, 2).map(r => this.fishReportCard(r)).join('')}
        </div>` : ''}

        <div class="card" style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
          <div style="display:flex;gap:16px;align-items:flex-start">
            <span style="font-size:28px">📍</span>
            <div><strong style="font-size:15px">钓场地址</strong><p style="color:var(--muted);font-size:14px;margin-top:4px">${venue.address || '请在管理后台设置'}</p></div>
          </div>
          <div style="display:flex;gap:16px;align-items:flex-start">
            <span style="font-size:28px">📞</span>
            <div><strong style="font-size:15px">联系电话</strong><p style="color:var(--muted);font-size:14px;margin-top:4px">${venue.phone || '请在管理后台设置'}　营业时间：${venue.openingHours}</p></div>
          </div>
        </div>
      `;
    } catch (err) {
      app.innerHTML = `<div class="card" style="text-align:center"><p style="color:var(--danger)">${err.message}</p><button class="btn btn-primary" style="margin-top:16px" onclick="App.router()">重试</button></div>`;
    }
  },

  fishReportCard(r) {
    return `<div class="card fish-report-card">
      <div class="fish-report-header">
        <div style="display:flex;align-items:center;gap:10px">
          <span class="fish-report-pond ${r.tone}">${r.pondName}</span>
          ${r.isLive ? '<span class="live-badge"><span class="live-dot"></span>实时</span>' : ''}
        </div>
        <span class="fish-report-date">${r.dateLabel}</span>
      </div>
      <div class="fish-report-title">${r.title}</div>
      <div class="fish-report-desc">${r.description}</div>
      <div class="fish-report-metrics">
        <div class="fish-metric"><span class="fish-metric-val">${r.fishWeight}</span><span class="fish-metric-label">鱼获</span></div>
        ${r.releaseAmount ? `<div class="fish-metric"><span class="fish-metric-val">${r.releaseAmount}</span><span class="fish-metric-label">放鱼</span></div>` : ''}
        ${r.waterTemp ? `<div class="fish-metric"><span class="fish-metric-val">${r.waterTemp}</span><span class="fish-metric-label">水温</span></div>` : ''}
      </div>
    </div>`;
  },

  // ========== 预约页 ==========
  async renderBooking() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="card" style="text-align:center"><p>加载中...</p></div>';
    try {
      const projects = await API.getProjects();
      const dates = this.generateDates(10);
      const state = { date: dates[0].value, projectId: 'mixed', sessionCode: 'day' };

      const render = async () => {
        const slots = await API.getSlots(state.date, state.projectId);
        const project = projects.projects.find(p => p.id === state.projectId);
        const session = slots.slots.find(s => s.sessionCode === state.sessionCode) || slots.slots[0];
        const price = session ? session.price : 0;

        app.innerHTML = `
          <div class="section-header" style="margin-bottom:24px">
            <div><div class="section-title">预约钓位</div><div class="section-subtitle">选择日期、塘口和场次，下一步在地图上挑选钓位</div></div>
          </div>
          <div class="booking-layout">
            <div>
              <div class="booking-step">
                <div class="step-label">01 · 选择日期</div>
                <div class="date-picker-row">
                  ${dates.map(d => `<div class="date-chip ${state.date === d.value ? 'active' : ''}" data-date="${d.value}">
                    <div class="date-chip-week">${d.week}</div>
                    <div class="date-chip-day">${d.day}</div>
                    <div class="date-chip-month">${d.month}</div>
                  </div>`).join('')}
                </div>
              </div>
              <div class="booking-step">
                <div class="step-label">02 · 选择塘口</div>
                <div class="pond-grid">
                  ${projects.projects.map(p => `<div class="pond-option ${state.projectId === p.id ? 'active' : ''}" data-project="${p.id}">
                    <div class="pond-option-name">${p.name}</div>
                    <div class="pond-option-desc">${p.description}</div>
                    <div class="pond-option-price">¥${p.id === 'mixed' ? (state.sessionCode === 'night' ? 100 : 120) : (state.sessionCode === 'night' ? 80 : 90)}<span style="font-size:13px;font-weight:400;color:var(--muted)">/位起</span></div>
                  </div>`).join('')}
                </div>
              </div>
              <div class="booking-step">
                <div class="step-label">03 · 选择场次</div>
                <div class="session-list">
                  ${slots.slots.map(s => `<div class="session-option ${state.sessionCode === s.sessionCode ? 'active' : ''} ${s.availableQuantity <= 0 ? 'disabled' : ''}" data-session="${s.sessionCode}">
                    <div><div class="session-name">${s.session_name}</div><div class="session-time">${s.start_time} - ${s.end_time} · 余 ${s.availableQuantity} 位</div></div>
                    <div class="session-price">¥${s.price}<span style="font-size:13px;font-weight:400">/位</span></div>
                  </div>`).join('')}
                </div>
              </div>
            </div>
            <div class="booking-sidebar">
              <div class="card booking-summary">
                <h3 style="font-size:18px;margin-bottom:16px">预约摘要</h3>
                <div class="summary-row"><span>日期</span><span>${dates.find(d => d.value === state.date)?.label}</span></div>
                <div class="summary-row"><span>塘口</span><span>${project?.name}</span></div>
                <div class="summary-row"><span>场次</span><span>${session?.session_name}</span></div>
                <div class="summary-row"><span>单价</span><span>¥${price}/位</span></div>
                <div class="summary-row total"><span>预计</span><span class="summary-total-price">选座后确认</span></div>
                <button class="btn btn-primary btn-block btn-lg" style="margin-top:20px" id="continueBtn">选择钓位 →</button>
                <p class="form-hint" style="text-align:center;margin-top:12px">下一步在地图上选择具体钓位</p>
              </div>
            </div>
          </div>
        `;

        document.querySelectorAll('.date-chip').forEach(el => el.addEventListener('click', () => { state.date = el.dataset.date; render(); }));
        document.querySelectorAll('.pond-option').forEach(el => el.addEventListener('click', () => { state.projectId = el.dataset.project; render(); }));
        document.querySelectorAll('.session-option').forEach(el => el.addEventListener('click', () => {
          if (el.classList.contains('disabled')) return;
          state.sessionCode = el.dataset.session; render();
        }));
        document.getElementById('continueBtn').addEventListener('click', () => {
          if (!this.requireAuth()) return;
          this.bookingDraft = { ...state, dateLabel: dates.find(d => d.value === state.date)?.label, projectName: project?.name };
          localStorage.setItem('bookingDraft', JSON.stringify(this.bookingDraft));
          location.hash = '#/seat-map';
        });
      };
      render();
    } catch (err) {
      app.innerHTML = `<div class="card" style="text-align:center"><p style="color:var(--danger)">${err.message}</p></div>`;
    }
  },

  generateDates(count) {
    const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const result = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const m = d.getMonth() + 1, day = d.getDate();
      result.push({
        value: `${d.getFullYear()}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        week: i === 0 ? '今天' : i === 1 ? '明天' : weekNames[d.getDay()],
        day: String(day),
        month: `${m}/${day}`,
        label: `${m}月${day}日 ${weekNames[d.getDay()]}`,
      });
    }
    return result;
  },

  // ========== 钓位地图页 ==========
  async renderSeatMap() {
    if (!this.requireAuth()) return;
    const draft = this.bookingDraft;
    if (!draft) { location.hash = '#/booking'; return; }
    const app = document.getElementById('app');
    app.innerHTML = '<div class="card" style="text-align:center"><p>加载钓位地图中...</p></div>';
    try {
      const data = await API.getSeatMap(draft.projectId, draft.date, draft.sessionCode);
      const selected = new Set();
      const maxSelect = 6;

      const render = () => {
        const totalPrice = selected.size * (draft.projectId === 'mixed' ? (draft.sessionCode === 'night' ? 100 : 120) : (draft.sessionCode === 'night' ? 80 : 90));
        app.innerHTML = `
          <div style="margin-bottom:24px"><a href="#/booking" class="btn btn-outline btn-sm">← 返回修改</a></div>
          <div class="section-header" style="margin-bottom:20px">
            <div><div class="section-title">选择钓位</div><div class="section-subtitle">${draft.dateLabel} · ${data.pondName} · 点击绿色钓位选择，最多 ${maxSelect} 个</div></div>
          </div>
          <div class="seat-map-container">
            <div class="seat-map-canvas">
              <span class="seat-area-tag" style="top:12px;left:50%;transform:translateX(-50%)">北岸</span>
              <span class="seat-area-tag" style="bottom:12px;left:50%;transform:translateX(-50%)">南岸</span>
              <span class="seat-area-tag" style="right:10px;top:50%;transform:translateY(-50%)">东岸</span>
              <span class="seat-area-tag" style="left:10px;top:50%;transform:translateY(-50%)">西岸</span>
              <div class="seat-pond">
                <div class="seat-pond-rim"></div>
                <div class="seat-pond-water"></div>
                <div class="seat-pond-label">
                  <div class="seat-pond-label-name">${data.pondName}</div>
                  <div class="seat-pond-label-stat">可选 <strong>${data.availableCount - selected.size}</strong> / ${data.seats.length}</div>
                </div>
              </div>
              ${data.seats.map(s => `<div class="seat ${s.status} ${selected.has(s.seatId) ? 'seat-selected' : ''}" data-id="${s.seatId}" style="left:${s.x}%;top:${s.y}%" title="${s.seatNo}号 · ${s.areaName}${s.features ? ' · ' + s.features.join(',') : ''}">${s.seatNo}</div>`).join('')}
            </div>
            <div class="seat-legend">
              <div class="legend-item"><span class="legend-dot" style="background:#4a8f6f"></span>可选</div>
              <div class="legend-item"><span class="legend-dot" style="background:#c4c0b6"></span>已占</div>
              <div class="legend-item"><span class="legend-dot" style="background:var(--accent)"></span>已选</div>
            </div>
          </div>
          <div class="card" style="margin-top:24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
            <div>
              <div style="font-size:14px;color:var(--muted)">已选钓位</div>
              <div style="margin-top:8px">${selected.size ? Array.from(selected).map(id => { const s = data.seats.find(x => x.seatId === id); return `<span class="seat-chip">${s.seatNo}号 · ${s.areaName}</span>`; }).join('') : '<span style="color:var(--muted);font-size:14px">点击地图上的绿色钓位进行选择</span>'}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:14px;color:var(--muted)">${selected.size} 个钓位 · 合计</div>
              <div style="font-size:28px;font-weight:700;color:var(--accent)">¥${totalPrice}</div>
              <button class="btn btn-primary" style="margin-top:8px" id="confirmSeatBtn" ${selected.size === 0 ? 'disabled' : ''}>确认选座 →</button>
            </div>
          </div>
        `;
        document.querySelectorAll('.seat').forEach(el => el.addEventListener('click', () => {
          const id = el.dataset.id;
          const seat = data.seats.find(s => s.seatId === id);
          if (seat.status === 'occupied') { this.toast('该钓位已被占用', 'error'); return; }
          if (selected.has(id)) selected.delete(id);
          else if (selected.size >= maxSelect) { this.toast(`最多选择 ${maxSelect} 个钓位`, 'error'); return; }
          else selected.add(id);
          render();
        }));
        document.getElementById('confirmSeatBtn').addEventListener('click', () => {
          const seatNos = Array.from(selected).map(id => data.seats.find(s => s.seatId === id).seatNo);
          this.bookingDraft = { ...draft, selectedSeats: Array.from(selected), seatNos, totalPrice };
          localStorage.setItem('bookingDraft', JSON.stringify(this.bookingDraft));
          location.hash = '#/confirm';
        });
      };
      render();
    } catch (err) {
      app.innerHTML = `<div class="card" style="text-align:center"><p style="color:var(--danger)">${err.message}</p><a href="#/booking" class="btn btn-primary" style="margin-top:16px">返回预约</a></div>`;
    }
  },

  // ========== 确认预约页 ==========
  async renderConfirm() {
    if (!this.requireAuth()) return;
    const draft = this.bookingDraft;
    if (!draft || !draft.seatNos) { location.hash = '#/booking'; return; }
    const app = document.getElementById('app');
    const venue = await API.getVenue().catch(() => ({}));
    app.innerHTML = `
      <div style="margin-bottom:24px"><a href="#/seat-map" class="btn btn-outline btn-sm">← 返回选座</a></div>
      <div class="section-header" style="margin-bottom:24px"><div><div class="section-title">确认预约信息</div><div class="section-subtitle">请核对以下信息，提交后名额将暂时保留</div></div></div>
      <div class="booking-layout">
        <div>
          <div class="card" style="margin-bottom:24px">
            <h3 style="font-size:18px;margin-bottom:16px">预约详情</h3>
            <div class="detail-row"><span class="detail-label">塘口</span><span class="detail-value">${draft.projectName}</span></div>
            <div class="detail-row"><span class="detail-label">日期</span><span class="detail-value">${draft.dateLabel}</span></div>
            <div class="detail-row"><span class="detail-label">场次</span><span class="detail-value">${draft.sessionCode === 'day' ? '日场' : '夜场'}</span></div>
            <div class="detail-row"><span class="detail-label">钓位</span><span class="seat-chips">${draft.seatNos.map(n => `<span class="seat-chip">${n}号</span>`).join('')}</span></div>
            <div class="detail-row"><span class="detail-label">数量</span><span class="detail-value">${draft.seatNos.length} 位</span></div>
            <div class="detail-row"><span class="detail-label">合计</span><span class="detail-value" style="color:var(--accent);font-size:20px">¥${draft.totalPrice}</span></div>
          </div>
          <div class="card">
            <h3 style="font-size:18px;margin-bottom:16px">联系人信息</h3>
            <div class="form-group"><label class="form-label">联系人姓名</label><input class="form-input" id="contactName" placeholder="请填写姓名" maxlength="20" value="${API.user.name || ''}"></div>
            <div class="form-group"><label class="form-label">联系电话</label><input class="form-input" id="contactPhone" placeholder="请填写手机号" type="tel" maxlength="11" value="${API.user.phone && API.user.phone.length === 11 ? API.user.phone : ''}"></div>
          </div>
          ${venue.pricingNote ? `<div class="card" style="margin-top:24px;background:var(--accent-light)"><strong style="font-size:14px">收费说明</strong><p style="font-size:14px;color:#7a5a2f;margin-top:8px;line-height:1.7">${venue.pricingNote}</p></div>` : ''}
        </div>
        <div class="booking-sidebar">
          <div class="card booking-summary">
            <h3 style="font-size:18px;margin-bottom:16px">费用明细</h3>
            <div class="summary-row"><span>钓位费</span><span>¥${draft.totalPrice}</span></div>
            <div class="summary-row"><span>支付方式</span><span>到场支付</span></div>
            <div class="summary-row total"><span>应付</span><span class="summary-total-price">¥${draft.totalPrice}</span></div>
            <label style="display:flex;align-items:center;gap:10px;margin-top:20px;cursor:pointer;font-size:14px">
              <input type="checkbox" id="agreeCheck" style="width:18px;height:18px"> 我已阅读并同意入场规则
            </label>
            <button class="btn btn-primary btn-block btn-lg" style="margin-top:20px" id="submitBtn">确认预约</button>
            <p class="form-hint" style="text-align:center;margin-top:12px">提交后请按时到场，向管理员出示预约码</p>
          </div>
        </div>
      </div>
    `;
    document.getElementById('submitBtn').addEventListener('click', async () => {
      const name = document.getElementById('contactName').value.trim();
      const phone = document.getElementById('contactPhone').value.trim();
      const agreed = document.getElementById('agreeCheck').checked;
      if (!name) return this.toast('请填写联系人姓名', 'error');
      if (!/^1\d{10}$/.test(phone)) return this.toast('请填写正确的手机号', 'error');
      if (!agreed) return this.toast('请先同意入场规则', 'error');
      const btn = document.getElementById('submitBtn');
      btn.disabled = true; btn.textContent = '提交中...';
      try {
        const result = await API.createOrder({
          projectId: draft.projectId, bookingDate: draft.date, dateLabel: draft.dateLabel,
          sessionCode: draft.sessionCode, quantity: draft.seatNos.length, seatNos: draft.seatNos,
          contactName: name, contactPhone: phone,
        });
        localStorage.removeItem('bookingDraft');
        this.bookingDraft = null;
        this.toast('预约成功！', 'success');
        location.hash = `#/order?id=${result.order.id}`;
      } catch (err) {
        this.toast(err.message, 'error');
        btn.disabled = false; btn.textContent = '确认预约';
      }
    });
  },

  // ========== 订单列表 ==========
  async renderOrders() {
    if (!this.requireAuth()) return;
    const app = document.getElementById('app');
    app.innerHTML = '<div class="card" style="text-align:center"><p>加载中...</p></div>';
    try {
      const result = await API.getOrders();
      if (!result.orders.length) {
        app.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">暂无订单</div><a href="#/booking" class="btn btn-primary" style="margin-top:20px">去预约</a></div>`;
        return;
      }
      app.innerHTML = `
        <div class="section-header" style="margin-bottom:24px"><div><div class="section-title">我的订单</div><div class="section-subtitle">共 ${result.orders.length} 条订单</div></div></div>
        <div class="order-list">
          ${result.orders.map(o => `<div class="card order-card" onclick="location.hash='#/order?id=${o.id}'">
            <div class="order-card-header">
              <div><span class="order-pond">${o.pond_name}</span> <span style="color:var(--muted);font-size:13px;margin-left:8px">${o.date_label}</span></div>
              <span class="order-status ${o.status}">${o.status_text}</span>
            </div>
            <div class="order-info">
              <span>🕐 ${o.session_name} ${o.session_time || ''}</span>
              ${o.seat_nos?.length ? `<span>🎣 ${o.seat_nos.map(n => n + '号').join(' ')}</span>` : `<span>👤 ${o.quantity}位</span>`}
              <span>📞 ${o.contact_phone}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
              <span style="font-size:12px;color:var(--muted)">订单号 ${o.order_no}</span>
              <span class="order-price">¥${o.total_price}</span>
            </div>
          </div>`).join('')}
        </div>
      `;
    } catch (err) {
      app.innerHTML = `<div class="card" style="text-align:center"><p style="color:var(--danger)">${err.message}</p></div>`;
    }
  },

  // ========== 订单详情 ==========
  async renderOrderDetail() {
    if (!this.requireAuth()) return;
    const id = new URLSearchParams(location.hash.split('?')[1] || '').get('id');
    if (!id) { location.hash = '#/orders'; return; }
    const app = document.getElementById('app');
    app.innerHTML = '<div class="card" style="text-align:center"><p>加载中...</p></div>';
    try {
      const result = await API.getOrder(id);
      const o = result.order;
      app.innerHTML = `
        <div style="margin-bottom:24px"><a href="#/orders" class="btn btn-outline btn-sm">← 返回订单列表</a></div>
        <div class="order-detail-verify">
          <div class="verify-label">入场预约码</div>
          <div class="verify-code">${o.verify_code}</div>
          <div style="font-size:13px;opacity:0.7">到场时向管理员出示此码 · ${o.status_text}</div>
        </div>
        <div class="card">
          <h3 style="font-size:18px;margin-bottom:16px">订单详情</h3>
          <div class="detail-row"><span class="detail-label">塘口</span><span class="detail-value">${o.pond_name}</span></div>
          <div class="detail-row"><span class="detail-label">日期</span><span class="detail-value">${o.date_label}</span></div>
          <div class="detail-row"><span class="detail-label">场次</span><span class="detail-value">${o.session_name} ${o.session_time || ''}</span></div>
          ${o.seat_nos?.length ? `<div class="detail-row"><span class="detail-label">钓位</span><span class="seat-chips">${o.seat_nos.map(n => `<span class="seat-chip">${n}号</span>`).join('')}</span></div>` : ''}
          <div class="detail-row"><span class="detail-label">数量</span><span class="detail-value">${o.quantity} 位</span></div>
          <div class="detail-row"><span class="detail-label">联系人</span><span class="detail-value">${o.contact_name} ${o.contact_phone}</span></div>
          <div class="detail-row"><span class="detail-label">订单号</span><span class="detail-value" style="font-size:13px">${o.order_no}</span></div>
          <div class="detail-row"><span class="detail-label">下单时间</span><span class="detail-value">${o.created_at}</span></div>
          <div class="detail-row"><span class="detail-label">订单金额</span><span class="detail-value" style="color:var(--accent);font-size:20px">¥${o.total_price}</span></div>
        </div>
        ${o.status === 'reserved' ? `
        <div style="display:flex;gap:12px;margin-top:24px">
          <button class="btn btn-outline" style="flex:1" id="cancelBtn">取消订单</button>
          <a href="#/booking" class="btn btn-primary" style="flex:1">再约一场</a>
        </div>` : `<a href="#/booking" class="btn btn-primary btn-block" style="margin-top:24px">再约一场</a>`}
      `;
      const cancelBtn = document.getElementById('cancelBtn');
      if (cancelBtn) cancelBtn.addEventListener('click', async () => {
        if (!confirm('确定要取消该订单吗？')) return;
        try { await API.cancelOrder(id); this.toast('订单已取消', 'success'); this.router(); }
        catch (err) { this.toast(err.message, 'error'); }
      });
    } catch (err) {
      app.innerHTML = `<div class="card" style="text-align:center"><p style="color:var(--danger)">${err.message}</p><a href="#/orders" class="btn btn-primary" style="margin-top:16px">返回订单列表</a></div>`;
    }
  },

  // ========== 鱼情页 ==========
  async renderFish() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="card" style="text-align:center"><p>加载中...</p></div>';
    try {
      const result = await API.getFishReports();
      let filter = 'all';
      const projects = [{ id: 'all', name: '全部鱼情' }, { id: 'mixed', name: '综合塘' }, { id: 'crucian', name: '鲫鱼塘' }];

      const render = () => {
        const reports = filter === 'all' ? result.reports : result.reports.filter(r => r.project_id === filter);
        const liveCount = result.reports.filter(r => r.isLive).length;
        const waterTemps = result.reports.filter(r => r.water_temp).map(r => r.water_temp);
        app.innerHTML = `
          <div class="section-header" style="margin-bottom:24px">
            <div><div class="section-title">实时鱼情</div><div class="section-subtitle">现场值班人员实时更新 · <span class="live-badge" style="display:inline-flex"><span class="live-dot"></span>${liveCount} 条实时</span></div></div>
          </div>
          <div class="fish-stats">
            <div class="card fish-stat"><div class="fish-stat-num">${result.reports.length}</div><div class="fish-stat-label">总播报数</div></div>
            <div class="card fish-stat"><div class="fish-stat-num">${waterTemps[0] || '--'}</div><div class="fish-stat-label">当前水温</div></div>
            <div class="card fish-stat"><div class="fish-stat-num">${result.reports.filter(r => r.release_amount).length}</div><div class="fish-stat-label">放鱼公告</div></div>
          </div>
          <div class="fish-filter">
            ${projects.map(p => `<span class="filter-pill ${filter === p.id ? 'active' : ''}" data-filter="${p.id}">${p.name}</span>`).join('')}
          </div>
          ${reports.length ? `<div>${reports.map(r => this.fishReportCard(r)).join('')}</div>` : `<div class="empty-state"><div class="empty-icon">🐟</div><div class="empty-text">该塘口暂无鱼情播报</div></div>`}
        `;
        document.querySelectorAll('.filter-pill').forEach(el => el.addEventListener('click', () => { filter = el.dataset.filter; render(); }));
      };
      render();
    } catch (err) {
      app.innerHTML = `<div class="card" style="text-align:center"><p style="color:var(--danger)">${err.message}</p></div>`;
    }
  },

  // ========== 登录/注册 ==========
  renderLogin() {
    const app = document.getElementById('app');
    let tab = 'login';
    const render = () => {
      app.innerHTML = `
        <div class="auth-container">
          <div class="card">
            <div class="auth-tabs">
              <div class="auth-tab ${tab === 'login' ? 'active' : ''}" data-tab="login">登录</div>
              <div class="auth-tab ${tab === 'register' ? 'active' : ''}" data-tab="register">注册</div>
            </div>
            ${tab === 'login' ? `
              <div class="form-group"><label class="form-label">手机号 / 账号</label><input class="form-input" id="loginPhone" placeholder="请输入手机号" value="admin"></div>
              <div class="form-group"><label class="form-label">密码</label><input class="form-input" id="loginPassword" type="password" placeholder="请输入密码" value="admin123"></div>
              <button class="btn btn-primary btn-block btn-lg" id="loginSubmit">登录</button>
              <p class="form-hint" style="text-align:center;margin-top:16px">默认管理员：admin / admin123</p>
            ` : `
              <div class="form-group"><label class="form-label">昵称（选填）</label><input class="form-input" id="regName" placeholder="请输入昵称" maxlength="20"></div>
              <div class="form-group"><label class="form-label">手机号</label><input class="form-input" id="regPhone" placeholder="请输入手机号" type="tel" maxlength="11"></div>
              <div class="form-group"><label class="form-label">密码</label><input class="form-input" id="regPassword" type="password" placeholder="至少6位" minlength="6"></div>
              <button class="btn btn-primary btn-block btn-lg" id="regSubmit">注册并登录</button>
            `}
          </div>
        </div>
      `;
      document.querySelectorAll('.auth-tab').forEach(el => el.addEventListener('click', () => { tab = el.dataset.tab; render(); }));
      const loginSubmit = document.getElementById('loginSubmit');
      if (loginSubmit) loginSubmit.addEventListener('click', async () => {
        const phone = document.getElementById('loginPhone').value.trim();
        const password = document.getElementById('loginPassword').value;
        if (!phone || !password) return this.toast('请填写账号和密码', 'error');
        loginSubmit.disabled = true; loginSubmit.textContent = '登录中...';
        try {
          const result = await API.login(phone, password);
          API.setAuth(result.token, result.user);
          this.updateNav();
          this.toast('登录成功', 'success');
          location.hash = result.user.role === 'admin' ? '#/admin' : '#/';
        } catch (err) { this.toast(err.message, 'error'); loginSubmit.disabled = false; loginSubmit.textContent = '登录'; }
      });
      const regSubmit = document.getElementById('regSubmit');
      if (regSubmit) regSubmit.addEventListener('click', async () => {
        const name = document.getElementById('regName').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const password = document.getElementById('regPassword').value;
        if (!/^1\d{10}$/.test(phone)) return this.toast('请填写正确的手机号', 'error');
        if (password.length < 6) return this.toast('密码至少6位', 'error');
        regSubmit.disabled = true; regSubmit.textContent = '注册中...';
        try {
          const result = await API.register(phone, password, name);
          API.setAuth(result.token, result.user);
          this.updateNav();
          this.toast('注册成功', 'success');
          location.hash = '#/';
        } catch (err) { this.toast(err.message, 'error'); regSubmit.disabled = false; regSubmit.textContent = '注册并登录'; }
      });
    };
    render();
  },

  // ========== 管理后台 ==========
  async renderAdmin() {
    if (!this.requireAuth()) return;
    if (API.user.role !== 'admin') { this.toast('需要管理员权限', 'error'); location.hash = '#/'; return; }
    const app = document.getElementById('app');
    const hash = this.currentRoute;
    const subPage = hash.includes('/orders') ? 'orders' : hash.includes('/venue') ? 'venue' : hash.includes('/capacity') ? 'capacity' : hash.includes('/checkin') ? 'checkin' : 'dashboard';

    app.innerHTML = `
      <div class="section-header" style="margin-bottom:24px"><div><div class="section-title">管理后台</div><div class="section-subtitle">欢迎，${API.user.name || API.user.phone}</div></div></div>
      <div class="admin-layout">
        <div class="admin-sidebar card" style="padding:12px">
          <div class="admin-nav-item ${subPage === 'dashboard' ? 'active' : ''}" onclick="location.hash='#/admin'">📊 数据概览</div>
          <div class="admin-nav-item ${subPage === 'capacity' ? 'active' : ''}" onclick="location.hash='#/admin/capacity'">🎣 容量管理</div>
          <div class="admin-nav-item ${subPage === 'orders' ? 'active' : ''}" onclick="location.hash='#/admin/orders'">📋 订单管理</div>
          <div class="admin-nav-item ${subPage === 'checkin' ? 'active' : ''}" onclick="location.hash='#/admin/checkin'">✅ 订单核销</div>
          <div class="admin-nav-item ${subPage === 'venue' ? 'active' : ''}" onclick="location.hash='#/admin/venue'">⚙️ 钓场设置</div>
          <div class="admin-nav-item" onclick="location.hash='#/fish'">🐟 鱼情管理</div>
        </div>
        <div class="admin-content" id="adminContent"><div class="card" style="text-align:center"><p>加载中...</p></div></div>
      </div>
    `;
    this.renderAdminSubPage(subPage);
  },

  async renderAdminSubPage(subPage) {
    const content = document.getElementById('adminContent');
    if (subPage === 'dashboard') {
      try {
        const [orders, venue] = await Promise.all([API.adminGetOrders(), API.getVenue()]);
        const today = new Date().toISOString().slice(0, 10);
        const todayOrders = orders.orders.filter(o => o.booking_date === today);
        const reserved = orders.orders.filter(o => o.status === 'reserved').length;
        const revenue = orders.orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total_price, 0);
        content.innerHTML = `
          <div class="admin-stat-grid">
            <div class="card admin-stat-card"><div class="admin-stat-num" style="color:var(--brand)">${orders.orders.length}</div><div class="admin-stat-label">总订单数</div></div>
            <div class="card admin-stat-card"><div class="admin-stat-num" style="color:var(--accent)">${todayOrders.length}</div><div class="admin-stat-label">今日订单</div></div>
            <div class="card admin-stat-card"><div class="admin-stat-num" style="color:var(--success)">${reserved}</div><div class="admin-stat-label">待使用</div></div>
            <div class="card admin-stat-card"><div class="admin-stat-num" style="color:var(--brand)">¥${revenue}</div><div class="admin-stat-label">累计营收</div></div>
          </div>
          <div class="card">
            <h3 style="font-size:18px;margin-bottom:16px">钓场信息</h3>
            <div class="detail-row"><span class="detail-label">名称</span><span class="detail-value">${venue.name}</span></div>
            <div class="detail-row"><span class="detail-label">地址</span><span class="detail-value">${venue.address || '未设置'}</span></div>
            <div class="detail-row"><span class="detail-label">电话</span><span class="detail-value">${venue.phone || '未设置'}</span></div>
            <div class="detail-row"><span class="detail-label">营业时间</span><span class="detail-value">${venue.openingHours}</span></div>
            <div class="detail-row"><span class="detail-label">预约状态</span><span class="detail-value">${venue.bookingEnabled ? '<span style="color:var(--success)">开放中</span>' : '<span style="color:var(--danger)">已关闭</span>'}</span></div>
          </div>
        `;
      } catch (err) { content.innerHTML = `<div class="card" style="text-align:center;color:var(--danger)">${err.message}</div>`; }
    }

    if (subPage === 'capacity') {
      const dates = this.generateDates(7);
      const state = { date: dates[0].value, sessionCode: 'day' };
      const render = async () => {
        const slots = await API.getSlots(state.date);
        content.innerHTML = `
          <div class="card" style="margin-bottom:20px">
            <h3 style="font-size:18px;margin-bottom:16px">容量管理</h3>
            <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">
              <div><label class="form-label">日期</label><select class="form-select" id="capDate" style="width:180px">${dates.map(d => `<option value="${d.value}" ${state.date === d.value ? 'selected' : ''}>${d.label}</option>`).join('')}</select></div>
              <div><label class="form-label">场次</label><select class="form-select" id="capSession" style="width:140px"><option value="day" ${state.sessionCode === 'day' ? 'selected' : ''}>日场</option><option value="night" ${state.sessionCode === 'night' ? 'selected' : ''}>夜场</option></select></div>
            </div>
          </div>
          ${['mixed', 'crucian'].map(pid => {
            const slot = slots.slots.find(s => s.project_id === pid && s.sessionCode === state.sessionCode);
            const name = pid === 'mixed' ? '综合塘' : '鲫鱼塘';
            return `<div class="card" style="margin-bottom:16px">
              <h4 style="font-size:16px;margin-bottom:12px">${name}</h4>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
                <div><label class="form-label">容量上限</label><input class="form-input" type="number" id="cap-${pid}" value="${slot?.capacity || 0}" min="0"></div>
                <div><label class="form-label">单价(元)</label><input class="form-input" type="number" id="price-${pid}" value="${slot?.price || 0}" min="0"></div>
                <div><label class="form-label">已预约</label><div style="padding:12px 16px;background:var(--brand-light);border-radius:10px;font-weight:600">${slot ? slot.capacity - slot.availableQuantity : 0} 人</div></div>
              </div>
              <button class="btn btn-primary btn-sm" style="margin-top:16px" onclick="App.saveCapacity('${pid}','${state.date}','${state.sessionCode}')">保存</button>
            </div>`;
          }).join('')}
        `;
        document.getElementById('capDate').addEventListener('change', (e) => { state.date = e.target.value; render(); });
        document.getElementById('capSession').addEventListener('change', (e) => { state.sessionCode = e.target.value; render(); });
      };
      render();
    }

    if (subPage === 'orders') {
      try {
        const result = await API.adminGetOrders();
        content.innerHTML = `
          <div class="card" style="margin-bottom:20px;padding:16px"><h3 style="font-size:18px">全部订单 (${result.orders.length})</h3></div>
          <div class="card" style="padding:0;overflow:hidden">
            <table class="admin-table">
              <thead><tr><th>订单号</th><th>塘口</th><th>日期</th><th>场次</th><th>钓位</th><th>联系人</th><th>金额</th><th>状态</th></tr></thead>
              <tbody>${result.orders.map(o => `<tr>
                <td style="font-size:12px">${o.order_no}</td>
                <td>${o.pond_name}</td>
                <td>${o.booking_date}</td>
                <td>${o.session_name}</td>
                <td>${o.seat_nos?.join(',') || '-'}</td>
                <td>${o.contact_name}<br><span style="font-size:11px;color:var(--muted)">${o.contact_phone}</span></td>
                <td style="font-weight:600">¥${o.total_price}</td>
                <td><span class="order-status ${o.status}" style="font-size:11px">${o.status_text}</span></td>
              </tr>`).join('')}</tbody>
            </table>
          </div>
        `;
      } catch (err) { content.innerHTML = `<div class="card" style="text-align:center;color:var(--danger)">${err.message}</div>`; }
    }

    if (subPage === 'checkin') {
      content.innerHTML = `
        <div class="card" style="max-width:500px">
          <h3 style="font-size:18px;margin-bottom:16px">订单核销</h3>
          <div class="form-group"><label class="form-label">预约码</label><input class="form-input" id="checkinCode" placeholder="输入用户的预约码，如 1234 5678"></div>
          <div class="form-group"><label class="form-label">或订单号</label><input class="form-input" id="checkinOrderNo" placeholder="输入订单号"></div>
          <button class="btn btn-primary btn-block" id="checkinBtn">核销订单</button>
          <div id="checkinResult" style="margin-top:20px"></div>
        </div>
      `;
      document.getElementById('checkinBtn').addEventListener('click', async () => {
        const code = document.getElementById('checkinCode').value.trim();
        const orderNo = document.getElementById('checkinOrderNo').value.trim();
        if (!code && !orderNo) return this.toast('请输入预约码或订单号', 'error');
        try {
          const result = await API.checkin(code ? { verifyCode: code } : { orderNo });
          document.getElementById('checkinResult').innerHTML = `<div class="card" style="background:#e8f0ec;border-color:var(--success)"><p style="color:var(--success);font-weight:600">✅ 核销成功</p><p style="font-size:13px;margin-top:8px">${result.order.pond_name} · ${result.order.date_label} · ${result.order.contact_name}</p></div>`;
          this.toast('核销成功', 'success');
        } catch (err) { this.toast(err.message, 'error'); }
      });
    }

    if (subPage === 'venue') {
      try {
        const venue = await API.getVenue();
        content.innerHTML = `
          <div class="card">
            <h3 style="font-size:18px;margin-bottom:20px">钓场信息设置</h3>
            <div class="form-group"><label class="form-label">钓场名称</label><input class="form-input" id="vName" value="${venue.name}"></div>
            <div class="form-group"><label class="form-label">宣传标语</label><input class="form-input" id="vSlogan" value="${venue.slogan}"></div>
            <div class="form-group"><label class="form-label">联系电话</label><input class="form-input" id="vPhone" value="${venue.phone}"></div>
            <div class="form-group"><label class="form-label">钓场地址</label><input class="form-input" id="vAddress" value="${venue.address}"></div>
            <div class="form-group"><label class="form-label">营业时间</label><input class="form-input" id="vHours" value="${venue.openingHours}"></div>
            <div class="form-group"><label class="form-label">首页公告</label><textarea class="form-textarea" id="vNotice">${venue.notice}</textarea></div>
            <div class="form-group"><label class="form-label">收费说明</label><textarea class="form-textarea" id="vPricing">${venue.pricingNote}</textarea></div>
            <div class="form-group"><label style="display:flex;align-items:center;gap:10px;cursor:pointer"><input type="checkbox" id="vEnabled" ${venue.bookingEnabled ? 'checked' : ''} style="width:18px;height:18px"> 开放预约</label></div>
            <button class="btn btn-primary btn-block" id="saveVenueBtn">保存设置</button>
          </div>
        `;
        document.getElementById('saveVenueBtn').addEventListener('click', async () => {
          try {
            await API.updateVenue({
              name: document.getElementById('vName').value,
              slogan: document.getElementById('vSlogan').value,
              phone: document.getElementById('vPhone').value,
              address: document.getElementById('vAddress').value,
              opening_hours: document.getElementById('vHours').value,
              notice: document.getElementById('vNotice').value,
              pricing_note: document.getElementById('vPricing').value,
              booking_enabled: document.getElementById('vEnabled').checked ? 1 : 0,
            });
            this.toast('设置已保存', 'success');
          } catch (err) { this.toast(err.message, 'error'); }
        });
      } catch (err) { content.innerHTML = `<div class="card" style="text-align:center;color:var(--danger)">${err.message}</div>`; }
    }
  },

  async saveCapacity(pid, date, session) {
    const capacity = parseInt(document.getElementById(`cap-${pid}`).value) || 0;
    const price = parseInt(document.getElementById(`price-${pid}`).value) || 0;
    try {
      await API.updateCapacity({ projectId: pid, bookingDate: date, sessionCode: session, capacity, priceFen: price * 100, reason: '管理后台调整' });
      this.toast('保存成功', 'success');
      this.renderAdminSubPage('capacity');
    } catch (err) { this.toast(err.message, 'error'); }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
