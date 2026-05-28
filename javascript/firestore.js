// ─────────────────────────────────────────────────────────
// firestore.js
// EMS Firestore Database Logic
// ─────────────────────────────────────────────────────────

import { db } from "./firebase.js";

import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";


// ─────────────────────────────────────────────────────────
// EMPLOYEES
// ─────────────────────────────────────────────────────────

export async function addEmployee(employee) {

  return addDoc(
    collection(db, "employees"),
    {
      ...employee,
      createdAt: serverTimestamp(),
    }
  );
}


export function subscribeEmployees(callback, limitCount = 10) {

  const q = query(
    collection(db, "employees"),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );

  return onSnapshot(q, snapshot => {

    const employees = [];

    snapshot.forEach(doc => {
      employees.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    callback(employees);
  });
}


// ─────────────────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────────────────

export async function addAttendance(record) {

  return addDoc(
    collection(db, "attendance"),
    {
      ...record,
      createdAt: serverTimestamp(),
    }
  );
}


export function subscribeRecentAttendance(
  callback,
  limitCount = 10
) {

  const q = query(
    collection(db, "attendance"),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );

  return onSnapshot(q, snapshot => {

    const records = [];

    snapshot.forEach(doc => {
      records.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    callback(records);
  });
}


// ─────────────────────────────────────────────────────────
// JOB LISTINGS
// ─────────────────────────────────────────────────────────

export async function addJob(job) {

  return addDoc(
    collection(db, "jobs"),
    {
      ...job,
      createdAt: serverTimestamp(),
    }
  );
}


// ─────────────────────────────────────────────────────────
// DASHBOARD STATS
// ─────────────────────────────────────────────────────────

export function subscribeDashboardStats(callback) {

  const unsubEmployees = onSnapshot(
    collection(db, "employees"),
    async empSnap => {

      const totalEmployees = empSnap.size;

      // Attendance today
      const attSnap =
        await getDocs(collection(db, "attendance"));

      const todayAttendance = attSnap.size;

      // Payroll total
      const payrollSnap =
        await getDocs(collection(db, "payroll"));

      let totalPayroll = 0;

      payrollSnap.forEach(doc => {

        const data = doc.data();

        totalPayroll += Number(data.amount || 0);
      });

      // Jobs
      const jobsSnap =
        await getDocs(collection(db, "jobs"));

      const openJobs = jobsSnap.size;

      callback({
        totalEmployees,
        todayAttendance,
        totalPayroll,
        openJobs,
      });
    }
  );

  return unsubEmployees;
}


// ─────────────────────────────────────────────────────────
// DEPARTMENT BREAKDOWN
// ─────────────────────────────────────────────────────────

export function subscribeDepartmentBreakdown(callback) {

  return onSnapshot(
    collection(db, "employees"),
    snapshot => {

      const map = {};

      snapshot.forEach(doc => {

        const data = doc.data();

        const dept =
          data.department || "Unassigned";

        map[dept] = (map[dept] || 0) + 1;
      });

      const result =
        Object.entries(map).map(([name, count]) => ({
          name,
          count,
        }));

      callback(result);
    }
  );
}