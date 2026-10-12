require('dotenv').config();

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const express = require('express');
const session = require('express-session');
const nodemailer = require('nodemailer');

const app = express();
const port = Number(process.env.PORT) || 3000;
const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const notificationEmail = process.env.NOTIFICATION_EMAIL || 'lety.cabaret@gmail.com';
const appUrl = (process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || `http://localhost:${port}`).replace(/\/$/, '');
const dataDirectory = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');

if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET)) {
  throw new Error('ADMIN_PASSWORD et SESSION_SECRET doivent etre configures en production.');
}

fs.mkdirSync(dataDirectory, { recursive: true });
const db = new Database(path.join(dataDirectory, 'gaecofi.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    last_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    linkedin TEXT NOT NULL DEFAULT '',
    structure TEXT NOT NULL DEFAULT '',
    job_title TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    categories TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    callback INTEGER NOT NULL DEFAULT 0,
    slots TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_date TEXT NOT NULL,
    modality TEXT NOT NULL,
    subject TEXT NOT NULL,
    contact_ids TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    decision TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_contacts_names ON contacts(last_name, first_name);
  CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date DESC);
  CREATE INDEX IF NOT EXISTS idx_requests_contact ON requests(contact_id);
`);

app.disable('x-powered-by');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));
app.use(session({
  name: 'gaecofi.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  },
}));
app.use(express.static(path.join(__dirname, 'public')));

const categories = ['Client', 'Prospect', 'Partenaire', 'Fournisseur'];
const loginAttempts = new Map();
const clean = (value, max = 2000) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
function readContactInput(body = {}) {
  return {
    last_name: clean(body.last_name, 120),
    first_name: clean(body.first_name, 120),
    phone: clean(body.phone, 60),
    email: clean(body.email, 254),
    linkedin: clean(body.linkedin, 300),
    structure: clean(body.structure, 180),
    job_title: clean(body.job_title, 140),
    website: clean(body.website, 300),
    address: clean(body.address, 300),
  };
}

function validContactInput(contact, requireEmail = false) {
  return Boolean(contact.last_name && contact.first_name && (!requireEmail || contact.email) && (!contact.email || isEmail(contact.email)));
}

const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};
const parseJson = (value, fallback = []) => {
  try { return JSON.parse(value); } catch { return fallback; }
};

function requireAdmin(req, res, next) {
  if (req.session.authenticated) return next();
  return res.status(401).json({ error: 'Authentification requise.' });
}

function getContact(id) {
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
  if (!contact) return null;
  return { ...contact, categories: parseJson(contact.categories) };
}

function getContactSummary(id) {
  return db.prepare('SELECT id, first_name, last_name, structure, email FROM contacts WHERE id = ?').get(id);
}

function listEvents({ from, to, keyword } = {}) {
  let events = db.prepare('SELECT * FROM events ORDER BY event_date DESC, id DESC').all();
  if (from && validDate(from)) events = events.filter((event) => event.event_date >= from);
  if (to && validDate(to)) events = events.filter((event) => event.event_date <= to);
  if (keyword) {
    const term = keyword.toLocaleLowerCase('fr');
    events = events.filter((event) => `${event.comment} ${event.decision}`.toLocaleLowerCase('fr').includes(term));
  }
  return events.map((event) => ({
    ...event,
    contact_ids: parseJson(event.contact_ids),
    contacts: parseJson(event.contact_ids).map(getContactSummary).filter(Boolean),
  }));
}

let transporter;
function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function buildNotification(contact, request) {
  const slots = parseJson(request.slots);
  const choices = slots.map((slot) => {
    const label = `${new Date(`${slot.date}T12:00:00`).toLocaleDateString('fr-FR')} - ${slot.period}`;
    const subject = encodeURIComponent('Confirmation de rendez-vous GaEcofi');
    const body = encodeURIComponent(`Bonjour ${contact.first_name},\n\nJe vous confirme le créneau du ${label}.\n\nBien cordialement`);
    return `<li>${escapeHtml(label)} — <a href="mailto:${encodeURIComponent(contact.email)}?subject=${subject}&amp;body=${body}">Confirmer ce créneau</a></li>`;
  }).join('');
  const textSlots = slots.map((slot) => `- ${slot.date} (${slot.period})`).join('\n') || 'Aucun rappel demande.';
  return {
    subject: `Nouvelle demande de rendez-vous - ${contact.first_name} ${contact.last_name}`,
    text: `Nouvelle demande sur le formulaire GaEcofi\n\nContact : ${contact.first_name} ${contact.last_name}\nStructure : ${contact.structure}\nTelephone : ${contact.phone}\nE-mail : ${contact.email}\n\nDemande :\n${request.description}\n\nCreneaux proposes :\n${textSlots}\n\nPour confirmer un creneau, repondez a ce message ou ecrivez a ${contact.email}.`,
    html: `<h2>Nouvelle demande de rendez-vous</h2><p><strong>${escapeHtml(contact.first_name)} ${escapeHtml(contact.last_name)}</strong> — ${escapeHtml(contact.structure)}</p><p>Telephone : ${escapeHtml(contact.phone)}<br>E-mail : <a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a></p><h3>Demande</h3><p>${escapeHtml(request.description).replace(/\n/g, '<br>')}</p><h3>Créneaux proposés</h3><ul>${choices || '<li>Aucun rappel demandé.</li>'}</ul><p>Répondez à ce message pour échanger avec la personne.</p>`,
  };
}

app.post('/api/login', (req, res, next) => {
  const now = Date.now();
  const ip = req.ip;
  let attempt = loginAttempts.get(ip);
  if (!attempt || attempt.resetAt <= now) {
    attempt = { count: 0, resetAt: now + 15 * 60 * 1000 };
    loginAttempts.set(ip, attempt);
  }
  if (attempt.count >= 10) {
    res.set('Retry-After', String(Math.ceil((attempt.resetAt - now) / 1000)));
    return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' });
  }
  const submitted = clean(req.body?.password, 200);
  const expected = Buffer.from(adminPassword);
  const actual = Buffer.from(submitted);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    attempt.count += 1;
    return res.status(401).json({ error: 'Mot de passe incorrect.' });
  }
  loginAttempts.delete(ip);
  req.session.regenerate((error) => {
    if (error) return next(error);
    req.session.authenticated = true;
    return req.session.save((saveError) => {
      if (saveError) return next(saveError);
      return res.json({ ok: true });
    });
  });
});

app.get('/api/me', (req, res) => res.json({ authenticated: Boolean(req.session.authenticated) }));
app.post('/api/logout', (req, res) => req.session.destroy(() => res.clearCookie('gaecofi.sid').json({ ok: true })));

app.post('/api/public/contacts', (req, res) => {
  const contact = readContactInput(req.body);
  if (!validContactInput(contact, true)) {
    return res.status(400).json({ error: 'Nom, prénom et adresse e-mail valide sont nécessaires.' });
  }
  const result = db.prepare(`INSERT INTO contacts (last_name, first_name, phone, email, linkedin, structure, job_title, website, address, created_at)
    VALUES (@last_name, @first_name, @phone, @email, @linkedin, @structure, @job_title, @website, @address, @created_at)`)
    .run({ ...contact, created_at: new Date().toISOString() });
  return res.status(201).json({ id: Number(result.lastInsertRowid) });
});

app.get('/api/public/contacts/:id', (req, res) => {
  const contact = db.prepare('SELECT id, first_name, last_name, structure FROM contacts WHERE id = ?').get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact introuvable.' });
  return res.json(contact);
});

app.post('/api/public/contacts/:id/requests', async (req, res) => {
  const contact = getContact(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact introuvable.' });
  const description = clean(req.body?.description, 5000);
  const callback = req.body?.callback === true;
  const slots = Array.isArray(req.body?.slots) ? req.body.slots.slice(0, 3).map((slot) => ({
    date: clean(slot?.date, 10),
    period: clean(slot?.period, 20),
  })) : [];
  if (!description) return res.status(400).json({ error: 'Merci de décrire votre demande.' });
  if (callback && (!slots.length || slots.some((slot) => !validDate(slot.date) || !['matin', 'après-midi'].includes(slot.period)))) {
    return res.status(400).json({ error: 'Proposez au moins un créneau valide pour être rappelé.' });
  }
  if (!callback && slots.length) return res.status(400).json({ error: 'Aucun créneau ne doit être envoyé sans demande de rappel.' });

  const result = db.prepare('INSERT INTO requests (contact_id, description, callback, slots, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(contact.id, description, callback ? 1 : 0, JSON.stringify(slots), new Date().toISOString());
  const request = { description, slots: JSON.stringify(slots) };
  let emailSent = false;
  const mailer = getTransporter();
  if (mailer) {
    try {
      await mailer.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || notificationEmail,
        to: notificationEmail,
        replyTo: contact.email,
        ...buildNotification(contact, request),
      });
      emailSent = true;
    } catch (error) {
      console.error('Échec de l’envoi de la notification :', error.message);
    }
  }
  return res.status(201).json({ id: Number(result.lastInsertRowid), emailSent, notificationEmail });
});

app.get('/api/contacts', requireAdmin, (req, res) => {
  const term = clean(req.query.q, 150).toLocaleLowerCase('fr');
  const category = clean(req.query.category, 40);
  let contacts = db.prepare('SELECT * FROM contacts ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE').all()
    .map((contact) => ({ ...contact, categories: parseJson(contact.categories) }));
  if (term) contacts = contacts.filter((contact) => [contact.first_name, contact.last_name, contact.email, contact.phone, contact.structure]
    .some((value) => value.toLocaleLowerCase('fr').includes(term)));
  if (categories.includes(category)) contacts = contacts.filter((contact) => contact.categories.includes(category));
  return res.json(contacts);
});

app.post('/api/contacts', requireAdmin, (req, res) => {
  const contact = readContactInput(req.body);
  if (!validContactInput(contact)) return res.status(400).json({ error: 'Nom et prénom sont obligatoires ; vérifiez aussi l’adresse e-mail.' });
  const selected = Array.isArray(req.body?.categories) ? req.body.categories.filter((item) => categories.includes(item)) : [];
  const result = db.prepare(`INSERT INTO contacts (last_name, first_name, phone, email, linkedin, structure, job_title, website, address, categories, created_at)
    VALUES (@last_name, @first_name, @phone, @email, @linkedin, @structure, @job_title, @website, @address, @categories, @created_at)`)
    .run({ ...contact, categories: JSON.stringify([...new Set(selected)]), created_at: new Date().toISOString() });
  return res.status(201).json({ id: Number(result.lastInsertRowid) });
});

app.put('/api/contacts/:id', requireAdmin, (req, res) => {
  const existing = getContact(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contact introuvable.' });
  const contact = readContactInput(req.body);
  if (!validContactInput(contact)) return res.status(400).json({ error: 'Nom et prénom sont obligatoires ; vérifiez aussi l’adresse e-mail.' });
  const result = db.prepare(`UPDATE contacts SET last_name = @last_name, first_name = @first_name, phone = @phone, email = @email,
    linkedin = @linkedin, structure = @structure, job_title = @job_title, website = @website, address = @address WHERE id = @id`)
    .run({ ...contact, id: existing.id });
  if (!result.changes) return res.status(404).json({ error: 'Contact introuvable.' });
  return res.json({ id: Number(req.params.id) });
});

app.delete('/api/contacts/:id', requireAdmin, (req, res) => {
  const contact = getContact(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact introuvable.' });
  const deleteContact = db.transaction(() => {
    const events = db.prepare('SELECT id, contact_ids FROM events').all();
    for (const event of events) {
      const currentIds = parseJson(event.contact_ids);
      const participantIds = currentIds.filter((id) => id !== contact.id);
      if (participantIds.length === currentIds.length) continue;
      if (participantIds.length) {
        db.prepare('UPDATE events SET contact_ids = ? WHERE id = ?').run(JSON.stringify(participantIds), event.id);
      } else {
        db.prepare('DELETE FROM events WHERE id = ?').run(event.id);
      }
    }
    db.prepare('DELETE FROM contacts WHERE id = ?').run(contact.id);
  });
  deleteContact();
  return res.status(204).end();
});

app.get('/api/contacts/:id', requireAdmin, (req, res) => {
  const contact = getContact(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact introuvable.' });
  const requests = db.prepare('SELECT * FROM requests WHERE contact_id = ? ORDER BY created_at DESC').all(contact.id)
    .map((request) => ({ ...request, callback: Boolean(request.callback), slots: parseJson(request.slots) }));
  const events = listEvents().filter((event) => event.contact_ids.includes(contact.id));
  return res.json({ ...contact, requests, events });
});

app.patch('/api/contacts/:id/categories', requireAdmin, (req, res) => {
  const contact = getContact(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact introuvable.' });
  const selected = Array.isArray(req.body?.categories) ? req.body.categories.filter((item) => categories.includes(item)) : [];
  db.prepare('UPDATE contacts SET categories = ? WHERE id = ?').run(JSON.stringify([...new Set(selected)]), contact.id);
  return res.json({ categories: selected });
});

app.get('/api/events', requireAdmin, (req, res) => res.json(listEvents({
  from: clean(req.query.from, 10),
  to: clean(req.query.to, 10),
  keyword: clean(req.query.keyword, 150),
})));

app.post('/api/events', requireAdmin, (req, res) => {
  const eventDate = clean(req.body?.event_date, 10);
  const modality = clean(req.body?.modality, 60);
  const subject = clean(req.body?.subject, 180);
  const contactIds = Array.isArray(req.body?.contact_ids) ? [...new Set(req.body.contact_ids.map(Number).filter(Number.isInteger))] : [];
  if (!validDate(eventDate) || !modality || !subject || !contactIds.length) {
    return res.status(400).json({ error: 'Date, modalité, objet et au moins un contact sont nécessaires.' });
  }
  const existing = db.prepare(`SELECT id FROM contacts WHERE id IN (${contactIds.map(() => '?').join(',')})`).all(...contactIds);
  if (existing.length !== contactIds.length) return res.status(400).json({ error: 'Un des contacts sélectionnés est introuvable.' });
  const result = db.prepare('INSERT INTO events (event_date, modality, subject, contact_ids, comment, decision, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(eventDate, modality, subject, JSON.stringify(contactIds), clean(req.body?.comment, 5000), clean(req.body?.decision, 3000), new Date().toISOString());
  return res.status(201).json({ id: Number(result.lastInsertRowid) });
});

app.get(['/','/contact','/demande/:id'], (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ressource introuvable.' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Une erreur est survenue. Réessayez dans un instant.' });
});

app.listen(port, () => {
  console.log(`GaEcofi est disponible sur ${appUrl}`);
  if (!process.env.ADMIN_PASSWORD) console.log(`Mot de passe CRM temporaire : ${adminPassword}`);
  if (!getTransporter()) console.log('Notifications e-mail inactives : configurez SMTP_HOST et les identifiants SMTP.');
});