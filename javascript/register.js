

import {
  registerWithEmail,
  onAuthChange,
  friendlyError,
} from "firebase.js";


// ── Redirect if already logged in ───────────────────────
onAuthChange(user => {
  if (user) {
    window.location.href = "login.html";
  }
});


// ── Alert Helpers ───────────────────────────────────────
function showError(message) {
  document.getElementById("registerAlertMsg").textContent = message;

  document
    .getElementById("registerAlert")
    .classList.add("show");

  document
    .getElementById("registerSuccess")
    .classList.remove("show");
}

function showSuccess(message) {
  document.getElementById("registerSuccessMsg").textContent = message;

  document
    .getElementById("registerSuccess")
    .classList.add("show");

  document
    .getElementById("registerAlert")
    .classList.remove("show");
}

function clearAlerts() {
  document
    .getElementById("registerAlert")
    .classList.remove("show");

  document
    .getElementById("registerSuccess")
    .classList.remove("show");
}


// ── Loading State ───────────────────────────────────────
function setLoading(loading) {

  const btn = document.getElementById("registerBtn");

  btn.disabled = loading;

  btn.innerHTML = loading
    ? '<span class="spinner"></span> Creating Account...'
    : 'Create Account &nbsp;<i class="fas fa-user-plus fa-sm"></i>';
}


// ── Register Function ───────────────────────────────────
window.handleRegister = async function () {

  const fullname = document
    .getElementById("fullname")
    .value
    .trim();

  const email = document
    .getElementById("email")
    .value
    .trim();

  const password = document
    .getElementById("password")
    .value;

  const confirmPassword = document
    .getElementById("confirmPassword")
    .value;

  const terms = document
    .getElementById("terms")
    .checked;

  clearAlerts();

  // Validation
  if (!fullname || !email || !password || !confirmPassword) {
    showError("Please fill in all fields.");
    return;
  }

  if (password !== confirmPassword) {
    showError("Passwords do not match.");
    return;
  }

  if (password.length < 6) {
    showError("Password must be at least 6 characters.");
    return;
  }

  if (!terms) {
    showError("Please agree to the Terms & Conditions.");
    return;
  }

  // Register
  setLoading(true);

  try {

    await registerWithEmail(
      fullname,
      email,
      password
    );

    showSuccess("Account created successfully!");

    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 1200);

  } catch (error) {

    showError(
      friendlyError(error.code)
    );

    setLoading(false);
  }
};


// ── Toggle Password ─────────────────────────────────────
window.togglePass = function () {

  const password =
    document.getElementById("password");

  const icon =
    document.getElementById("eyeIcon");

  if (password.type === "password") {

    password.type = "text";
    icon.className = "fas fa-eye-slash";

  } else {

    password.type = "password";
    icon.className = "fas fa-eye";
  }
};


// ── Toggle Confirm Password ─────────────────────────────
window.toggleConfirmPass = function () {

  const password =
    document.getElementById("confirmPassword");

  const icon =
    document.getElementById("confirmEyeIcon");

  if (password.type === "password") {

    password.type = "text";
    icon.className = "fas fa-eye-slash";

  } else {

    password.type = "password";
    icon.className = "fas fa-eye";
  }
};


// ── Enter Key Support ───────────────────────────────────
document.addEventListener("keydown", e => {

  if (e.key === "Enter") {
    window.handleRegister();
  }
});
