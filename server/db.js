const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'fishing.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 初始化表结构
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'user',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS venue_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT DEFAULT '休闲生态农场养殖',
    slogan TEXT DEFAULT '一池清水，半日闲心',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    opening_hours TEXT DEFAULT '06:00 - 22:30',
    notice TEXT DEFAULT '',
    pricing_note TEXT DEFAULT '',
    booking_enabled INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fishing_projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    fish_species TEXT,
    color TEXT DEFAULT 'forest',
    capacity INTEGER DEFAULT 36
  );

  CREATE TABLE IF NOT EXISTS booking_slots (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    booking_date TEXT NOT NULL,
    session_code TEXT NOT NULL,
    session_name TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    price_fen INTEGER NOT NULL DEFAULT 0,
    capacity INTEGER NOT NULL DEFAULT 36,
    locked_quantity INTEGER DEFAULT 0,
    confirmed_quantity INTEGER DEFAULT 0,
    status TEXT DEFAULT 'OPEN',
    UNIQUE(project_id, booking_date, session_code)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    project_id TEXT NOT NULL,
    pond_name TEXT NOT NULL,
    booking_date TEXT NOT NULL,
    date_label TEXT NOT NULL,
    session_name TEXT NOT NULL,
    session_code TEXT NOT NULL,
    session_time TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    seat_nos TEXT,
    unit_price INTEGER NOT NULL DEFAULT 0,
    total_price INTEGER NOT NULL DEFAULT 0,
    contact_name TEXT,
    contact_phone TEXT,
    verify_code TEXT,
    status TEXT DEFAULT 'reserved',
    status_text TEXT DEFAULT '待使用',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS fish_reports (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    pond_name TEXT,
    date_label TEXT,
    title TEXT NOT NULL,
    description TEXT,
    fish_weight TEXT,
    release_amount TEXT,
    tags TEXT,
    tone TEXT DEFAULT 'green',
    is_live INTEGER DEFAULT 0,
    water_temp TEXT,
    bait TEXT,
    weather TEXT,
    author TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS capacity_change_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT,
    booking_date TEXT,
    session_code TEXT,
    old_capacity INTEGER,
    new_capacity INTEGER,
    old_price_fen INTEGER,
    new_price_fen INTEGER,
    reason TEXT,
    operator_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// 初始化默认数据
const initVenue = db.prepare('INSERT OR IGNORE INTO venue_config (id) VALUES (1)');
initVenue.run();

const initProjects = db.prepare(`
  INSERT OR IGNORE INTO fishing_projects (id, name, description, fish_species, color, capacity)
  VALUES (?, ?, ?, ?, ?, ?)
`);
initProjects.run('mixed', '综合塘', '草鱼、鲤鱼、鲢鳙等综合鱼种，适合休闲与挑战。', '草鱼,鲤鱼,鲢鳙', 'forest', 36);
initProjects.run('crucian', '鲫鱼塘', '主钓优质鲫鱼，鱼口稳定，适合轻松休闲作钓。', '工程鲫,黄金鲫', 'amber', 24);

// 初始化管理员账号（首次启动时创建）
const adminCheck = db.prepare('SELECT id FROM users WHERE phone = ?');
if (!adminCheck.get('admin')) {
  const hash = bcrypt.hashSync('admin123', 10);
  const insertAdmin = db.prepare('INSERT INTO users (phone, password_hash, name, role) VALUES (?, ?, ?, ?)');
  insertAdmin.run('admin', hash, '系统管理员', 'admin');
  console.log('[初始化] 管理员账号已创建: admin / admin123 (请及时修改密码)');
}

// 初始化示例鱼情
const reportCount = db.prepare('SELECT COUNT(*) as c FROM fish_reports').get().c;
if (reportCount === 0) {
  const insertReport = db.prepare(`
    INSERT INTO fish_reports (id, project_id, pond_name, date_label, title, description, fish_weight, release_amount, tags, tone, is_live, water_temp, bait, weather, author)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = new Date();
  const today = `${now.getMonth()+1}月${now.getDate()}日`;
  insertReport.run('r1', 'crucian', '鲫鱼塘', `${today} 08:40`, '早口稳定，浅水区表现不错', '今晨水温适宜，东岸浅水区鱼口较密，建议短竿细线作钓。7号位、12号位连竿，蚯蚓和红虫都有口。', '单尾约 0.4 - 0.8 斤', '昨日补鱼 500 斤', '早口活跃,蚯蚓,东岸', 'orange', 1, '24°C', '蚯蚓 / 红虫', '晴 28°C 东风2级', '值班老周');
  insertReport.run('r2', 'mixed', '综合塘', `${today} 07:15`, '清晨草鱼开口，增氧机旁出鱼好', '南侧增氧机附近连续出鱼，玉米与颗粒均有不错表现。北岸3号位钓友刚上一尾7斤+草鱼。', '最大钓获 8.6 斤', null, '草鱼,清晨窗口,南侧', 'green', 1, '25°C', '玉米 / 颗粒', '晴 27°C 微风', '值班老周');
}

// 确保未来7天的场次存在
function ensureSlots() {
  const projects = db.prepare('SELECT * FROM fishing_projects').all();
  const insertSlot = db.prepare(`
    INSERT OR IGNORE INTO booking_slots (id, project_id, booking_date, session_code, session_name, start_time, end_time, price_fen, capacity, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')
  `);
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    for (const p of projects) {
      const isMixed = p.id === 'mixed';
      insertSlot.run(`${p.id}-${dateStr}-day`, p.id, dateStr, 'day', '日场', isMixed ? '06:30' : '07:00', isMixed ? '17:30' : '17:00', isMixed ? 12000 : 9000, p.capacity);
      insertSlot.run(`${p.id}-${dateStr}-night`, p.id, dateStr, 'night', '夜场', '18:00', isMixed ? '22:30' : '22:00', isMixed ? 10000 : 8000, p.capacity);
    }
  }
}
ensureSlots();
setInterval(ensureSlots, 3600000); // 每小时检查补充

module.exports = db;
