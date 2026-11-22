// Shared logic for every page. Data is stored in the browser (localStorage).
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db; try { db = JSON.parse(localStorage.getItem('hms')); } catch (e) {}
db = db || {patients: [], doctors: [], appointments: [], bills: [], n: 1};
const save = () => { try { localStorage.setItem('hms', JSON.stringify(db)); } catch (e) {} };
const nm = (t, id) => (db[t].find(x => x.id == id) || {}).name || '(deleted)';
const money = n => '₹' + (+n).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const iso = d => d.toLocaleDateString('en-CA');
const page = document.body.dataset.page;

const E = {
  patients: {t: 'Patients', o: 'patient',
    f: [['name','Full name','text',1],['age','Age','number',1],['gender','Gender','select',1,['Female','Male','Other']],['blood','Blood group','text'],['phone','Phone','text'],['address','Address','text']],
    c: ['name','age','gender','blood','phone','address']},
  doctors: {t: 'Doctors', o: 'doctor',
    f: [['name','Full name','text',1],['spec','Specialization','text',1],['days','Available days','text'],['phone','Phone','text'],['email','Email','email']],
    c: ['name','spec','days','phone','email']},
  appointments: {t: 'Appointments', o: 'appointment',
    f: [['patient','Patient','patients',1],['doctor','Doctor','doctors',1],['date','Date','date',1],['time','Time','time',1],['reason','Reason','text'],['status','Status','select',1,['Scheduled','Completed','Cancelled']]],
    c: ['date','time','patient','doctor','reason','status']},
  bills: {t: 'Billing', o: 'bill',
    f: [['patient','Patient','patients',1],['desc','Description','text',1],['amount','Amount (₹)','number',1]],
    c: ['date','patient','desc','amount','status']}
};
const NAV = [['index.html','dashboard','Dashboard'],['patients.html','patients','Patients'],['doctors.html','doctors','Doctors'],['appointments.html','appointments','Appointments'],['billing.html','bills','Billing']];

const hd = (t, k) => (E[t].f.find(x => x[0] == k) || [0, k == 'date' ? 'Date' : 'Status'])[1];
function cell(t, r, k) {
  const f = E[t].f.find(x => x[0] == k) || []; let v = r[k];
  if (f[2] == 'patients' || f[2] == 'doctors') v = nm(f[2], v);
  if (k == 'amount') return money(v);
  if (k == 'status') return `<span class="tag ${v=='Paid'||v=='Completed'?'ok':v=='Unpaid'||v=='Cancelled'?'bad':''}">${esc(v)}</span>`;
  return esc(v);
}

function dash() {
  const today = iso(new Date());
  const rows = db.appointments.filter(a => a.date == today).sort((a, b) => a.time.localeCompare(b.time));
  const unpaid = db.bills.filter(b => b.status == 'Unpaid').reduce((s, b) => s + +b.amount, 0);
  return `<div class="head"><h1>Today, ${new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}</h1><div><a class="btn p" href="appointments.html">Book appointment</a></div></div>
  <section class="panel"><h2>Today’s appointments (${rows.length})</h2>` +
  (rows.length ? `<div class="sc"><table><thead><tr><th>Time</th><th>Patient</th><th>Doctor</th><th>Reason</th><th>Status</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.time)}</td><td>${esc(nm('patients',r.patient))}</td><td>${esc(nm('doctors',r.doctor))}</td><td>${esc(r.reason)}</td><td>${cell('appointments',r,'status')}</td></tr>`).join('')}</tbody></table></div>`
   : `<p class="mut">No appointments are booked for today. Book one from the Appointments page.</p>`) +
  `</section><div class="stats"><div><b>${db.patients.length}</b><span class="mut">Registered patients</span></div><div><b>${db.doctors.length}</b><span class="mut">Doctors on staff</span></div><div><b>${money(unpaid)}</b><span class="mut">Unpaid bills</span></div></div>`;
}

function list(t) {
  const e = E[t], rows = [...db[t]].reverse();
  return `<div class="head"><h1>${e.t}</h1><div><input type="search" id="q" placeholder="Search ${e.t.toLowerCase()}" aria-label="Search ${e.t.toLowerCase()}">${t=='bills'?'<button class="btn" data-a="printlist">Print list</button>':''}<button class="btn p" data-a="add">Add ${e.o}</button></div></div><section class="panel">` +
  (rows.length ? `<div class="sc"><table class="ls"><thead><tr>${e.c.map(k => `<th>${hd(t,k)}</th>`).join('')}<th></th></tr></thead><tbody>${rows.map(r => `<tr>${e.c.map(k => `<td>${cell(t,r,k)}</td>`).join('')}<td class="act">${t=='bills' ? (r.status=='Unpaid' ? `<button class="lk" data-a="pay" data-id="${r.id}">Mark paid</button>` : '') + `<button class="lk" data-a="invoice" data-id="${r.id}">Print invoice</button>` : `<button class="lk" data-a="edit" data-id="${r.id}">Edit</button>`}<button class="lk bad" data-a="del" data-id="${r.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>`
   : `<p class="mut">No ${e.t.toLowerCase()} yet. Add the first ${e.o} to get started.</p>`) + `</section>`;
}

function render() {
  $('#nav').innerHTML = NAV.map(([h, k, l]) => `<a href="${h}" class="${k==page?'on':''}">${l}</a>`).join('');
  $('#main').innerHTML = page == 'dashboard' ? dash() : list(page);
  const q = $('#q');
  if (q) q.oninput = () => { const s = q.value.toLowerCase().trim(); document.querySelectorAll('tbody tr').forEach(tr => tr.hidden = s && !tr.textContent.toLowerCase().includes(s)); };
}

function toast(m) { const t = $('#toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(() => t.style.display = 'none', 2200); }

// Print one bill as an invoice
function printInvoice(id) {
  const b = db.bills.find(x => x.id == id); if (!b) return;
  const p = db.patients.find(x => x.id == b.patient) || {};
  let inv = $('#invoice');
  if (!inv) { inv = document.createElement('div'); inv.id = 'invoice'; document.body.appendChild(inv); }
  const d = new Date((b.date || iso(new Date())) + 'T00:00:00');
  inv.innerHTML = `<div class="inv">
    <div class="ih"><div><h1>Hospital Management</h1><div>Patient invoice</div></div><div class="r"><b>Invoice #${String(b.id).padStart(4,'0')}</b><br>${(isNaN(d) ? new Date() : d).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</div></div>
    <div><b>Billed to</b><br>${esc(p.name || '(deleted patient)')}<br>${p.age !== undefined ? `Age ${esc(p.age)}, ${esc(p.gender)}<br>` : ''}${esc(p.phone)}</div>
    <table><thead><tr><th>Description</th><th class="r">Amount</th></tr></thead><tbody><tr><td>${esc(b.desc)}</td><td class="r">${money(b.amount)}</td></tr></tbody><tfoot><tr><th>Total</th><th class="r">${money(b.amount)}</th></tr></tfoot></table>
    <p>Payment status: <b>${esc(b.status)}</b></p>
    <div class="sig">Authorised signature</div></div>`;
  document.body.classList.add('pi');
  window.print();
}
window.addEventListener('afterprint', () => document.body.classList.remove('pi'));

function openForm(t, id) {
  const e = E[t], r = id ? db[t].find(x => x.id == id) : {};
  for (const f of e.f) if ((f[2]=='patients'||f[2]=='doctors') && !db[f[2]].length) return toast(`Add a ${f[2]=='patients'?'patient':'doctor'} first.`);
  const fm = $('#fm'); fm.dataset.id = id || '';
  fm.innerHTML = `<h2>${id?'Edit':'Add'} ${e.o}</h2>` + e.f.map(([k, l, ty, req, op]) => {
    const v = r[k] ?? ''; let inp;
    if (ty == 'select') inp = `<select name="${k}">${op.map(o => `<option ${o==v?'selected':''}>${o}</option>`).join('')}</select>`;
    else if (ty == 'patients' || ty == 'doctors') inp = `<select name="${k}" required><option value="">Select</option>${db[ty].map(x => `<option value="${x.id}" ${x.id==v?'selected':''}>${esc(x.name)}</option>`).join('')}</select>`;
    else inp = `<input name="${k}" type="${ty}" value="${esc(v)}" ${req?'required':''} ${ty=='number'?(k=='age'?'min="0" max="120"':'min="0.01" step="0.01"'):''}>`;
    return `<label>${l}${inp}</label>`;
  }).join('') + `<p class="err" id="err" role="alert"></p><div class="fa"><button type="button" class="btn" data-a="close">Cancel</button><button class="btn p">Save ${e.o}</button></div>`;
  $('#dlg').showModal();
}

$('#fm').onsubmit = ev => {
  ev.preventDefault();
  const fm = ev.target, id = fm.dataset.id, d = Object.fromEntries(new FormData(fm));
  if (d.name) d.name = d.name.trim();
  if (page == 'appointments' && d.status != 'Cancelled' && db.appointments.some(a => a.id != id && a.doctor == d.doctor && a.date == d.date && a.time == d.time && a.status != 'Cancelled'))
    return $('#err').textContent = 'That doctor already has an appointment at this time. Pick another slot.';
  if (id) Object.assign(db[page].find(x => x.id == id), d);
  else db[page].push({id: db.n++, ...(page == 'bills' ? {status: 'Unpaid', date: iso(new Date())} : {}), ...d});
  save(); $('#dlg').close(); render(); toast('Saved.');
};

document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, id = b.dataset.id;
  if (a == 'add') openForm(page);
  else if (a == 'edit') openForm(page, id);
  else if (a == 'close') $('#dlg').close();
  else if (a == 'invoice') printInvoice(id);
  else if (a == 'printlist') window.print();
  else if (a == 'pay') { db.bills.find(x => x.id == id).status = 'Paid'; save(); render(); toast('Bill marked as paid.'); }
  else if (a == 'del' && confirm('Delete this record? Related appointments and bills are deleted too.')) {
    db[page] = db[page].filter(x => x.id != id);
    if (page == 'patients') { db.appointments = db.appointments.filter(x => x.patient != id); db.bills = db.bills.filter(x => x.patient != id); }
    if (page == 'doctors') db.appointments = db.appointments.filter(x => x.doctor != id);
    save(); render(); toast('Deleted.');
  }
});
render();