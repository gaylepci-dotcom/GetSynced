
 import {
    loginWithEmail,
    loginWithGoogle,
    resetPassword,
    onAuthChange,
    friendlyError,
  } from "./firebase.js";
 
  // ── If already logged in, skip to dashboard ──
  onAuthChange(user => {
    if (user) window.location.href = "index.html";
  });
 
  // ── UI helpers ──────────────────────────────────────────
  function showError(msg) {
    document.getElementById("loginAlertMsg").textContent = msg;
    document.getElementById("loginAlert").classList.add("show");
    document.getElementById("loginSuccess").classList.remove("show");
  }
  function showSuccess(msg) {
    document.getElementById("loginSuccessMsg").textContent = msg;
    document.getElementById("loginSuccess").classList.add("show");
    document.getElementById("loginAlert").classList.remove("show");
  }
  function clearAlerts() {
    document.getElementById("loginAlert").classList.remove("show");
    document.getElementById("loginSuccess").classList.remove("show");
  }
  function setLoading(loading) {
    const btn = document.getElementById("loginBtn");
    btn.disabled = loading;
    btn.innerHTML = loading
      ? '<span class="spinner"></span> Signing in…'
      : 'Sign In &nbsp;<i class="fas fa-arrow-right fa-sm"></i>';
  }
 
  // ── Email / Password Login ───────────────────────────────
  window.handleLogin = async function () {
    const email    = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const remember = document.getElementById("remember").checked;
 
    clearAlerts();
    if (!email || !password) { showError("Please fill in all fields."); return; }
 
    setLoading(true);
    try {
      await loginWithEmail(email, password, remember);
      showSuccess("Signed in! Redirecting…");
      setTimeout(() => (window.location.href = "index.html"), 800);
    } catch (err) {
      showError(friendlyError(err.code));
      setLoading(false);
    }
  };
 
 
  // ── Password Reset ──────────────────────────────────────
  window.handlePasswordReset = async function () {
    const email = document.getElementById("resetEmail").value.trim();
    const btn   = document.getElementById("resetBtn");
    if (!email) { alert("Please enter your email."); return; }
 
    btn.textContent = "Sending…";
    btn.disabled    = true;
    try {
      await resetPassword(email);
      closeResetModal();
      showSuccess(`Reset link sent to ${email}. Check your inbox.`);
    } catch (err) {
      closeResetModal();
      showError(friendlyError(err.code));
    } finally {
      btn.textContent = "Send Link";
      btn.disabled    = false;
    }
  };
 
  // ── Non-async UI (exposed to inline onclick) ─────────────
  window.togglePass = function () {
    const pw   = document.getElementById("password");
    const icon = document.getElementById("eyeIcon");
    if (pw.type === "password") { pw.type = "text";     icon.className = "fas fa-eye-slash"; }
    else                        { pw.type = "password"; icon.className = "fas fa-eye"; }
  };
  window.openResetModal  = () => {
    document.getElementById("resetModal").classList.add("show");
    document.getElementById("resetEmail").value = document.getElementById("email").value;
  };
  window.closeResetModal = () => document.getElementById("resetModal").classList.remove("show");
 
  // ── Keyboard & backdrop ──────────────────────────────────
  document.addEventListener("keydown", e => { if (e.key === "Enter") window.handleLogin(); });
  document.getElementById("resetModal").addEventListener("click", function (e) {
    if (e.target === this) window.closeResetModal();
  });
