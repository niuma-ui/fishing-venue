const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { signToken, authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();

// ========== 认证 ==========
router.post('/auth/register', [
  body('phone').isString().isLength({ min: 5, max: 20 }),
  body('password').isString().isLength({ min: 6, max: 64 }),
  body('name').optional().isString().isLength({ max: 20 }),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: '参数不合法' });
  const { phone, password, name } = req.body;
  const exists = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (exists) return res.status(409).json({ error: '该手机号已注册' });
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (phone, password_hash, name, role) VALUES (?, ?, ?, ?)').run(phone, hash, name || '', 'user');
  const user = { id: result.lastInsertRowid, phone, name, role: 'user' };
  res.json({ token: signToken(user), user });
});

router.post('/auth/login', [
  body('phone').isString().notEmpty(),
  body('password').isString().notEmpty(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: '参数不合法' });
  const { phone, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '手机号或密码错误' });
  }
  const safeUser = { id: user.id, phone: user.phone, name: user.name, role: user.role };
  res.json({ token: signToken(safeUser), user: safeUser });
});

router.get('/auth/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

// ========== 钓场配置 ==========
router.get('/venue', (req, res) => {
  const venue = db.prepare('SELECT * FROM venue_config WHERE id = 1').get();
  res.json({
    name: venue.name, slogan: venue.slogan, phone: venue.phone, address: venue.address,
    openingHours: venue.opening_hours, notice: venue.notice, pricingNote: venue.pricing_note,
    bookingEnabled: !!venue.booking_enabled,
    weather: { temperature: '26°', description: '多云 · 宜垂钓', wind: '东南风 2 级' },
  });
});

router.put('/venue', adminRequired, (req, res) => {
  const allowed = ['name', 'slogan', 'phone', 'address', 'opening_hours', 'notice', 'pricing_note', 'booking_enabled'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: '没有需要更新的字段' });
  updates.updated_at = new Date().toISOString();
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE venue_config SET ${sets} WHERE id = 1`).run(...Object.values(updates));
  const venue = db.prepare('SELECT * FROM venue_config WHERE id = 1').get();
  res.json({ success: true, venue });
});

// ========== 项目与场次 ==========
router.get('/projects', (req, res) => {
  const projects = db.prepare('SELECT * FROM fishing_projects').all();
  res.json({ projects: projects.map(p => ({ ...p, fishSpecies: p.fish_species?.split(',') || [] })) });
});

router.get('/slots', (req, res) => {
  const { date, projectId } = req.query;
  if (!date) return res.status(400).json({ error: '缺少日期参数' });
  let sql = 'SELECT * FROM booking_slots WHERE booking_date = ?';
  const params = [date];
  if (projectId) { sql += ' AND project_id = ?'; params.push(projectId); }
  const slots = db.prepare(sql).all(...params);
  res.json({
    slots: slots.map(s => ({
      ...s,
      availableQuantity: Math.max(0, s.capacity - s.locked_quantity - s.confirmed_quantity),
      price: Math.round(s.price_fen / 100),
    }))
  });
});

// ========== 钓位地图 ==========
router.get('/seat-map', (req, res) => {
  const { projectId, date, sessionCode } = req.query;
  if (!projectId || !date || !sessionCode) return res.status(400).json({ error: '参数不完整' });
  const project = db.prepare('SELECT * FROM fishing_projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: '项目不存在' });

  const count = project.capacity;
  const radiusX = projectId === 'mixed' ? 34 : 30;
  const radiusY = projectId === 'mixed' ? 30 : 26;
  const areaNames = { north: '北岸', east: '东岸', south: '南岸', west: '西岸' };

  // 查询已占用钓位
  const orders = db.prepare(`
    SELECT seat_nos FROM orders
    WHERE project_id = ? AND booking_date = ? AND session_code = ? AND status IN ('reserved', 'pending_payment')
  `).all(projectId, date, sessionCode);
  const occupied = new Set();
  for (const o of orders) {
    if (o.seat_nos) JSON.parse(o.seat_nos).forEach(n => occupied.add(n));
  }

  const seats = [];
  for (let i = 0; i < count; i++) {
    const angle = (-90 + (360 / count) * i) * (Math.PI / 180);
    const x = Math.round((50 + (radiusX + 7) * Math.cos(angle)) * 10) / 10;
    const y = Math.round((50 + (radiusY + 7) * Math.sin(angle)) * 10) / 10;
    const deg = (-90 + (360 / count) * i + 360) % 360;
    let area;
    if (deg >= 315 || deg < 45) area = 'north';
    else if (deg >= 45 && deg < 135) area = 'east';
    else if (deg >= 135 && deg < 225) area = 'south';
    else area = 'west';
    const seatNo = String(i + 1);
    seats.push({
      seatId: `${projectId}-seat-${seatNo}`,
      seatNo, area, areaName: areaNames[area], x, y,
      status: occupied.has(seatNo) ? 'occupied' : 'available',
      features: i % 5 === 0 ? ['增氧机旁'] : i % 7 === 0 ? ['遮阳棚'] : undefined,
    });
  }

  res.json({
    pondId: projectId, pondName: project.name, shape: 'oval', seats,
    availableCount: count - occupied.size, occupiedCount: occupied.size,
  });
});

// ========== 订单 ==========
router.post('/orders', authRequired, [
  body('projectId').isString().notEmpty(),
  body('bookingDate').isString().notEmpty(),
  body('sessionCode').isString().notEmpty(),
  body('quantity').isInt({ min: 1, max: 20 }),
  body('contactName').isString().isLength({ min: 1, max: 20 }),
  body('contactPhone').isString().matches(/^1\d{10}$/),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: '参数不合法' });
  const { projectId, bookingDate, sessionCode, quantity, seatNos, contactName, contactPhone, dateLabel } = req.body;

  const slot = db.prepare('SELECT * FROM booking_slots WHERE project_id = ? AND booking_date = ? AND session_code = ?').get(projectId, bookingDate, sessionCode);
  if (!slot) return res.status(404).json({ error: '场次不存在' });
  if (slot.status !== 'OPEN') return res.status(400).json({ error: '该场次已关闭' });
  const available = slot.capacity - slot.locked_quantity - slot.confirmed_quantity;
  if (available < quantity) return res.status(409).json({ error: '名额不足' });

  const venue = db.prepare('SELECT booking_enabled FROM venue_config WHERE id = 1').get();
  if (!venue.booking_enabled) return res.status(400).json({ error: '钓场暂未开放预约' });

  const project = db.prepare('SELECT * FROM fishing_projects WHERE id = ?').get(projectId);
  const id = `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const orderNo = `FP${bookingDate.replace(/-/g, '')}${Date.now().toString().slice(-8)}`;
  const verifyCode = `${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`;
  const totalPrice = Math.round(slot.price_fen / 100) * quantity;

  const insert = db.prepare(`
    INSERT INTO orders (id, order_no, user_id, project_id, pond_name, booking_date, date_label, session_name, session_code, session_time, quantity, seat_nos, unit_price, total_price, contact_name, contact_phone, verify_code, status, status_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reserved', '待使用')
  `);
  const updateSlot = db.prepare('UPDATE booking_slots SET confirmed_quantity = confirmed_quantity + ? WHERE id = ?');

  const tx = db.transaction(() => {
    insert.run(id, orderNo, req.user.id, projectId, project.name, bookingDate, dateLabel || bookingDate, slot.session_name, sessionCode, `${slot.start_time} - ${slot.end_time}`, quantity, seatNos ? JSON.stringify(seatNos) : null, Math.round(slot.price_fen / 100), totalPrice, contactName, contactPhone, verifyCode);
    updateSlot.run(quantity, slot.id);
  });
  tx();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  res.json({ order: { ...order, seatNos: order.seat_nos ? JSON.parse(order.seat_nos) : [] } });
});

router.get('/orders', authRequired, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ orders: orders.map(o => ({ ...o, seatNos: o.seat_nos ? JSON.parse(o.seat_nos) : [] })) });
});

router.get('/orders/:id', authRequired, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  res.json({ order: { ...order, seatNos: order.seat_nos ? JSON.parse(order.seat_nos) : [] } });
});

router.post('/orders/:id/cancel', authRequired, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  if (order.status !== 'reserved' && order.status !== 'pending_payment') return res.status(400).json({ error: '该订单无法取消' });
  const tx = db.transaction(() => {
    db.prepare("UPDATE orders SET status = 'cancelled', status_text = '已取消' WHERE id = ?").run(order.id);
    db.prepare('UPDATE booking_slots SET confirmed_quantity = MAX(0, confirmed_quantity - ?) WHERE id = ?').run(order.quantity, `${order.project_id}-${order.booking_date}-${order.session_code}`);
  });
  tx();
  res.json({ success: true });
});

// ========== 鱼情 ==========
router.get('/fish-reports', (req, res) => {
  const { projectId } = req.query;
  let sql = 'SELECT * FROM fish_reports ORDER BY created_at DESC LIMIT 50';
  const params = [];
  if (projectId && projectId !== 'all') { sql = 'SELECT * FROM fish_reports WHERE project_id = ? ORDER BY created_at DESC LIMIT 50'; params.push(projectId); }
  const reports = db.prepare(sql).all(...params);
  res.json({
    reports: reports.map(r => ({
      ...r, isLive: !!r.is_live, tags: r.tags?.split(',') || [],
    }))
  });
});

router.post('/fish-reports', adminRequired, (req, res) => {
  const { projectId, pondName, title, description, fishWeight, releaseAmount, tags, tone, waterTemp, bait, weather, author } = req.body;
  if (!title) return res.status(400).json({ error: '标题不能为空' });
  const id = `report-${Date.now()}`;
  const now = new Date();
  const dateLabel = `${now.getMonth()+1}月${now.getDate()}日 ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  db.prepare(`
    INSERT INTO fish_reports (id, project_id, pond_name, date_label, title, description, fish_weight, release_amount, tags, tone, is_live, water_temp, bait, weather, author)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
  `).run(id, projectId || null, pondName || '', dateLabel, title, description || '', fishWeight || '', releaseAmount || null, tags?.join(',') || '', tone || 'green', waterTemp || '', bait || '', weather || '', author || '管理员');
  res.json({ success: true, id });
});

// ========== 管理：容量 ==========
router.put('/admin/capacity', adminRequired, (req, res) => {
  const { projectId, bookingDate, sessionCode, capacity, priceFen, reason } = req.body;
  if (!projectId || !bookingDate || !sessionCode) return res.status(400).json({ error: '参数不完整' });
  const slot = db.prepare('SELECT * FROM booking_slots WHERE project_id = ? AND booking_date = ? AND session_code = ?').get(projectId, bookingDate, sessionCode);
  if (!slot) return res.status(404).json({ error: '场次不存在' });
  const occupied = slot.locked_quantity + slot.confirmed_quantity;
  if (capacity < occupied) return res.status(400).json({ error: `容量不能低于已预约人数(${occupied})` });

  db.prepare('INSERT INTO capacity_change_logs (project_id, booking_date, session_code, old_capacity, new_capacity, old_price_fen, new_price_fen, reason, operator_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(projectId, bookingDate, sessionCode, slot.capacity, capacity, slot.price_fen, priceFen || slot.price_fen, reason || '管理员调整', req.user.id);
  db.prepare('UPDATE booking_slots SET capacity = ?, price_fen = ? WHERE id = ?').run(capacity, priceFen || slot.price_fen, slot.id);
  res.json({ success: true });
});

// ========== 管理：核销 ==========
router.post('/admin/checkin', adminRequired, (req, res) => {
  const { orderNo, verifyCode } = req.body;
  let order;
  if (orderNo) order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo);
  else if (verifyCode) order = db.prepare('SELECT * FROM orders WHERE verify_code = ?').get(verifyCode);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  if (order.status === 'used') return res.status(400).json({ error: '该订单已核销' });
  if (order.status !== 'reserved') return res.status(400).json({ error: '该订单状态无法核销' });
  db.prepare("UPDATE orders SET status = 'used', status_text = '已完成' WHERE id = ?").run(order.id);
  res.json({ success: true, order: { ...order, status: 'used', statusText: '已完成' } });
});

// ========== 管理：所有订单 ==========
router.get('/admin/orders', adminRequired, (req, res) => {
  const { date, status } = req.query;
  let sql = 'SELECT o.*, u.name as user_name, u.phone as user_phone FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE 1=1';
  const params = [];
  if (date) { sql += ' AND o.booking_date = ?'; params.push(date); }
  if (status) { sql += ' AND o.status = ?'; params.push(status); }
  sql += ' ORDER BY o.created_at DESC LIMIT 200';
  const orders = db.prepare(sql).all(...params);
  res.json({ orders: orders.map(o => ({ ...o, seatNos: o.seat_nos ? JSON.parse(o.seat_nos) : [] })) });
});

module.exports = router;
