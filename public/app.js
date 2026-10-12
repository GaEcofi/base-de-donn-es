const root = document.querySelector('#app');
const categories = ['Client', 'Prospect', 'Partenaire', 'Fournisseur'];
const today = new Date().toISOString().slice(0, 10);

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  const data = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(data.error || 'Une erreur est survenue.');
  return data;
}

function icon(name) {
  const paths = {
    contacts: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M5.5 16a3.5 3.5 0 0 1 7 0M15 9h3m-3 4h3"/>',
    events: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="m9 15 2 2 4-4"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`;
}

function setPageTitle(title) {
  document.title = `${title} | GaEcofi`;
}

function showError(container, message) {
  const target = container.querySelector('[data-error]');
  if (target) {
    target.textContent = message;
    target.hidden = false;
  }
}

function publicFrame(content) {
  root.innerHTML = `<main class="public-page"><header class="public-brand"><a class="public-banner-link" href="/" aria-label="GaEcofi, espace contacts"><img class="public-banner" src="/public/gaecofi-banner.png" alt="Bandeau GaEcofi"></a></header>${content}<footer class="public-footer"><p class="privacy-notice">Les informations recueillies sur ce formulaire sont enregistrées dans un fichier informatisé et sécurisé par GaEcofi afin de traiter votre demande de contact. En conformité avec le RGPD, vous pouvez exercer votre droit d'accès, de rectification, d'effacement, d'opposition ou retirer votre consentement en me contactant à lety.cabaret@gmail.com.</p><p class="public-footer-signoff">GaEcofi <span>·</span> Accompagnement professionnel</p></footer></main>`;
}

function contactForm() {
  setPageTitle('Formulaire de contact');
  publicFrame(`<section class="public-form-wrap"><div class="form-heading"><span class="eyebrow">Prenons contact</span><h1>formulaire de contact</h1><p>GaEcofi vous accompagne au développement économique et administratif de votre structure / entreprise et sécurise la conformité des organismes de formation.</p></div><form id="contact-form" class="form-panel"><div class="form-grid">
    <label>Nom <span class="required">*</span><input name="last_name" autocomplete="family-name" required maxlength="120"></label>
    <label>Prénom <span class="required">*</span><input name="first_name" autocomplete="given-name" required maxlength="120"></label>
    <label>N° de téléphone<input name="phone" type="tel" autocomplete="tel" maxlength="60"></label>
    <label>Mail <span class="required">*</span><input name="email" type="email" autocomplete="email" required maxlength="254"></label>
    <label>Lien LinkedIn<input name="linkedin" type="url" placeholder="https://" maxlength="300"></label>
    <label>Structure<input name="structure" autocomplete="organization" maxlength="180"></label>
    <label>Fonction<input name="job_title" autocomplete="organization-title" maxlength="140"></label>
    <label>Site<input name="website" type="url" placeholder="https://" maxlength="300"></label>
    <label class="field-wide">Adresse structure<input name="address" autocomplete="street-address" maxlength="300"></label>
  </div><p class="form-error" data-error hidden></p><div class="form-actions"><span class="form-hint"><span class="required">*</span> Champs obligatoires</span><button class="button button-primary" type="submit">Continuer <span aria-hidden="true">→</span></button></div></form></section>`);
  document.querySelector('#contact-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const payload = Object.fromEntries(new FormData(form));
      const result = await api('/api/public/contacts', { method: 'POST', body: JSON.stringify(payload) });
      location.href = `/demande/${result.id}`;
    } catch (error) {
      showError(form, error.message);
      button.disabled = false;
    }
  });
}

function renderSlot(index) {
  return `<div class="slot-row" data-slot="${index}"><span class="slot-label">Créneau ${index + 1}</span><label class="slot-date">De préférence le <input name="slot-date" type="date" min="${today}" required aria-label="Date souhaitée"></label><label class="slot-period"><span class="visually-hidden">Période souhaitée</span><select name="slot-period" required><option value="">Période</option><option value="matin">Matin</option><option value="après-midi">Après-midi</option></select></label>${index > 0 ? `<button type="button" class="icon-button remove-slot" aria-label="Supprimer ce créneau" title="Supprimer">×</button>` : ''}</div>`;
}

function requestForm(contact) {
  setPageTitle('Demande de rendez-vous');
  publicFrame(`<section class="public-form-wrap request-wrap"><a href="/contact" class="back-link">← Retour au formulaire</a><div class="form-heading"><span class="eyebrow">Votre demande</span><h1>demande de rendez-vous</h1><p class="recipient-line">Pour <strong>${escapeHtml(contact.first_name)} ${escapeHtml(contact.last_name)}</strong>${contact.structure ? ` · ${escapeHtml(contact.structure)}` : ''}</p></div><form id="request-form" class="form-panel"><label class="request-description">Décrivez vos besoins et formulez votre demande<textarea name="description" rows="5" required maxlength="5000" placeholder="Votre message…"></textarea></label>
    <fieldset class="callback-choice"><legend>Je désire qu’on me rappelle</legend><label class="radio-option"><input type="radio" name="callback" value="oui"><span>Oui</span></label><label class="radio-option"><input type="radio" name="callback" value="non" checked><span>Non</span></label></fieldset>
    <section class="slots-section" id="slots-section" hidden><div class="slots-heading"><div><span class="eyebrow">Vos disponibilités</span><h2>Créneaux de rappel</h2></div><span class="slots-count" id="slots-count">1 / 3</span></div><div id="slots-list">${renderSlot(0)}</div><button type="button" id="add-slot" class="button button-secondary">${icon('plus')} Ajouter un autre créneau</button></section>
    <p class="form-error" data-error hidden></p><div class="form-actions"><span class="form-hint">Vos informations restent confidentielles.</span><button class="button button-primary" type="submit">Valider <span aria-hidden="true">→</span></button></div></form></section>`);
  const form = document.querySelector('#request-form');
  const slotsSection = document.querySelector('#slots-section');
  const slotsList = document.querySelector('#slots-list');
  const addButton = document.querySelector('#add-slot');
  const updateSlots = () => {
    const active = form.querySelector('input[name="callback"]:checked')?.value === 'oui';
    slotsSection.hidden = !active;
    form.querySelectorAll('[name="slot-date"], [name="slot-period"]').forEach((input) => { input.required = active; });
  };
  form.querySelectorAll('input[name="callback"]').forEach((input) => input.addEventListener('change', updateSlots));
  addButton.addEventListener('click', () => {
    const count = slotsList.querySelectorAll('.slot-row').length;
    if (count >= 3) return;
    slotsList.insertAdjacentHTML('beforeend', renderSlot(count));
    document.querySelector('#slots-count').textContent = `${count + 1} / 3`;
    addButton.hidden = count + 1 >= 3;
  });
  slotsList.addEventListener('click', (event) => {
    if (!event.target.closest('.remove-slot')) return;
    event.target.closest('.slot-row').remove();
    [...slotsList.querySelectorAll('.slot-row')].forEach((row, index) => {
      row.dataset.slot = index;
      row.querySelector('.slot-label').textContent = `Créneau ${index + 1}`;
    });
    document.querySelector('#slots-count').textContent = `${slotsList.querySelectorAll('.slot-row').length} / 3`;
    addButton.hidden = false;
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    const callback = form.querySelector('input[name="callback"]:checked').value === 'oui';
    const slots = callback ? [...slotsList.querySelectorAll('.slot-row')].map((row) => ({
      date: row.querySelector('[name="slot-date"]').value,
      period: row.querySelector('[name="slot-period"]').value,
    })) : [];
    try {
      const result = await api(`/api/public/contacts/${contact.id}/requests`, {
        method: 'POST',
        body: JSON.stringify({ description: form.elements.description.value, callback, slots }),
      });
      const notice = result.emailSent
        ? `Votre demande a bien été transmise. GaEcofi vous répondra à ${escapeHtml(result.notificationEmail)}.`
        : 'Votre demande a bien été enregistrée. La notification e-mail sera disponible après configuration de la messagerie.';
      publicFrame(`<section class="success-panel"><span class="success-mark">✓</span><span class="eyebrow">Demande envoyée</span><h1>Merci ${escapeHtml(contact.first_name)}.</h1><p>${notice}</p><a class="button button-primary" href="/contact">Terminer</a></section>`);
    } catch (error) {
      showError(form, error.message);
      button.disabled = false;
    }
  });
}

async function publicRequest() {
  const id = location.pathname.split('/').filter(Boolean).pop();
  try {
    const contact = await api(`/api/public/contacts/${encodeURIComponent(id)}`);
    requestForm(contact);
  } catch {
    publicFrame('<section class="success-panel"><span class="eyebrow">Lien indisponible</span><h1>Ce formulaire n’est plus accessible.</h1><p>Vérifiez le lien reçu ou recommencez votre demande.</p><a class="button button-primary" href="/contact">Ouvrir le formulaire de contact</a></section>');
  }
}

function shell(content, active = 'contacts') {
  root.innerHTML = `<div class="crm-layout"><aside class="sidebar"><a class="wordmark crm-wordmark" href="/" aria-label="GaEcofi"><img class="brand-logo" src="/public/gaecofi-logo.png" alt="GaEcofi"></a><span class="sidebar-caption">ESPACE GESTION</span><nav class="main-nav"><a href="/" class="nav-link ${active === 'contacts' ? 'active' : ''}">${icon('contacts')}<span>Contacts</span></a><a href="/?view=events" class="nav-link ${active === 'events' ? 'active' : ''}">${icon('events')}<span>Événements</span></a></nav><div class="sidebar-bottom"><a class="share-link" href="/contact" target="_blank" rel="noreferrer">Formulaire public ${icon('arrow')}</a><div class="user-chip"><span class="avatar">G</span><span><strong>Gestion GaEcofi</strong><small>Espace privé</small></span><button type="button" id="logout" class="icon-button logout-button" aria-label="Se déconnecter" title="Se déconnecter">${icon('logout')}</button></div></div></aside><main class="crm-main">${content}</main></div>`;
  document.querySelector('#logout').addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    loginPage();
  });
}

function loginPage(message = '') {
  setPageTitle('Connexion');
  root.innerHTML = `<main class="login-page"><div class="login-card"><a class="wordmark login-wordmark" href="/contact"><img class="brand-logo" src="/public/gaecofi-logo.png" alt="GaEcofi"></a><span class="eyebrow">Espace de gestion</span><h1>Bonjour.</h1><p>Connectez-vous pour retrouver vos contacts et vos échanges.</p><form id="login-form"><label>Mot de passe<input name="password" type="password" autocomplete="current-password" required autofocus></label><p class="form-error" data-error ${message ? '' : 'hidden'}>${escapeHtml(message)}</p><button class="button button-primary" type="submit">Accéder au CRM <span aria-hidden="true">→</span></button></form><a class="login-public-link" href="/contact">Ouvrir le formulaire public ↗</a></div></main>`;
  document.querySelector('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await api('/api/login', { method: 'POST', body: JSON.stringify({ password: form.elements.password.value }) });
      await dashboard();
    } catch (error) {
      showError(form, error.message);
      button.disabled = false;
    }
  });
}

function contactRow(contact) {
  return `<tr><td><a class="contact-name" href="/?contact=${contact.id}">${escapeHtml(contact.last_name)}, ${escapeHtml(contact.first_name)} ${icon('arrow')}</a><span class="mobile-structure">${escapeHtml(contact.structure)}</span></td><td>${escapeHtml(contact.structure || '—')}</td><td><a class="table-link" href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email || '—')}</a></td><td>${escapeHtml(contact.phone || '—')}</td><td>${contact.categories.length ? contact.categories.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join(' ') : '<span class="muted">—</span>'}</td></tr>`;
}

function pageHeader(kicker, title, subtitle, action = '') {
  return `<header class="page-header"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${subtitle}</p></div>${action}</header>`;
}

async function dashboard() {
  setPageTitle('Contacts');
  const params = new URLSearchParams(location.search);
  if (params.has('contact')) return contactDetail(params.get('contact'));
  if (params.get('view') === 'events') return eventsPage();
  shell('<div class="loading-state">Chargement des contacts…</div>', 'contacts');
  try {
    const contacts = await api('/api/contacts');
    const events = await api('/api/events');
    const requestsCount = contacts.reduce((sum, contact) => sum + 0, 0);
    const action = `<div class="header-actions"><button class="button button-primary" id="create-contact">${icon('plus')} Nouveau contact</button><a class="button button-secondary" href="/contact" target="_blank" rel="noreferrer">${icon('arrow')} Formulaire public</a></div>`;
    shell(`${pageHeader('RÉSEAU PROFESSIONNEL', 'Contacts', 'Vos relations, demandes et informations au même endroit.', action)}
      <section class="metric-strip"><div class="metric"><span>Contacts</span><strong>${contacts.length}</strong><small>Fiches enregistrées</small></div><div class="metric"><span>Événements</span><strong>${events.length}</strong><small>Échanges consignés</small></div><div class="metric"><span>Dernier ajout</span><strong class="metric-date">${contacts.length ? formatDate(contacts.map((item) => item.created_at).sort().at(-1)) : '—'}</strong><small>Contact le plus récent</small></div></section>
      <section class="data-section"><div class="section-heading"><div><span class="eyebrow">Carnet d’adresses</span><h2>Tous les contacts</h2></div><button type="button" class="button button-secondary" id="export-contacts">${icon('download')} Télécharger</button></div>
      <div class="filters-row"><label class="search-field">${icon('search')}<input id="contact-search" type="search" placeholder="Rechercher un nom, une structure…" autocomplete="off"></label><label class="select-filter"><span>Type</span><select id="category-filter"><option value="">Tous les types</option>${categories.map((category) => `<option>${category}</option>`).join('')}</select></label><span class="result-count" id="result-count">${contacts.length} contacts</span></div>
      <div class="table-scroll"><table class="data-table"><thead><tr><th>Nom</th><th>Structure</th><th>E-mail</th><th>Téléphone</th><th>Statut</th></tr></thead><tbody id="contacts-body">${contacts.map(contactRow).join('') || '<tr><td colspan="5" class="empty-row">Aucun contact pour le moment. Partagez le formulaire pour commencer.</td></tr>'}</tbody></table></div></section>`, 'contacts');
    const search = document.querySelector('#contact-search');
    const category = document.querySelector('#category-filter');
    const updateContacts = async () => {
      const query = new URLSearchParams({ q: search.value, category: category.value });
      const filtered = await api(`/api/contacts?${query}`);
      document.querySelector('#contacts-body').innerHTML = filtered.map(contactRow).join('') || '<tr><td colspan="5" class="empty-row">Aucun résultat pour ces filtres.</td></tr>';
      document.querySelector('#result-count').textContent = `${filtered.length} contact${filtered.length === 1 ? '' : 's'}`;
    };
    search.addEventListener('input', updateContacts);
    category.addEventListener('change', updateContacts);
    document.querySelector('#export-contacts').addEventListener('click', () => exportContacts(search.value, category.value));
    document.querySelector('#create-contact').addEventListener('click', () => openContactDialog(null, (id) => {
      history.pushState({}, '', `/?contact=${id}`);
      return contactDetail(id);
    }));
  } catch (error) {
    loginPage(error.message);
  }
}

async function exportContacts(query, category) {
  try {
    const params = new URLSearchParams({ q: query, category });
    const contacts = await api(`/api/contacts?${params}`);
    const columns = ['Nom', 'Prénom', 'Téléphone', 'Mail', 'LinkedIn', 'Structure', 'Fonction', 'Site', 'Adresse structure', 'Types'];
    const keys = ['last_name', 'first_name', 'phone', 'email', 'linkedin', 'structure', 'job_title', 'website', 'address'];
    const csv = [columns, ...contacts.map((contact) => [...keys.map((key) => contact[key] || ''), contact.categories.join(', ')])]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'contacts-gaecofi.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    window.alert(error.message);
  }
}

function renderRequest(request) {
  const slots = request.slots.length ? `<ul class="request-slots">${request.slots.map((slot) => `<li>${formatDate(slot.date)} <span>· ${escapeHtml(slot.period)}</span></li>`).join('')}</ul>` : '<span class="muted">Pas de rappel demandé</span>';
  return `<article class="request-card"><div class="request-card-head"><span class="request-index">Demande #${request.id}</span><time>${formatDate(request.created_at)}</time></div><p class="request-message">${escapeHtml(request.description).replaceAll('\n', '<br>')}</p><div class="request-slots-wrap"><strong>${request.callback ? 'Créneaux proposés' : 'Rappel'}</strong>${slots}</div></article>`;
}

function renderEvent(event) {
  return `<article class="event-row"><time class="event-date">${formatDate(event.event_date)}</time><div class="event-rule"></div><div class="event-content"><div class="event-title-line"><h3>${escapeHtml(event.subject)}</h3><span class="event-modality">${escapeHtml(event.modality)}</span></div><p class="event-people">${event.contacts.map((contact) => `<a href="/?contact=${contact.id}">${escapeHtml(contact.first_name)} ${escapeHtml(contact.last_name)}</a>`).join(', ')}</p>${event.comment ? `<p class="event-note">${escapeHtml(event.comment)}</p>` : ''}${event.decision ? `<p class="event-decision"><strong>Décision</strong> ${escapeHtml(event.decision)}</p>` : ''}</div></article>`;
}

function eventForm(contacts, selectedContactId) {
  const options = contacts.map((contact) => `<label class="contact-option"><input type="checkbox" name="contact_ids" value="${contact.id}" ${Number(selectedContactId) === contact.id ? 'checked' : ''}><span>${escapeHtml(contact.first_name)} ${escapeHtml(contact.last_name)}${contact.structure ? `<small>${escapeHtml(contact.structure)}</small>` : ''}</span></label>`).join('');
  return `<dialog id="event-dialog" class="event-dialog"><form id="event-form" method="dialog"><div class="dialog-heading"><div><span class="eyebrow">Suivi relationnel</span><h2>Nouvel événement</h2></div><button class="icon-button" type="button" id="close-dialog" aria-label="Fermer">×</button></div><div class="form-grid dialog-grid"><label>Date<input name="event_date" type="date" value="${today}" required></label><label>Modalité<select name="modality" required><option value="">Choisir</option><option>Téléphone</option><option>E-mail</option><option>Rendez-vous</option><option>Visioconférence</option><option>Autre</option></select></label><label class="field-wide">Objet<input name="subject" required maxlength="180" placeholder="Sujet principal"></label><fieldset class="contact-picker field-wide"><legend>Personnes concernées <span class="required">*</span></legend><div class="contact-options">${options || '<span class="muted">Aucun contact enregistré.</span>'}</div></fieldset><label class="field-wide">Commentaire<textarea name="comment" rows="3" maxlength="5000"></textarea></label><label class="field-wide">Décision<textarea name="decision" rows="2" maxlength="3000"></textarea></label></div><p class="form-error" data-error hidden></p><div class="dialog-actions"><button type="button" id="cancel-dialog" class="button button-secondary">Annuler</button><button type="submit" class="button button-primary">Enregistrer</button></div></form></dialog>`;
}

function contactEditorForm(contact = null) {
  const fields = [
    ['last_name', 'Nom', 'text', true],
    ['first_name', 'Prénom', 'text', true],
    ['phone', 'N° de téléphone', 'tel'],
    ['email', 'Mail', 'email'],
    ['linkedin', 'Lien LinkedIn', 'url'],
    ['structure', 'Structure', 'text'],
    ['job_title', 'Fonction', 'text'],
    ['website', 'Site', 'url'],
    ['address', 'Adresse structure', 'text'],
  ];
  const inputs = fields.map(([name, label, type, required]) => `<label class="${name === 'address' ? 'field-wide' : ''}">${label}${required ? ' <span class="required">*</span>' : ''}<input name="${name}" type="${type}" value="${escapeHtml(contact?.[name] || '')}" ${required ? 'required' : ''} maxlength="${name === 'email' ? 254 : 300}"></label>`).join('');
  const statusOptions = categories.map((category) => `<label class="tag-check"><input type="checkbox" name="categories" value="${category}" ${contact?.categories.includes(category) ? 'checked' : ''}><span>${category}</span></label>`).join('');
  const heading = contact ? 'Modifier le contact' : 'Nouveau contact';
  const submitLabel = contact ? 'Enregistrer les modifications' : 'Créer le contact';
  return `<dialog id="contact-dialog" class="event-dialog contact-dialog"><form id="contact-form" method="dialog"><div class="dialog-heading"><div><span class="eyebrow">Carnet d’adresses</span><h2>${heading}</h2></div><button class="icon-button" type="button" id="close-contact-dialog" aria-label="Fermer">×</button></div><div class="form-grid dialog-grid">${inputs}${contact ? '' : `<fieldset class="contact-picker field-wide"><legend>Statut</legend><div class="tag-checks">${statusOptions}</div></fieldset>`}</div><p class="form-error" data-error hidden></p><div class="dialog-actions"><button type="button" id="cancel-contact-dialog" class="button button-secondary">Annuler</button><button type="submit" class="button button-primary">${submitLabel}</button></div></form></dialog>`;
}

async function openContactDialog(contact, onSaved) {
  document.body.insertAdjacentHTML('beforeend', contactEditorForm(contact));
  const dialog = document.querySelector('#contact-dialog');
  const close = () => { dialog.close(); dialog.remove(); };
  document.querySelector('#close-contact-dialog').addEventListener('click', close);
  document.querySelector('#cancel-contact-dialog').addEventListener('click', close);
  dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
  dialog.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    const payload = Object.fromEntries(new FormData(form));
    if (!contact) payload.categories = [...form.querySelectorAll('input[name="categories"]:checked')].map((input) => input.value);
    try {
      const result = await api(contact ? `/api/contacts/${contact.id}` : '/api/contacts', {
        method: contact ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      close();
      await onSaved(result.id);
    } catch (error) {
      showError(form, error.message);
      button.disabled = false;
    }
  });
  dialog.showModal();
}

async function openEventDialog(contacts, selectedContactId, onSaved) {
  document.body.insertAdjacentHTML('beforeend', eventForm(contacts, selectedContactId));
  const dialog = document.querySelector('#event-dialog');
  const close = () => { dialog.close(); dialog.remove(); };
  document.querySelector('#close-dialog').addEventListener('click', close);
  document.querySelector('#cancel-dialog').addEventListener('click', close);
  dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
  dialog.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const payload = Object.fromEntries(new FormData(form));
      payload.contact_ids = [...form.querySelectorAll('input[name="contact_ids"]:checked')].map((input) => Number(input.value));
      await api('/api/events', { method: 'POST', body: JSON.stringify(payload) });
      close();
      await onSaved();
    } catch (error) {
      showError(form, error.message);
      button.disabled = false;
    }
  });
  dialog.showModal();
}

async function contactDetail(id) {
  setPageTitle('Fiche contact');
  shell('<div class="loading-state">Ouverture de la fiche…</div>', 'contacts');
  try {
    const [contact, contacts] = await Promise.all([api(`/api/contacts/${encodeURIComponent(id)}`), api('/api/contacts')]);
    const details = [
      ['E-mail', contact.email, contact.email ? `mailto:${contact.email}` : ''],
      ['Téléphone', contact.phone, contact.phone ? `tel:${contact.phone}` : ''],
      ['LinkedIn', contact.linkedin, contact.linkedin],
      ['Fonction', contact.job_title, ''],
      ['Site', contact.website, contact.website],
      ['Adresse structure', contact.address, ''],
    ];
    const action = `<div class="header-actions"><button class="button button-secondary" id="edit-contact">Modifier</button><button class="button button-danger" id="delete-contact">Supprimer</button><button class="button button-primary" id="new-event">${icon('plus')} Ajouter un événement</button></div>`;
    const detailRows = details.map(([label, value, href]) => `<div class="detail-item"><span>${label}</span>${href ? `<a href="${escapeHtml(href)}" ${href.startsWith('http') ? 'target="_blank" rel="noreferrer"' : ''}>${escapeHtml(value || '—')}</a>` : `<strong>${escapeHtml(value || '—')}</strong>`}</div>`).join('');
    const tagChecks = categories.map((category) => `<label class="tag-check"><input type="checkbox" value="${category}" ${contact.categories.includes(category) ? 'checked' : ''}><span>${category}</span></label>`).join('');
    shell(`<div class="detail-back"><a href="/">← Tous les contacts</a></div>${pageHeader('FICHE CONTACT', `${escapeHtml(contact.first_name)} ${escapeHtml(contact.last_name)}`, escapeHtml(contact.structure || 'Contact individuel'), action)}
      <div class="detail-layout"><div class="detail-primary"><section class="detail-section"><div class="section-heading"><div><span class="eyebrow">Coordonnées</span><h2>Informations</h2></div></div><div class="details-grid">${detailRows}</div></section>
      <section class="detail-section"><div class="section-heading"><div><span class="eyebrow">Relation</span><h2>Statut du contact</h2></div><span class="muted">Plusieurs choix possibles</span></div><div class="tag-checks">${tagChecks}</div></section>
      <section class="detail-section"><div class="section-heading"><div><span class="eyebrow">Historique</span><h2>Événements <span class="heading-count">${contact.events.length}</span></h2></div></div><div class="timeline">${contact.events.map(renderEvent).join('') || '<p class="empty-inline">Aucun événement consigné.</p>'}</div></section></div>
      <aside class="detail-aside"><div class="aside-heading"><span class="eyebrow">Formulaire public</span><h2>Demandes de rendez-vous</h2><span class="heading-count">${contact.requests.length}</span></div><div class="requests-list">${contact.requests.map(renderRequest).join('') || '<p class="empty-inline">Aucune demande reçue pour ce contact.</p>'}</div><div class="record-meta">Contact créé le ${formatDate(contact.created_at)}</div></aside></div>`, 'contacts');
    document.querySelectorAll('.tag-check input').forEach((input) => input.addEventListener('change', async () => {
      const selected = [...document.querySelectorAll('.tag-check input:checked')].map((item) => item.value);
      try { await api(`/api/contacts/${contact.id}/categories`, { method: 'PATCH', body: JSON.stringify({ categories: selected }) }); }
      catch (error) { window.alert(error.message); input.checked = !input.checked; }
    }));
    document.querySelector('#edit-contact').addEventListener('click', () => openContactDialog(contact, () => contactDetail(contact.id)));
    document.querySelector('#delete-contact').addEventListener('click', async () => {
      const confirmed = window.confirm(`Supprimer la fiche de ${contact.first_name} ${contact.last_name} ? Ses demandes et les événements qui ne concernent que cette personne seront supprimés. Les événements partagés resteront dans l’historique sans ce contact.`);
      if (!confirmed) return;
      try {
        await api(`/api/contacts/${contact.id}`, { method: 'DELETE' });
        history.pushState({}, '', '/');
        await dashboard();
      } catch (error) {
        window.alert(error.message);
      }
    });
    document.querySelector('#new-event').addEventListener('click', () => openEventDialog(contacts, contact.id, () => contactDetail(contact.id)));
  } catch (error) {
    loginPage(error.message);
  }
}

async function eventsPage() {
  setPageTitle('Événements');
  shell('<div class="loading-state">Chargement des événements…</div>', 'events');
  try {
    const [events, contacts] = await Promise.all([api('/api/events'), api('/api/contacts')]);
    const action = `<button class="button button-primary" id="new-event">${icon('plus')} Ajouter un événement</button>`;
    shell(`${pageHeader('SUIVI RELATIONNEL', 'Événements', 'Retrouvez les échanges, décisions et prochaines étapes.', action)}
      <section class="data-section events-section"><div class="section-heading"><div><span class="eyebrow">Journal des échanges</span><h2>Du plus récent au plus ancien</h2></div></div><div class="event-filters"><label>Du<input type="date" id="date-from"></label><label>Au<input type="date" id="date-to"></label><label class="keyword-field">Mot-clé<input type="search" id="event-keyword" placeholder="Commentaire ou décision"></label><button type="button" id="clear-event-filters" class="text-button">Effacer les filtres</button></div><div id="event-list" class="timeline global-timeline">${events.map(renderEvent).join('') || '<p class="empty-inline">Aucun événement pour le moment.</p>'}</div></section>`, 'events');
    document.querySelector('#new-event').addEventListener('click', () => openEventDialog(contacts, null, eventsPage));
    const refresh = async () => {
      const params = new URLSearchParams({ from: document.querySelector('#date-from').value, to: document.querySelector('#date-to').value, keyword: document.querySelector('#event-keyword').value });
      const filtered = await api(`/api/events?${params}`);
      document.querySelector('#event-list').innerHTML = filtered.map(renderEvent).join('') || '<p class="empty-inline">Aucun événement pour ces filtres.</p>';
    };
    document.querySelectorAll('#date-from, #date-to').forEach((input) => input.addEventListener('change', refresh));
    document.querySelector('#event-keyword').addEventListener('input', refresh);
    document.querySelector('#clear-event-filters').addEventListener('click', () => {
      document.querySelector('#date-from').value = '';
      document.querySelector('#date-to').value = '';
      document.querySelector('#event-keyword').value = '';
      refresh();
    });
  } catch (error) {
    loginPage(error.message);
  }
}

async function start() {
  if (location.pathname === '/contact') return contactForm();
  if (location.pathname.startsWith('/demande/')) return publicRequest();
  try {
    const { authenticated } = await api('/api/me');
    if (authenticated) await dashboard();
    else loginPage();
  } catch {
    loginPage('Le serveur est momentanément indisponible.');
  }
}

start();