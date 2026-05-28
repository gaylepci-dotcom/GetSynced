// ─────────────────────────────────────────────────────────
// FIREBASE IMPORTS
// ─────────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
  browserLocalPersistence, setPersistence
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, limit, getDocs,
  serverTimestamp, where
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBSDXY2thKUA_hFX3_AAt8NkymbmqnYEFk",
  authDomain:        "thepcompany-fdc3a.firebaseapp.com",
  projectId:         "thepcompany-fdc3a",
  storageBucket:     "thepcompany-fdc3a.firebasestorage.app",
  messagingSenderId: "474105576770",
  appId:             "1:474105576770:web:d936d2cd0db46eab381cdb",
  measurementId:     "G-XK79GD5DDL",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────
let allEmployees  = [];
let allAttendance = [];
let allPayroll    = [];
let allJobs       = [];
let activeUnsubs  = [];
let currentSection = 'dashboard';
let pendingDeleteFn = null;
let allApplications = [];

// ─────────────────────────────────────────────────────────
// AUTH GUARD
// ─────────────────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = "login.html"; return; }

  const name     = user.displayName || user.email.split("@")[0];
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);

  document.getElementById("sidebarInitials").textContent  = initials;
  document.getElementById("sidebarUserName").textContent  = name;
  document.getElementById("sidebarUserEmail").textContent = user.email;
  document.getElementById("topbarInitials").textContent   = initials;

  startSubscriptions();
  loadSection("dashboard");
});

// ─────────────────────────────────────────────────────────
// LIVE SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────
function startSubscriptions() {
  activeUnsubs.forEach(u => u());
  activeUnsubs = [];

  // Employees
  activeUnsubs.push(onSnapshot(
    query(collection(db,"employees"), orderBy("createdAt","desc")),
    snap => {
      allEmployees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateBadge("employeeCount", allEmployees.length);
      if (currentSection === "dashboard")   renderDashboard();
      if (currentSection === "employees")   renderEmployeesSection();
      populateEmployeeSelects();
    }
  ));

  // Attendance
  activeUnsubs.push(onSnapshot(
    query(collection(db,"attendance"), orderBy("createdAt","desc")),
    snap => {
      allAttendance = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (currentSection === "dashboard")   renderDashboard();
      if (currentSection === "attendance")  renderAttendanceSection();
    }
  ));

  // Payroll
  activeUnsubs.push(onSnapshot(
    query(collection(db,"payroll"), orderBy("createdAt","desc")),
    snap => {
      allPayroll = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (currentSection === "dashboard")   renderDashboard();
      if (currentSection === "payroll")     renderPayrollSection();
    }
  ));

  // Jobs
  activeUnsubs.push(onSnapshot(
    query(collection(db,"jobs"), orderBy("createdAt","desc")),
    snap => {
      allJobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const openCount = allJobs.filter(j => j.status === "Open").length;
      updateBadge("jobCount", openCount);
      if (currentSection === "dashboard") renderDashboard();
      if (currentSection === "jobs")      renderJobsSection();
    }
  ));

activeUnsubs.push(onSnapshot(
  query(collection(db,"applications"), orderBy("createdAt","desc")),
  snap => {
    allApplications = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const newCount = allApplications.filter(a => (a.status || "New") === "New").length;
    updateBadge("applicationCount", newCount);

    if (currentSection === "dashboard")    renderDashboard();
    if (currentSection === "applications") renderApplicationsSection();
  }
));


}

// ─────────────────────────────────────────────────────────
// SECTION LOADER
// ─────────────────────────────────────────────────────────
window.loadSection = function(section) {
  currentSection = section;
  document.getElementById("topbarTitle").textContent =
  { dashboard:"Dashboard", employees:"Employees", attendance:"Attendance",
    payroll:"Payroll", jobs:"Job Listings", applications:"Applications", settings:"Settings" }[section] || section;

    const map = {
    dashboard:    renderDashboard,
    employees:    renderEmployeesSection,
    attendance:   renderAttendanceSection,
    payroll:      renderPayrollSection,
    jobs:         renderJobsSection,
    applications: renderApplicationsSection,
    settings:     renderSettingsSection,
    audit: renderAuditSection,
  };
  if (map[section]) map[section]();
};

window.setActiveNav = function(el) {
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
  el.classList.add("active");
};

window.toggleSidebar = function() {
  document.getElementById("sidebar").classList.toggle("open");
};

// ─────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────
function renderDashboard() {
  const today       = new Date().toISOString().split("T")[0];
  const todayAtt    = allAttendance.filter(r => r.date === today).length;
  const totalPayroll= allPayroll.reduce((s,r) => s + Number(r.amount||0), 0);
  const openJobs    = allJobs.filter(j => j.status === "Open").length;

  // Dept breakdown
  const deptMap = {};
  allEmployees.forEach(e => {
    const d = e.department || "Unassigned";
    deptMap[d] = (deptMap[d]||0) + 1;
  });
  const maxDept = Math.max(...Object.values(deptMap), 1);
  const deptHTML = Object.entries(deptMap).length
    ? Object.entries(deptMap).map(([name,count]) => `
        <div class="dept-row">
          <div class="dept-meta">
            <span class="dept-name">${name}</span>
            <span class="dept-count">${count}</span>
          </div>
          <div class="dept-bar-bg">
            <div class="dept-bar-fill" style="width:${(count/maxDept)*100}%"></div>
          </div>
        </div>`).join("")
    : `<p style="color:var(--text-muted);font-size:13px;">No employees yet.</p>`;

  // Recent attendance
  const attHTML = allAttendance.slice(0,6).length
    ? allAttendance.slice(0,6).map(r => `
        <div class="attend-item">
          <div class="attend-info">
            <div class="attend-name">${r.employeeName||"Unknown"}</div>
            <div class="attend-date">${r.date||""} ${r.note ? "· "+r.note : ""}</div>
          </div>
          ${statusBadge(r.status)}
        </div>`).join("")
    : `<p style="color:var(--text-muted);font-size:13px;padding:8px 0;">No attendance records yet.</p>`;

  // Recent employees
  const empHTML = allEmployees.slice(0,5).length
    ? allEmployees.slice(0,5).map(e => `
        <div class="emp-item">
          <div class="emp-avatar" style="background:${avatarColor(e.firstName)}">${initials(e.firstName,e.lastName)}</div>
          <div class="emp-info">
            <div class="emp-name">${e.firstName} ${e.lastName}</div>
            <div class="emp-dept">${e.department||"No Department"} ${e.position ? "· "+e.position : ""}</div>
          </div>
          <span class="${e.status==="Active"?"badge-active":"badge-on-leave"}">${e.status||"Active"}</span>
        </div>`).join("")
    : `<p style="color:var(--text-muted);font-size:13px;padding:8px 0;">No employees yet.</p>`;

  set("mainContent", `
    <div class="page-header">
      <h2>Dashboard</h2>
      <p>Welcome back — here's what's happening at The P Company</p>
    </div>

    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-top">
          <div class="stat-label">Total Employees</div>
          <div class="stat-icon blue"><i class="fas fa-users"></i></div>
        </div>
        <div class="stat-value">${allEmployees.length}</div>
        <div class="stat-sub">${allEmployees.filter(e=>e.status==="Active").length} active</div>
        <div class="stat-trend flat"><i class="fas fa-minus fa-xs"></i> All time</div>
      </div>
      <div class="stat-card green">
        <div class="stat-top">
          <div class="stat-label">Today's Attendance</div>
          <div class="stat-icon green"><i class="fas fa-calendar-check"></i></div>
        </div>
        <div class="stat-value">${todayAtt}</div>
        <div class="stat-sub">Checked in today</div>
        <div class="stat-trend ${todayAtt>0?"up":"flat"}"><i class="fas fa-${todayAtt>0?"arrow-up":"minus"} fa-xs"></i> ${todayAtt>0?todayAtt+" record(s)":"No records yet"}</div>
      </div>
      <div class="stat-card amber">
        <div class="stat-top">
          <div class="stat-label">Total Payroll Paid</div>
          <div class="stat-icon amber"><i class="fas fa-dollar-sign"></i></div>
        </div>
        <div class="stat-value" style="font-size:24px;">₱${totalPayroll.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div class="stat-sub">${allPayroll.length} records</div>
        <div class="stat-trend up"><i class="fas fa-arrow-up fa-xs"></i> All time</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-top">
          <div class="stat-label">Open Positions</div>
          <div class="stat-icon purple"><i class="fas fa-briefcase"></i></div>
        </div>
        <div class="stat-value">${openJobs}</div>
        <div class="stat-sub">${allJobs.length} total listings</div>
        <div class="stat-trend flat"><i class="fas fa-minus fa-xs"></i> Current</div>
      </div>
    </div>

    <div class="grid-row col-3-5">
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title"><i class="fas fa-chart-bar"></i> Department Breakdown</div>
          <a href="#" class="panel-action" onclick="setActiveNav(document.querySelectorAll('.nav-link')[1]);loadSection('employees')">View all</a>
        </div>
        <div class="panel-body">${deptHTML}</div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title"><i class="fas fa-clock"></i> Recent Attendance</div>
          <a href="#" class="panel-action" onclick="setActiveNav(document.querySelectorAll('.nav-link')[2]);loadSection('attendance')">View all</a>
        </div>
        <div class="panel-body" style="padding-top:6px;padding-bottom:6px;">${attHTML}</div>
      </div>
    </div>

    <div class="grid-row col-5-3">
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title"><i class="fas fa-user-plus"></i> New Employees</div>
          <a href="#" class="panel-action" onclick="setActiveNav(document.querySelectorAll('.nav-link')[1]);loadSection('employees')">View all</a>
        </div>
        <div class="panel-body" style="padding-top:6px;padding-bottom:6px;">${empHTML}</div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title"><i class="fas fa-bolt"></i> Quick Actions</div>
        </div>
        <div class="quick-actions">
          <button class="qa-btn qa-blue" onclick="openModal('employeeModal')">
            <i class="fas fa-user-plus" style="color:var(--accent-light)"></i> Add Employee
          </button>
          <button class="qa-btn qa-green" onclick="openModal('attendanceModal')">
            <i class="fas fa-calendar-plus" style="color:#4ade80"></i> Log Attendance
          </button>
          <button class="qa-btn qa-amber" onclick="openModal('payrollModal')">
            <i class="fas fa-file-invoice-dollar" style="color:var(--brand-amber)"></i> Run Payroll
          </button>
          <button class="qa-btn qa-purple" onclick="openModal('jobModal')">
            <i class="fas fa-plus-circle" style="color:var(--brand-purple)"></i> Post Job
          </button>
        </div>
      </div>
    </div>
  `);
}

// ─────────────────────────────────────────────────────────
// EMPLOYEES SECTION
// ─────────────────────────────────────────────────────────
function renderEmployeesSection() {
  const search = (document.getElementById("globalSearch")?.value||"").toLowerCase();
  const list   = allEmployees.filter(e =>
    !search ||
    `${e.firstName} ${e.lastName} ${e.department} ${e.email}`.toLowerCase().includes(search)
  );

 const rows = list.length
  ? list.map(e => `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:16px 22px;vertical-align:middle;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="emp-avatar" style="background:${avatarColor(e.firstName)};width:34px;height:34px;font-size:11px;">${initials(e.firstName,e.lastName)}</div>
            <div>
              <div style="font-weight:500;color:var(--text-primary)">${e.firstName} ${e.lastName}</div>
              <div style="font-size:11.5px;color:var(--text-muted)">${e.email||""}</div>
            </div>
          </div>
        </td>
        <td style="padding:16px 22px;vertical-align:middle;color:var(--text-secondary)">${e.department||"—"}</td>
        <td style="padding:16px 22px;vertical-align:middle;color:var(--text-secondary)">${e.position||"—"}</td>
        <td style="padding:16px 22px;vertical-align:middle;">
          ${e.status==="Active"
            ? `<span class="badge-active">Active</span>`
            : `<span class="badge-on-leave">${e.status||"Active"}</span>`}
        </td>
        <td style="padding:16px 22px;vertical-align:middle;">
          <div style="display:flex;gap:8px;align-items:center;">
            <button onclick="openEditEmployee('${e.id}')" style="background:var(--accent-dim);color:var(--accent-light);border:none;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="openDeleteModal('employees','${e.id}','${e.firstName} ${e.lastName}')"" style="background:var(--danger-bg);color:var(--danger);border:none;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`).join("")
  : `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">No employees found.</td></tr>`;

  set("mainContent", `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h2>Employees</h2>
        <p>${allEmployees.length} total · ${allEmployees.filter(e=>e.status==="Active").length} active</p>
      </div>
      <button onclick="openModal('employeeModal')" style="background:linear-gradient(135deg,var(--brand-purple),var(--ring-violet));color:#fff;border:none;border-radius:12px;padding:11px 20px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;">
        <i class="fas fa-plus"></i> Add Employee
      </button>
    </div>
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--border);">
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Employee</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Department</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Position</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Status</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Actions</th>
            </tr>
          </thead>
          <tbody style="divide-y:var(--border);">${rows}</tbody>
        </table>
      </div>
    </div>
  `);
}

// ─────────────────────────────────────────────────────────
// ATTENDANCE SECTION
// ─────────────────────────────────────────────────────────
function renderAttendanceSection() {
  const rows = allAttendance.length
    ? allAttendance.map(r => `
        <tr>
          <td style="padding:13px 22px;color:var(--text-primary);font-weight:500;">${r.employeeName||"Unknown"}</td>
          <td style="padding:13px 22px;color:var(--text-secondary)">${r.date||"—"}</td>
          <td style="padding:13px 22px;">${statusBadge(r.status)}</td>
          <td style="padding:13px 22px;color:var(--text-muted);font-size:12px;">${r.note||"—"}</td>
          <td style="padding:13px 22px;">
            <div style="display:flex;gap:8px;">
              <button onclick="openEditAttendance('${r.id}')" style="background:var(--accent-dim);color:var(--accent-light);border:none;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;">
                <i class="fas fa-edit"></i>
              </button>
              <button onclick="openDeleteModal('attendance','${r.id}','${r.employeeName} on ${r.date}')" style="background:var(--danger-bg);color:var(--danger);border:none;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>`).join("")
    : `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">No attendance records yet.</td></tr>`;

  set("mainContent", `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h2>Attendance</h2>
        <p>${allAttendance.length} total records</p>
      </div>
      <button onclick="openModal('attendanceModal')" style="background:linear-gradient(135deg,var(--brand-purple),var(--ring-violet));color:#fff;border:none;border-radius:12px;padding:11px 20px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;">
        <i class="fas fa-plus"></i> Log Attendance
      </button>
    </div>
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--border);">
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Employee</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Date</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Status</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Note</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `);
}


function renderApplicationsSection() {
  const rows = allApplications.length
    ? allApplications.map(a => `
        <tr>
          <td style="padding:13px 22px;">
            <div style="color:var(--text-primary);font-weight:600;">${a.fullName || "Unknown"}</div>
            <div style="font-size:12px;color:var(--text-muted);">${a.email || ""}</div>
          </td>
          <td style="padding:13px 22px;color:var(--text-secondary)">${a.jobTitle || "—"}</td>
          <td style="padding:13px 22px;color:var(--text-secondary)">${a.phone || "—"}</td>
          <td style="padding:13px 22px;">
            <span class="${a.status==="Reviewed"?"badge-active":"badge-on-leave"}">${a.status || "New"}</span>
          </td>
          <td style="padding:13px 22px;">
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <a href="${a.resumeLink || "#"}" target="_blank" rel="noopener noreferrer" style="background:var(--accent-dim);color:var(--accent-light);text-decoration:none;border:none;border-radius:8px;padding:6px 12px;font-size:12px;display:inline-flex;align-items:center;gap:6px;">
                <i class="fas fa-link"></i> Resume
              </a>
              <button onclick="markApplicationReviewed('${a.id}')" style="background:rgba(34,197,94,.12);color:#4ade80;border:none;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;">
                <i class="fas fa-check"></i>
              </button>
              <button onclick="openDeleteModal('applications','${a.id}','${a.fullName} — ${a.jobTitle}')" style="background:var(--danger-bg);color:var(--danger);border:none;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>`).join("")
    : `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">No applications yet.</td></tr>`;

  set("mainContent", `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h2>Applications</h2>
        <p>${allApplications.length} total submissions</p>
      </div>
    </div>
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--border);">
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Applicant</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Job</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Phone</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Status</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `);
}


window.openEditAttendance = function(id) {
  const r = allAttendance.find(x => x.id === id);
  if (!r) return;

  document.getElementById("editAttId").value = r.id;
  document.getElementById("editAttEmpId").value = r.employeeId || "";
  document.getElementById("editAttDate").value = r.date || "";
  document.getElementById("editAttStatus").value = r.status || "Present";
  document.getElementById("editAttNote").value = r.note || "";

  openModal("editAttendanceModal");
};

window.updateAttendance = async function() {
  const id    = document.getElementById("editAttId").value;
  const empId = val("editAttEmpId");
  const emp   = allEmployees.find(e => e.id === empId);
  const data  = {
    employeeId:   empId,
    employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
    date:   val("editAttDate"),
    status: val("editAttStatus"),
    note:   val("editAttNote"),
  };
  try {
    await updateDoc(doc(db,"attendance",id), data);
    await logAudit("UPDATE", "attendance", `${data.employeeName} on ${data.date}`, data);
    closeModal("editAttendanceModal");
    toast("Attendance updated!","✅");
  } catch(e) { toast("Failed to update attendance.","❌"); }
};


window.markApplicationReviewed = async function(id) {
  try {
    await updateDoc(doc(db, "applications", id), {
      status: "Reviewed"
    });
    toast("Application marked as reviewed.", "✅");
  } catch (e) {
    toast("Failed to update application.", "❌");
  }
};


// ─────────────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────────────
async function logAudit(action, col, label, details = {}) {
  const user = auth.currentUser;
  try {
    await addDoc(collection(db, "auditLogs"), {
      action,
      collection: col,
      label,
      details,
      performedBy: user?.email || "unknown",
      performedAt: serverTimestamp(),
    });
  } catch(e) {
    console.warn("Audit log failed:", e);
  }
}

// ─────────────────────────────────────────────────────────
// AUDIT LOG SECTION
// ─────────────────────────────────────────────────────────
async function renderAuditSection() {
  set("mainContent", `<div class="page-header"><h2>Audit Log</h2><p>Loading...</p></div>`);

  const snap = await getDocs(query(collection(db,"auditLogs"), orderBy("performedAt","desc"), limit(100)));
  const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const actionColor = { CREATE: "#4ade80", UPDATE: "#facc15", DELETE: "#f87171" };
  const actionIcon  = { CREATE: "fa-plus-circle", UPDATE: "fa-edit", DELETE: "fa-trash" };

  const rows = logs.length
    ? logs.map(l => {
        const ts = l.performedAt?.toDate?.();
        const time = ts ? ts.toLocaleString("en-PH") : "—";
        const color = actionColor[l.action] || "#94a3b8";
        const icon  = actionIcon[l.action]  || "fa-circle";
        return `
          <tr>
            <td style="padding:13px 22px;">
              <span style="color:${color};font-weight:600;display:flex;align-items:center;gap:6px;">
                <i class="fas ${icon}" style="font-size:11px;"></i> ${l.action}
              </span>
            </td>
            <td style="padding:13px 22px;color:var(--text-secondary);text-transform:capitalize;">${l.collection || "—"}</td>
            <td style="padding:13px 22px;color:var(--text-primary);font-weight:500;">${l.label || "—"}</td>
            <td style="padding:13px 22px;color:var(--text-muted);font-size:12px;">${l.performedBy || "—"}</td>
            <td style="padding:13px 22px;color:var(--text-muted);font-size:12px;">${time}</td>
          </tr>`;
      }).join("")
    : `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">No audit logs yet.</td></tr>`;

  set("mainContent", `
    <div class="page-header">
      <h2>Audit Log</h2>
      <p>${logs.length} recent actions</p>
    </div>
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--border);">
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Action</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Module</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Record</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">By</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">When</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `);
}

// ─────────────────────────────────────────────────────────
// PAYROLL SECTION
// ─────────────────────────────────────────────────────────
function renderPayrollSection() {
  const total = allPayroll.reduce((s,r) => s+Number(r.amount||0),0);
  const rows  = allPayroll.length
    ? allPayroll.map(r => `
        <tr>
          <td style="padding:13px 22px;color:var(--text-primary);font-weight:500;">${r.employeeName||"Unknown"}</td>
          <td style="padding:13px 22px;color:var(--text-secondary)">${r.period||"—"}</td>
          <td style="padding:13px 22px;color:var(--brand-amber);font-weight:600;">₱${Number(r.amount||0).toLocaleString("en-PH",{minimumFractionDigits:2})}</td>
          <td style="padding:13px 22px;"><span class="${r.status==="Paid"?"badge-active":"badge-on-leave"}">${r.status||"Pending"}</span></td>
          <td style="padding:13px 22px;">
            <div style="display:flex;gap:8px;">
              <button onclick="openEditPayroll('${r.id}')" style="background:var(--accent-dim);color:var(--accent-light);border:none;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;">
                <i class="fas fa-edit"></i>
              </button>
              <button onclick="openDeleteModal('payroll','${r.id}','${r.employeeName} — ${r.period}')" style="background:var(--danger-bg);color:var(--danger);border:none;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>`).join("")
    : `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">No payroll records yet.</td></tr>`;

  set("mainContent", `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h2>Payroll</h2>
        <p>Total paid: <strong style="color:var(--brand-amber)">₱${total.toLocaleString("en-PH",{minimumFractionDigits:2})}</strong></p>
      </div>
      <button onclick="openModal('payrollModal')" style="background:linear-gradient(135deg,var(--brand-purple),var(--ring-violet));color:#fff;border:none;border-radius:12px;padding:11px 20px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;">
        <i class="fas fa-plus"></i> Run Payroll
      </button>
    </div>
    <div class="panel">
      <div class="panel-body" style="padding:0;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--border);">
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Employee</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Period</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Amount</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Status</th>
              <th style="padding:14px 22px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `);
}

window.openEditPayroll = function(id) {
  const r = allPayroll.find(x => x.id === id);
  if (!r) return;

  document.getElementById("editPayId").value = r.id;
  document.getElementById("editPayEmpId").value = r.employeeId || "";
  document.getElementById("editPayAmount").value = r.amount || "";
  document.getElementById("editPayPeriod").value = r.period || "";
  document.getElementById("editPayStatus").value = r.status || "Paid";

  openModal("editPayrollModal");
};

window.updatePayroll = async function() {
  const id     = document.getElementById("editPayId").value;
  const empId  = val("editPayEmpId");
  const amount = parseMoney(val("editPayAmount"));
  const emp    = allEmployees.find(e => e.id === empId);
  if (!empId || Number.isNaN(amount) || amount <= 0) { toast("Enter a valid payroll amount."); return; }
  const data = {
    employeeId:   empId,
    employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
    amount,
    period: val("editPayPeriod"),
    status: val("editPayStatus"),
  };
  try {
    await updateDoc(doc(db,"payroll",id), data);
    await logAudit("UPDATE", "payroll", `${data.employeeName} — ${data.period}`, data);
    closeModal("editPayrollModal");
    toast("Payroll updated!","✅");
  } catch(e) { console.error("updatePayroll error:",e); toast("Failed to update payroll."); }
};

function parseMoney(value) {
  return Number(String(value || "").replace(/,/g, "").trim());
}


window.formatCurrencyInput = function(input) {
  let value = input.value.replace(/,/g, "").replace(/[^\d.]/g, "");

  const parts = value.split(".");
  if (parts.length > 2) {
    value = parts[0] + "." + parts.slice(1).join("");
  }

  let [whole, decimal] = value.split(".");
  whole = whole ? Number(whole).toLocaleString("en-PH") : "";

  input.value = decimal !== undefined ? `${whole}.${decimal}` : whole;
};
// ─────────────────────────────────────────────────────────
// JOBS SECTION
// ─────────────────────────────────────────────────────────
function renderJobsSection() {
  const cards = allJobs.length
    ? allJobs.map(j => `
        <div class="panel" style="margin-bottom:0;">
          <div class="panel-body" style="display:flex;justify-content:space-between;align-items:center;gap:16px;">
            <div>
              <div style="font-family:'Sora',sans-serif;font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">${j.title||"Untitled"}</div>
              <div style="font-size:12.5px;color:var(--text-muted);display:flex;gap:12px;flex-wrap:wrap;">
                ${j.department ? `<span><i class="fas fa-sitemap" style="margin-right:4px;color:var(--brand-purple)"></i>${j.department}</span>` : ""}
                ${j.location   ? `<span><i class="fas fa-map-marker-alt" style="margin-right:4px;color:var(--brand-orange)"></i>${j.location}</span>` : ""}
                ${j.type       ? `<span><i class="fas fa-briefcase" style="margin-right:4px;color:var(--accent-light)"></i>${j.type}</span>` : ""}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="${j.status==="Open"?"badge-active":"badge-on-leave"}">${j.status||"Open"}</span>
              <button onclick="openDeleteModal('jobs','${j.id}','${j.title}')" style="background:var(--danger-bg);color:var(--danger);border:none;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>`).join("")
    : `<div class="panel"><div class="panel-body" style="text-align:center;color:var(--text-muted);padding:32px;">No job listings yet.</div></div>`;

  set("mainContent", `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h2>Job Listings</h2>
        <p>${allJobs.filter(j=>j.status==="Open").length} open · ${allJobs.length} total</p>
      </div>
      <button onclick="openModal('jobModal')" style="background:linear-gradient(135deg,var(--brand-purple),var(--ring-violet));color:#fff;border:none;border-radius:12px;padding:11px 20px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;">
        <i class="fas fa-plus"></i> Post Job
      </button>
    </div>
    <div style="display:grid;gap:14px;">${cards}</div>
  `);
}

// ─────────────────────────────────────────────────────────
// SETTINGS SECTION
// ─────────────────────────────────────────────────────────
function renderSettingsSection() {
  set("mainContent", `
    <div class="page-header"><h2>Settings</h2><p>Manage your account and preferences</p></div>
    <div class="panel" style="max-width:540px;">
      <div class="panel-header"><div class="panel-title"><i class="fas fa-user-circle"></i> Account</div></div>
      <div class="panel-body" style="display:flex;flex-direction:column;gap:14px;">
        <div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;">Name</div>
          <div style="color:var(--text-primary);font-weight:500;">${document.getElementById("sidebarUserName").textContent}</div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;">Email</div>
          <div style="color:var(--text-primary);font-weight:500;">${document.getElementById("sidebarUserEmail").textContent}</div>
        </div>
        <hr style="border-color:var(--border);">
        <button onclick="handleLogout()" style="background:var(--danger-bg);color:var(--danger);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:11px 20px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;width:fit-content;">
          <i class="fas fa-sign-out-alt"></i> Sign Out
        </button>
      </div>
    </div>
  `);
}

window.updateEmployee = async function() {
  const id = document.getElementById("editEmpId").value;
  const data = {
    firstName:  val("editEmpFirstName"),
    lastName:   val("editEmpLastName"),
    email:      val("editEmpEmail"),
    department: val("editEmpDepartment"),
    position:   val("editEmpPosition"),
    status:     val("editEmpStatus"),
  };
  try {
    await updateDoc(doc(db,"employees",id), data);
    await logAudit("UPDATE", "employees", `${data.firstName} ${data.lastName}`, data);
    closeModal("editEmployeeModal");
    toast("Employee updated!","✅");
  } catch(e) { toast("Failed to update.","❌"); }
};



// ─────────────────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────────────────
window.handleSearch = function(val) {
  if (currentSection === "employees") renderEmployeesSection();
};

// ─────────────────────────────────────────────────────────
// MODALS
// ─────────────────────────────────────────────────────────
window.openModal  = id => document.getElementById(id).classList.add("show");
window.closeModal = id => document.getElementById(id).classList.remove("show");

// Close on backdrop click
document.querySelectorAll(".modal-backdrop-custom").forEach(m => {
  m.addEventListener("click", e => { if (e.target === m) m.classList.remove("show"); });
});

// ─────────────────────────────────────────────────────────
// EMPLOYEE CRUD
// ─────────────────────────────────────────────────────────
window.saveEmployee = async function() {
  const firstName  = val("empFirstName");
  const lastName   = val("empLastName");
  const email      = val("empEmail");
  const department = val("empDepartment");
  const position   = val("empPosition");
  const status     = val("empStatus");
  if (!firstName || !lastName || !email) { toast("Please fill all required fields.","⚠️"); return; }
  try {
    await addDoc(collection(db,"employees"), { firstName, lastName, email, department, position, status, createdAt: serverTimestamp() });
    await logAudit("CREATE", "employees", `${firstName} ${lastName}`, { firstName, lastName, email, department, position, status });
    closeModal("employeeModal");
    clearFields(["empFirstName","empLastName","empEmail","empDepartment","empPosition"]);
    toast("Employee added!","");
  } catch(e) { toast("Failed to add employee.",""); }
};

window.openEditEmployee = function(id) {
  const e = allEmployees.find(x => x.id === id);
  if (!e) return;
  document.getElementById("editEmpId").value          = id;
  document.getElementById("editEmpFirstName").value   = e.firstName  || "";
  document.getElementById("editEmpLastName").value    = e.lastName   || "";
  document.getElementById("editEmpEmail").value       = e.email      || "";
  document.getElementById("editEmpDepartment").value  = e.department || "";
  document.getElementById("editEmpPosition").value    = e.position   || "";
  document.getElementById("editEmpStatus").value      = e.status     || "Active";
  openModal("editEmployeeModal");
};



// ─────────────────────────────────────────────────────────
// ATTENDANCE CRUD
// ─────────────────────────────────────────────────────────
window.saveAttendance = async function() {
  const empId = val("attEmpId");
  const date  = val("attDate");
  if (!empId || !date) { toast("Select employee and date.","⚠️"); return; }
  const emp  = allEmployees.find(e => e.id === empId);
  const data = {
    employeeId:   empId,
    employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
    date,
    status: val("attStatus"),
    note:   val("attNote"),
  };
  try {
    await addDoc(collection(db,"attendance"), { ...data, createdAt: serverTimestamp() });
    await logAudit("CREATE", "attendance", `${data.employeeName} on ${date}`, data);
    closeModal("attendanceModal");
    clearFields(["attNote"]);
    toast("Attendance logged!","✅");
  } catch(e) { toast("Failed to log attendance.","❌"); }
};

// ─────────────────────────────────────────────────────────
// PAYROLL CRUD
// ─────────────────────────────────────────────────────────
window.savePayroll = async function() {
  const empId  = val("payEmpId");
  const amount = val("payAmount").replace(/,/g,"");
  const period = val("payPeriod");
  if (!empId || !amount || !period) { toast("Fill all payroll fields.","⚠️"); return; }
  const emp  = allEmployees.find(e => e.id === empId);
  const data = {
    employeeId:   empId,
    employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
    amount: Number(amount),
    period,
    status: val("payStatus"),
  };
  try {
    await addDoc(collection(db,"payroll"), { ...data, createdAt: serverTimestamp() });
    await logAudit("CREATE", "payroll", `${data.employeeName} — ${period}`, data);
    closeModal("payrollModal");
    clearFields(["payAmount","payPeriod"]);
    toast("Payroll saved!","✅");
  } catch(e) { toast("Failed to save payroll.","❌"); console.error(e); }
};

// ─────────────────────────────────────────────────────────
// JOBS CRUD
// ─────────────────────────────────────────────────────────
window.saveJob = async function() {
  const title = val("jobTitle");
  if (!title) { toast("Job title is required.","⚠️"); return; }
  const data = {
    title,
    department: val("jobDepartment"),
    location:   val("jobLocation"),
    type:       val("jobType"),
    status:     val("jobStatus"),
  };
  try {
    await addDoc(collection(db,"jobs"), { ...data, createdAt: serverTimestamp() });
    await logAudit("CREATE", "jobs", title, data);
    closeModal("jobModal");
    clearFields(["jobTitle","jobDepartment","jobLocation"]);
    toast("Job posted!","✅");
  } catch(e) { toast("Failed to post job.","❌"); }
};
// ─────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────
window.openDeleteModal = function(col, id, label) {
  document.getElementById("deleteMessage").textContent = `Are you sure you want to delete "${label}"? This cannot be undone.`;
  pendingDeleteFn = async () => {
    await deleteDoc(doc(db, col, id));
    await logAudit("DELETE", col, label, { deletedId: id });
    toast("Deleted successfully.","🗑️");
  };
  openModal("deleteModal");
};

window.confirmDelete = async function() {
  console.log("auth.currentUser:", auth.currentUser);
  if (!pendingDeleteFn) return;
  try { 
    await pendingDeleteFn(); 
    closeModal("deleteModal");  // ← is this line here?
  }
  catch(e) { 
    console.error("Delete error:", e);
    toast("Delete failed.","❌"); 
  }
  pendingDeleteFn = null;
};

// ─────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────
window.handleLogout = async function() {
  activeUnsubs.forEach(u => u());
  await signOut(auth);
  window.location.href = "login.html";
};

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────
function populateEmployeeSelects() {
  ["attEmpId","payEmpId","editAttEmpId","editPayEmpId"].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">Select Employee…</option>` +
      allEmployees.map(e => `<option value="${e.id}" ${e.id===current?"selected":""}>${e.firstName} ${e.lastName}</option>`).join("");
  });
}

function statusBadge(status) {
  const map = {
    "Present":  "badge-present",
    "Late":     "badge-late",
    "Half Day": "badge-half",
    "Absent":   "badge-absent",
    "On Leave": "badge-leave",
  };
  return `<span class="badge-status ${map[status]||"badge-present"}">${status||"Present"}</span>`;
}

function avatarColor(name) {
  const colors = [
    "linear-gradient(135deg,#7c3aed,#c084fc)",
    "linear-gradient(135deg,#ea580c,#f97316)",
    "linear-gradient(135deg,#0891b2,#06b6d4)",
    "linear-gradient(135deg,#16a34a,#22c55e)",
    "linear-gradient(135deg,#9333ea,#e879f9)",
    "linear-gradient(135deg,#b45309,#fbbf24)",
  ];
  const i = (name||"A").charCodeAt(0) % colors.length;
  return colors[i];
}

function initials(first, last) {
  return `${(first||"?")[0]}${(last||"?")[0]}`.toUpperCase();
}

function set(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function clearFields(ids) {
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
}

function updateBadge(id, count) {
  const el = document.getElementById(id);
  if (el) el.textContent = count;
}

function toast(msg, icon="ℹ️") {
  const t = document.getElementById("toast");
  t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  t.style.display = "flex";
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.display = "none"; }, 3000);
}

// Set today's date default for attendance
document.getElementById("attDate").value = new Date().toISOString().split("T")[0];

