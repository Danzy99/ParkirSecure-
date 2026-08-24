/**
 * PARKIR MAULID PRO - ADMIN CONTROL PANEL LOGIC
 * Architecture: Static SPA with IndexedDB Data Persistence
 * File Limit Constraint: 3 Files Target (index.html, style.css, script.js)
 */

/* ==========================================
 * 1. CONFIG & CREDENTIALS
 * ========================================== */
const ADMIN_ACCOUNT = {
    username: "admin",
    password: "admin123"
};

const DB_NAME = "ParkirMaulidDB";
const DB_VERSION = 1;
const TOTAL_CAPACITY = 200;

let db = null;
let activeExitVehicle = null;
let currentHistoryFilter = "ALL";
let tempCapturedPhotoMasuk = null;
let tempCapturedPhotoKeluar = null;

/* ==========================================
 * 2. SECURITY & UTILS
 * ========================================== */
function sanitize(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    const toastIcon = document.getElementById('toast-icon');

    if (!toast || !toastMsg || !toastIcon) return;

    toastMsg.innerText = message;
    if (isError) {
        toast.className = toast.className.replace('border-emerald-500/50', 'border-red-500/50');
        toastIcon.className = "fa-solid fa-circle-xmark text-red-400 text-lg";
    } else {
        toast.className = toast.className.replace('border-red-500/50', 'border-emerald-500/50');
        toastIcon.className = "fa-solid fa-circle-check text-emerald-400 text-lg";
    }

    toast.classList.remove('-translate-y-20', 'opacity-0', 'pointer-events-none');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('-translate-y-20', 'opacity-0', 'pointer-events-none');
    }, 3000);
}

function openModal(modalId) {
    const target = document.getElementById(modalId);
    if (target) target.classList.remove('hidden');
}

function closeModal(modalId) {
    const target = document.getElementById(modalId);
    if (target) target.classList.add('hidden');
}

function togglePasswordVisibility() {
    const pwd = document.getElementById('login-password');
    const icon = document.getElementById('eye-icon');
    if (!pwd || !icon) return;
    if (pwd.type === 'password') {
        pwd.type = 'text';
        icon.className = 'fa-solid fa-eye-slash';
    } else {
        pwd.type = 'password';
        icon.className = 'fa-solid fa-eye';
    }
}

/* ==========================================
 * 3. INDEXEDDB PERSISTENCE (ParkirMaulidDB)
 * ========================================== */
function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains("vehicles")) {
                const vehicleStore = database.createObjectStore("vehicles", { keyPath: "id" });
                vehicleStore.createIndex("plat", "plat", { unique: false });
                vehicleStore.createIndex("status", "status", { unique: false });
            }
            if (!database.objectStoreNames.contains("activities")) {
                database.createObjectStore("activities", { keyPath: "id", autoIncrement: true });
            }
        };

        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };

        request.onerror = (e) => {
            console.error("IndexedDB error:", e.target.error);
            reject(e.target.error);
        };
    });
}

function addVehicle(vehicleData) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["vehicles"], "readwrite");
        const store = tx.objectStore("vehicles");
        const req = store.add(vehicleData);

        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
    });
}

function updateVehicle(vehicleData) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["vehicles"], "readwrite");
        const store = tx.objectStore("vehicles");
        const req = store.put(vehicleData);

        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
    });
}

function getAllVehicles() {
    return new Promise((resolve, reject) => {
        if (!db) return resolve([]);
        const tx = db.transaction(["vehicles"], "readonly");
        const store = tx.objectStore("vehicles");
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => reject(e.target.error);
    });
}

function getVehicleByPlate(plat) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve([]);
        const tx = db.transaction(["vehicles"], "readonly");
        const store = tx.objectStore("vehicles");
        const index = store.index("plat");
        const req = index.getAll(plat);

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => reject(e.target.error);
    });
}

function saveActivity(action, details) {
    if (!db) return;
    const session = getSession();
    const officer = session ? session.username : "System";
    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');

    const activity = {
        action,
        details,
        officer,
        time: timeStr,
        timestamp: now.toISOString()
    };

    const tx = db.transaction(["activities"], "readwrite");
    const store = tx.objectStore("activities");
    store.add(activity);
}

/* ==========================================
 * 4. AUTHENTICATION & SESSION MANAGEMENT
 * ========================================== */
function checkSession() {
    const sessionData = sessionStorage.getItem("adminSession");
    const loginScreen = document.getElementById('login-screen');
    const appHeader = document.getElementById('app-header');
    const appMain = document.getElementById('app-main');
    const appNav = document.getElementById('app-nav');

    if (sessionData) {
        const session = JSON.parse(sessionData);
        const officerEl = document.getElementById('current-officer');
        if (officerEl) officerEl.textContent = sanitize(session.username);

        if (loginScreen) loginScreen.classList.add('hidden');
        if (appHeader) appHeader.classList.remove('hidden');
        if (appMain) appMain.classList.remove('hidden');
        if (appNav) appNav.classList.remove('hidden');
        renderDashboard();
    } else {
        if (loginScreen) loginScreen.classList.remove('hidden');
        if (appHeader) appHeader.classList.add('hidden');
        if (appMain) appMain.classList.add('hidden');
        if (appNav) appNav.classList.add('hidden');
    }
}

function getSession() {
    const sessionData = sessionStorage.getItem("adminSession");
    return sessionData ? JSON.parse(sessionData) : null;
}

function loginAdmin(e) {
    if (e) e.preventDefault();
    const user = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value.trim();
    const errorEl = document.getElementById('login-error');

    if (errorEl) errorEl.classList.add('hidden');

    if (user === ADMIN_ACCOUNT.username && pass === ADMIN_ACCOUNT.password) {
        const sessionPayload = {
            username: user,
            loginTime: new Date().toISOString()
        };
        sessionStorage.setItem("adminSession", JSON.stringify(sessionPayload));
        saveActivity("login", "Admin login ke sistem");
        showToast("Login Berhasil! Selamat Bertugas.");
        checkSession();
    } else {
        if (errorEl) {
            errorEl.textContent = "Username atau password salah!";
            errorEl.classList.remove('hidden');
        } else {
            showToast("Username atau password salah!", true);
        }
    }
}

function logoutAdmin() {
    saveActivity("logout", "Admin logout dari sistem");
    sessionStorage.removeItem("adminSession");
    showToast("Anda telah logout.");
    checkSession();
}

/* ==========================================
 * 5. TAB SWITCHING LOGIC
 * ========================================== */
function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`view-${tabId}`);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(el => {
        el.classList.remove('text-emerald-400');
        el.classList.add('text-slate-400');
    });

    const activeNav = document.getElementById(`nav-${tabId}`);
    if (activeNav) {
        activeNav.classList.remove('text-slate-400');
        activeNav.classList.add('text-emerald-400');
    }

    if (tabId === 'dashboard') renderDashboard();
    if (tabId === 'cari') renderHistory();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ==========================================
 * 6. CAMERA & PHOTO HANDLING (Base64 Persistent)
 * ========================================== */
function previewPhoto(event, containerId) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Img = e.target.result;
        if (containerId === 'preview-masuk-container') {
            tempCapturedPhotoMasuk = base64Img;
        } else if (containerId === 'preview-keluar-container') {
            tempCapturedPhotoKeluar = base64Img;
        }

        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="relative w-full h-32 rounded-xl overflow-hidden border border-emerald-500/50">
                    <img src="${base64Img}" class="w-full h-full object-cover">
                    <div class="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                        <span class="text-xs bg-emerald-500 text-slate-950 px-2 py-1 rounded-lg font-bold">Foto Siap Digunakan</span>
                    </div>
                </div>
            `;
        }
    };
    reader.readAsDataURL(file);
}

/* ==========================================
 * 7. MOTOR MASUK & ANTI DUPLIKASI
 * ========================================== */
async function handleMotorMasuk(e) {
    if (e) e.preventDefault();

    const plat = document.getElementById('in-plat').value.toUpperCase().trim();
    const merek = document.getElementById('in-merek').value.trim();
    const warna = document.getElementById('in-warna').value.trim();
    const lokasi = document.getElementById('in-lokasi').value.toUpperCase().trim();
    const ciri = document.getElementById('in-ciri').value.trim();

    if (!tempCapturedPhotoMasuk) {
        showToast("📸 Wajib ambil foto motor terlebih dahulu!", true);
        return;
    }

    const existingList = await getVehicleByPlate(plat);
    const activeDuplicate = existingList.find(v => v.status === "MASIH PARKIR");

    if (activeDuplicate) {
        saveActivity("duplikasi", `Upaya masuk plat ganda ${plat}`);
        const dupDetails = document.getElementById('dup-details');
        if (dupDetails) {
            dupDetails.innerHTML = `
                <p><b>ID Transaksi:</b> ${sanitize(activeDuplicate.id)}</p>
                <p><b>Plat:</b> ${sanitize(activeDuplicate.plat)}</p>
                <p><b>Merek:</b> ${sanitize(activeDuplicate.merek)} (${sanitize(activeDuplicate.warna)})</p>
                <p><b>Lokasi:</b> ${sanitize(activeDuplicate.lokasi)}</p>
                <p><b>Masuk:</b> ${sanitize(activeDuplicate.tanggalMasuk)} • ${sanitize(activeDuplicate.waktuMasuk)}</p>
                <p><b>Petugas:</b> ${sanitize(activeDuplicate.petugasMasuk)}</p>
            `;
        }
        openModal('modal-duplicate');
        return;
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const timeStr = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');
    const displayDate = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    const allVehicles = await getAllVehicles();
    const nextSeq = String(allVehicles.length + 1).padStart(4, '0');
    const transactionId = `PM-${dateStr}-${nextSeq}`;

    const session = getSession();

    const newVehicle = {
        id: transactionId,
        plat: plat,
        merek: merek,
        warna: warna,
        lokasi: lokasi,
        ciri: ciri || "-",
        fotoMasuk: tempCapturedPhotoMasuk,
        fotoKeluar: null,
        tanggalMasuk: displayDate,
        waktuMasuk: timeStr,
        tanggalKeluar: null,
        waktuKeluar: null,
        petugasMasuk: session ? session.username : "Admin",
        petugasKeluar: null,
        status: "MASIH PARKIR",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    };

    await addVehicle(newVehicle);
    saveActivity("motor_masuk", `Catat motor masuk ${plat} (${lokasi})`);
    showToast(`✅ Motor ${plat} Berhasil Dicatat!`);

    document.getElementById('form-masuk').reset();
    tempCapturedPhotoMasuk = null;
    const previewContainer = document.getElementById('preview-masuk-container');
    if (previewContainer) {
        previewContainer.innerHTML = `
            <i class="fa-solid fa-camera text-3xl text-emerald-400"></i>
            <p class="text-xs font-semibold text-slate-300">Ketuk untuk Ambil Foto Motor</p>
            <p class="text-[10px] text-slate-500">Foto wajib diambil dari kamera/file</p>
        `;
    }

    switchTab('dashboard');
}

/* ==========================================
 * 8. SEARCH & MOTOR KELUAR VERIFICATION
 * ========================================== */
async function searchVehicle() {
    const inputPlat = document.getElementById('search-out-plat');
    if (!inputPlat) return;
    const query = inputPlat.value.toUpperCase().trim();
    if (!query) {
        showToast("Masukkan nomor plat kendaraan!", true);
        return;
    }

    const vehicles = await getVehicleByPlate(query);
    const card = document.getElementById('verification-card');

    if (vehicles.length === 0) {
        if (card) card.classList.add('hidden');
        showToast(`🔴 Plat ${query} tidak ditemukan!`, true);
        saveActivity("pencarian", `Pencarian gagal plat ${query}`);
        return;
    }

    let vehicle = vehicles.find(v => v.status === "MASIH PARKIR") || vehicles[vehicles.length - 1];
    activeExitVehicle = vehicle;
    saveActivity("pencarian", `Mencari kendaraan ${query}`);

    document.getElementById('v-plat').textContent = sanitize(vehicle.plat);
    document.getElementById('v-lokasi').textContent = sanitize(vehicle.lokasi);
    document.getElementById('v-merek').textContent = sanitize(vehicle.merek);
    document.getElementById('v-warna-ciri').textContent = `${sanitize(vehicle.warna)} (${sanitize(vehicle.ciri)})`;
    document.getElementById('v-id').textContent = sanitize(vehicle.id);
    document.getElementById('v-masuk').textContent = `${sanitize(vehicle.tanggalMasuk)} • ${sanitize(vehicle.waktuMasuk)}`;
    document.getElementById('v-petugas-masuk').textContent = sanitize(vehicle.petugasMasuk);
    document.getElementById('v-foto-masuk').src = vehicle.fotoMasuk;

    const badge = document.getElementById('v-status-badge');
    badge.textContent = vehicle.status;

    document.querySelectorAll('.verif-check').forEach(cb => cb.checked = false);
    validateChecklist();
    tempCapturedPhotoKeluar = null;
    const previewKeluar = document.getElementById('preview-keluar-container');
    if (previewKeluar) {
        previewKeluar.innerHTML = `
            <i class="fa-solid fa-camera text-xl text-blue-400"></i>
            <p class="text-[11px] text-slate-300 font-medium">Ketuk untuk Ambil Foto Keluar</p>
        `;
    }

    if (vehicle.status === "MASIH PARKIR") {
        badge.className = "text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400";
        document.getElementById('section-foto-keluar').classList.remove('hidden');
        document.getElementById('section-checklist').classList.remove('hidden');
        document.getElementById('section-exit-button').classList.remove('hidden');
        document.getElementById('section-already-exit').classList.add('hidden');
    } else {
        badge.className = "text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400";
        document.getElementById('section-foto-keluar').classList.add('hidden');
        document.getElementById('section-checklist').classList.add('hidden');
        document.getElementById('section-exit-button').classList.add('hidden');
        document.getElementById('section-already-exit').classList.remove('hidden');

        document.getElementById('v-keluar-waktu').textContent = `${sanitize(vehicle.tanggalKeluar)} • ${sanitize(vehicle.waktuKeluar)}`;
        document.getElementById('v-keluar-petugas').textContent = sanitize(vehicle.petugasKeluar);

        if (vehicle.fotoKeluar) {
            document.getElementById('v-foto-keluar').src = vehicle.fotoKeluar;
            document.getElementById('v-foto-keluar-container').classList.remove('hidden');
        } else {
            document.getElementById('v-foto-keluar-container').classList.add('hidden');
        }
    }

    if (card) card.classList.remove('hidden');
}

function validateChecklist() {
    const checkboxes = document.querySelectorAll('.verif-check');
    let allChecked = true;
    checkboxes.forEach(cb => {
        if (!cb.checked) allChecked = false;
    });

    const btn = document.getElementById('btn-allow-exit');
    if (!btn) return;
    if (allChecked) {
        btn.disabled = false;
        btn.className = "w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer";
    } else {
        btn.disabled = true;
        btn.className = "w-full py-3.5 bg-slate-800 text-slate-500 font-extrabold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-not-allowed";
    }
}

function confirmProcessExit() {
    if (!activeExitVehicle) return;
    const confirmText = document.getElementById('modal-confirm-exit-text');
    if (confirmText) confirmText.textContent = `Yakin kendaraan ${sanitize(activeExitVehicle.plat)} diizinkan keluar?`;
    openModal('modal-confirm-exit');
}

async function executeVehicleExit() {
    closeModal('modal-confirm-exit');
    if (!activeExitVehicle) return;

    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');
    const displayDate = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const session = getSession();

    activeExitVehicle.status = "SUDAH KELUAR";
    activeExitVehicle.tanggalKeluar = displayDate;
    activeExitVehicle.waktuKeluar = timeStr;
    activeExitVehicle.petugasKeluar = session ? session.username : "Admin";
    if (tempCapturedPhotoKeluar) {
        activeExitVehicle.fotoKeluar = tempCapturedPhotoKeluar;
    }
    activeExitVehicle.updatedAt = now.toISOString();

    await updateVehicle(activeExitVehicle);
    saveActivity("motor_keluar", `Motor ${activeExitVehicle.plat} berhasil keluar`);
    showToast(`✅ Motor ${activeExitVehicle.plat} diizinkan keluar.`);
    
    searchVehicle();
}

/* ==========================================
 * 9. DASHBOARD & HISTORY RENDERING
 * ========================================== */
async function renderDashboard() {
    const vehicles = await getAllVehicles();
    const activePark = vehicles.filter(v => v.status === "MASIH PARKIR").length;
    
    const parkEl = document.getElementById('stat-active');
    if (parkEl) parkEl.textContent = activePark;
    
    const capEl = document.getElementById('stat-capacity');
    if (capEl) capEl.textContent = `${activePark}/${TOTAL_CAPACITY}`;
}

async function renderHistory() {
    const vehicles = await getAllVehicles();
    const container = document.getElementById('history-list');
    if (!container) return;

    if (vehicles.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-500 py-8 text-xs">Belum ada riwayat data parkir.</div>`;
        return;
    }

    container.innerHTML = vehicles.map(v => `
        <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
            <div>
                <p class="font-bold text-white">${sanitize(v.plat)} <span class="text-[10px] text-slate-400">(${sanitize(v.lokasi)})</span></p>
                <p class="text-[10px] text-slate-400">${sanitize(v.tanggalMasuk)} • ${sanitize(v.waktuMasuk)}</p>
            </div>
            <span class="px-2 py-1 rounded text-[10px] font-bold ${v.status === 'MASIH PARKIR' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}">
                ${v.status}
            </span>
        </div>
    `).join('');
}

/* ==========================================
 * 10. INITIALIZATION & BINDING
 * ========================================== */
document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initDatabase();
    } catch (err) {
        console.error("Gagal inisialisasi IndexedDB:", err);
    }

    // Direct Form Login Handler
    const loginForm = document.getElementById('login-form') || document.querySelector('form');
    if (loginForm) {
        loginForm.addEventListener('submit', loginAdmin);
    }

    // Direct Form Masuk Handler
    const formMasuk = document.getElementById('form-masuk');
    if (formMasuk) {
        formMasuk.addEventListener('submit', handleMotorMasuk);
    }

    checkSession();
});
