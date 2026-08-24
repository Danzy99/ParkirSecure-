/**
 * PARKIR MAULID PRO - ADMIN CONTROL PANEL LOGIC
 * Architecture: Static SPA with IndexedDB Data Persistence
 * File Limit Constraint: 3 Files Target (index.html, style.css, script.js)
 */

/* ==========================================
 * 1. CONFIG & CREDENTIALS
 * ========================================== */
// CATATAN KEAMANAN: Credential ini disajikan khusus untuk demo frontend static SPA pada Vercel.
// Untuk skala produksi sesungguhnya, authentication dapat diganti menggunakan Supabase, Firebase, atau API backend.
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
 * CATATAN APLIKASI: IndexedDB membuat data persistent pada browser & perangkat HP ini.
 * Data tidak tersinkronisasi antar perangkat tanpa export/import JSON.
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
        const tx = db.transaction(["vehicles"], "readonly");
        const store = tx.objectStore("vehicles");
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => reject(e.target.error);
    });
}

function getVehicleByPlate(plat) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["vehicles"], "readonly");
        const store = tx.objectStore("vehicles");
        const index = store.index("plat");
        const req = index.getAll(plat);

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => reject(e.target.error);
    });
}

function getVehicleById(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["vehicles"], "readonly");
        const store = tx.objectStore("vehicles");
        const req = store.get(id);

        req.onsuccess = () => resolve(req.result);
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

function getActivities() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["activities"], "readonly");
        const store = tx.objectStore("activities");
        const req = store.getAll();

        req.onsuccess = () => resolve((req.result || []).reverse());
        req.onerror = (e) => reject(e.target.error);
    });
}

/* ==========================================
 * 4. AUTHENTICATION & SESSION MANAGEMENT
 * ========================================== */
function checkSession() {
    const sessionData = sessionStorage.getItem("adminSession");
    if (sessionData) {
        const session = JSON.parse(sessionData);
        document.getElementById('current-officer').textContent = sanitize(session.username);
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-header').classList.remove('hidden');
        document.getElementById('app-main').classList.remove('hidden');
        document.getElementById('app-nav').classList.remove('hidden');
        renderDashboard();
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-header').classList.add('hidden');
        document.getElementById('app-main').classList.add('hidden');
        document.getElementById('app-nav').classList.add('hidden');
    }
}

function getSession() {
    const sessionData = sessionStorage.getItem("adminSession");
    return sessionData ? JSON.parse(sessionData) : null;
}

function loginAdmin(e) {
    e.preventDefault();
    const user = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value.trim();
    const errorEl = document.getElementById('login-error');

    errorEl.classList.add('hidden');

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
        errorEl.textContent = "Username atau password salah!";
        errorEl.classList.remove('hidden');
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
        container.innerHTML = `
            <div class="relative w-full h-32 rounded-xl overflow-hidden border border-emerald-500/50">
                <img src="${base64Img}" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                    <span class="text-xs bg-emerald-500 text-slate-950 px-2 py-1 rounded-lg font-bold">Foto Siap Digunakan</span>
                </div>
            </div>
        `;
    };
    reader.readAsDataURL(file);
}

/* ==========================================
 * 7. MOTOR MASUK & ANTI DUPLIKASI
 * ========================================== */
async function handleMotorMasuk(e) {
    e.preventDefault();

    const plat = document.getElementById('in-plat').value.toUpperCase().trim();
    const merek = document.getElementById('in-merek').value.trim();
    const warna = document.getElementById('in-warna').value.trim();
    const lokasi = document.getElementById('in-lokasi').value.toUpperCase().trim();
    const ciri = document.getElementById('in-ciri').value.trim();

    if (!tempCapturedPhotoMasuk) {
        showToast("📸 Wajib ambil foto motor terlebih dahulu!", true);
        return;
    }

    // Anti Duplikasi Check
    const existingList = await getVehicleByPlate(plat);
    const activeDuplicate = existingList.find(v => v.status === "MASIH PARKIR");

    if (activeDuplicate) {
        saveActivity("duplikasi", `Upaya masuk plat ganda ${plat}`);
        const dupDetails = document.getElementById('dup-details');
        dupDetails.innerHTML = `
            <p><b>ID Transaksi:</b> ${sanitize(activeDuplicate.id)}</p>
            <p><b>Plat:</b> ${sanitize(activeDuplicate.plat)}</p>
            <p><b>Merek:</b> ${sanitize(activeDuplicate.merek)} (${sanitize(activeDuplicate.warna)})</p>
            <p><b>Lokasi:</b> ${sanitize(activeDuplicate.lokasi)}</p>
            <p><b>Masuk:</b> ${sanitize(activeDuplicate.tanggalMasuk)} • ${sanitize(activeDuplicate.waktuMasuk)}</p>
            <p><b>Petugas:</b> ${sanitize(activeDuplicate.petugasMasuk)}</p>
        `;
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

    // Reset Form
    document.getElementById('form-masuk').reset();
    tempCapturedPhotoMasuk = null;
    document.getElementById('preview-masuk-container').innerHTML = `
        <i class="fa-solid fa-camera text-3xl text-emerald-400"></i>
        <p class="text-xs font-semibold text-slate-300">Ketuk untuk Ambil Foto Motor</p>
        <p class="text-[10px] text-slate-500">Foto wajib diambil dari kamera/file</p>
    `;

    switchTab('dashboard');
}

/* ==========================================
 * 8. SEARCH & MOTOR KELUAR VERIFICATION
 * ========================================== */
async function searchVehicle() {
    const query = document.getElementById('search-out-plat').value.toUpperCase().trim();
    if (!query) {
        showToast("Masukkan nomor plat kendaraan!", true);
        return;
    }

    const vehicles = await getVehicleByPlate(query);
    const card = document.getElementById('verification-card');

    if (vehicles.length === 0) {
        card.classList.add('hidden');
        showToast(`🔴 Plat ${query} tidak ditemukan!`, true);
        saveActivity("pencarian", `Pencarian gagal plat ${query}`);
        return;
    }

    // Utamakan yang MASIH PARKIR jika ada
    let vehicle = vehicles.find(v => v.status === "MASIH PARKIR") || vehicles[vehicles.length - 1];
    activeExitVehicle = vehicle;
    saveActivity("pencarian", `Mencari kendaraan ${query}`);

    // Populate Data Card
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

    // Reset checklist & photos
    document.querySelectorAll('.verif-check').forEach(cb => cb.checked = false);
    validateChecklist();
    tempCapturedPhotoKeluar = null;
    document.getElementById('preview-keluar-container').innerHTML = `
        <i class="fa-solid fa-camera text-xl text-blue-400"></i>
        <p class="text-[11px] text-slate-300 font-medium">Ketuk untuk Ambil Foto Keluar</p>
    `;

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

    card.classList.remove('hidden');
}

function selectForExit(plat) {
    switchTab('keluar');
    document.getElementById('search-out-plat').value = plat;
    searchVehicle();
}

function validateChecklist() {
    const checkboxes = document.querySelectorAll('.verif-check');
    let allChecked = true;
    checkboxes.forEach(cb => {
        if (!cb.checked) allChecked = false;
    });

    const btn = document.getElementById('btn-allow-exit');
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
    document.getElementById('modal-confirm-exit-text').textContent = `Yakin kendaraan ${sanitize(activeExitVehicle.plat)} diizinkan keluar?`;
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
    saveActivity("motor_keluar", `Mengizinkan keluar ${activeExitVehicle.plat}`);
    showToast(`✅ Kendaraan ${activeExitVehicle.plat} Resmi Keluar`);

    document.getElementById('verification-card').classList.add('hidden');
    document.getElementById('search-out-plat').value = "";
    activeExitVehicle = null;
    switchTab('dashboard');
}

/* ==========================================
 * 9. DASHBOARD RENDERER
 * ========================================== */
async function renderDashboard() {
    if (!db) return;
    const vehicles = await getAllVehicles();
    const activities = await getActivities();

    const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    const sedangParkir = vehicles.filter(v => v.status === "MASIH PARKIR").length;
    const masukToday = vehicles.filter(v => v.tanggalMasuk === todayStr).length;
    const keluarToday = vehicles.filter(v => v.status === "SUDAH KELUAR" && v.tanggalKeluar === todayStr).length;

    document.getElementById('dash-sedang-parkir').textContent = sedangParkir;
    document.getElementById('dash-masuk-today').textContent = masukToday;
    document.getElementById('dash-keluar-today').textContent = keluarToday;

    document.getElementById('dash-kapasitas-text').textContent = `${sedangParkir} / ${TOTAL_CAPACITY}`;
    const pct = Math.min(100, (sedangParkir / TOTAL_CAPACITY) * 100);
    document.getElementById('dash-kapasitas-bar').style.width = `${pct}%`;
    document.getElementById('dash-tersedia-text').textContent = `Tersedia ${Math.max(0, TOTAL_CAPACITY - sedangParkir)} Slot`;

    // Render Realtime Stream
    const streamContainer = document.getElementById('dash-activity-list');
    if (activities.length === 0) {
        streamContainer.innerHTML = `<p class="text-slate-500 text-center py-3 text-xs">Belum ada aktivitas tercatat.</p>`;
        return;
    }

    streamContainer.innerHTML = activities.slice(0, 5).map(act => `
        <div class="flex items-center justify-between p-2 rounded-xl bg-slate-900/50 border border-slate-800/60 animate-fade-in">
            <div class="flex items-center gap-2.5">
                <span class="w-2 h-2 rounded-full ${act.action === 'motor_masuk' ? 'bg-emerald-500' : act.action === 'motor_keluar' ? 'bg-blue-500' : 'bg-amber-500'}"></span>
                <span class="font-semibold text-white text-xs">${sanitize(act.details)}</span>
            </div>
            <div class="text-right">
                <span class="text-slate-400 font-mono text-[10px]">${sanitize(act.time)}</span>
            </div>
        </div>
    `).join('');
}

/* ==========================================
 * 10. HISTORY & SEARCH RENDERER
 * ========================================== */
function setHistoryFilter(filter) {
    currentHistoryFilter = filter;
    ['ALL', 'MASIH PARKIR', 'SUDAH KELUAR'].forEach(f => {
        const btn = document.getElementById(`filter-btn-${f}`);
        if (f === filter) {
            btn.className = "flex-1 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold";
        } else {
            btn.className = "flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium";
        }
    });
    renderHistory();
}

async function renderHistory() {
    if (!db) return;
    const query = document.getElementById('history-search-input').value.toUpperCase().trim();
    let vehicles = await getAllVehicles();

    if (currentHistoryFilter !== 'ALL') {
        vehicles = vehicles.filter(v => v.status === currentHistoryFilter);
    }

    if (query) {
        vehicles = vehicles.filter(v => 
            v.plat.includes(query) || 
            v.id.includes(query) || 
            v.merek.toUpperCase().includes(query) || 
            v.lokasi.includes(query)
        );
    }

    const container = document.getElementById('history-list-container');
    if (vehicles.length === 0) {
        container.innerHTML = `<p class="text-slate-500 text-center py-6 text-xs">Tidak ada data kendaraan ditemukan.</p>`;
        return;
    }

    container.innerHTML = vehicles.reverse().map(v => `
        <div class="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-xl bg-slate-950 overflow-hidden border border-slate-800 cursor-pointer flex-shrink-0" onclick="openImageViewer('${v.fotoMasuk}', '${sanitize(v.plat)}', '${sanitize(v.waktuMasuk)}', '${v.status}')">
                    <img src="${v.fotoMasuk}" class="w-full h-full object-cover">
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <span class="font-mono font-bold text-white text-sm">${sanitize(v.plat)}</span>
                        <span class="text-[9px] px-2 py-0.5 rounded font-bold ${v.status === 'MASIH PARKIR' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}">${v.status}</span>
                    </div>
                    <p class="text-xs text-slate-300 mt-0.5">${sanitize(v.merek)} • ${sanitize(v.warna)}</p>
                    <span class="text-[10px] text-slate-500 font-mono">Parkir: ${sanitize(v.lokasi)} • Masuk: ${sanitize(v.waktuMasuk)}</span>
                </div>
            </div>
            ${v.status === 'MASIH PARKIR' ? `
                <button onclick="selectForExit('${sanitize(v.plat)}')" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-200 border border-slate-700 transition">
                    Proses <i class="fa-solid fa-chevron-right ml-1"></i>
                </button>
            ` : `
                <span class="text-xs text-slate-500 font-medium px-2 py-1">Selesai</span>
            `}
        </div>
    `).join('');
}

/* ==========================================
 * 11. IMAGE VIEWER MODAL
 * ========================================== */
function openImageViewer(imgSrc, plat, time, status) {
    if (!imgSrc) return;
    document.getElementById('viewer-img').src = imgSrc;
    document.getElementById('viewer-plat').textContent = plat || "FOTO KENDARAAN";
    document.getElementById('viewer-time').textContent = `Waktu: ${time || '-'} • Status: ${status || '-'}`;
    openModal('modal-image-viewer');
}

/* ==========================================
 * 12. ADMIN BACKUP, RESTORE & EXPORT
 * ========================================== */
async function backupDatabase() {
    const vehicles = await getAllVehicles();
    const activities = await getActivities();

    const backupData = {
        app: "ParkirMaulid",
        version: "3.0",
        exportedAt: new Date().toISOString(),
        vehicles,
        activities
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `backup-parkir-maulid-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    saveActivity("backup", "Mengunduh backup data JSON");
    showToast("Backup database berhasil diunduh!");
}

function restoreDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!importedData.vehicles || !Array.isArray(importedData.vehicles)) {
                showToast("File backup JSON tidak valid!", true);
                return;
            }

            const confirmRestore = confirm(`Ditemukan ${importedData.vehicles.length} transaksi. Apakah Anda yakin ingin memuat data ini ke dalam IndexedDB?`);
            if (!confirmRestore) return;

            for (const v of importedData.vehicles) {
                await updateVehicle(v);
            }

            saveActivity("restore", `Restore ${importedData.vehicles.length} data transaksi`);
            showToast("Restore database berhasil!");
            renderDashboard();
        } catch (err) {
            console.error(err);
            showToast("Gagal membaca file backup!", true);
        }
    };
    reader.readAsText(file);
}

async function exportCSV() {
    const vehicles = await getAllVehicles();
    if (vehicles.length === 0) {
        showToast("Belum ada data transaksi untuk diexport!", true);
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID Transaksi,Plat Nomor,Merek,Warna,Lokasi,Tanggal Masuk,Waktu Masuk,Petugas Masuk,Tanggal Keluar,Waktu Keluar,Petugas Keluar,Status\n";

    vehicles.forEach(v => {
        const row = [
            `"${v.id}"`,
            `"${v.plat}"`,
            `"${v.merek}"`,
            `"${v.warna}"`,
            `"${v.lokasi}"`,
            `"${v.tanggalMasuk}"`,
            `"${v.waktuMasuk}"`,
            `"${v.petugasMasuk}"`,
            `"${v.tanggalKeluar || '-'}"`,
            `"${v.waktuKeluar || '-'}"`,
            `"${v.petugasKeluar || '-'}"`,
            `"${v.status}"`
        ];
        csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `laporan-parkir-maulid-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();

    saveActivity("export", "Mengunduh laporan CSV");
    showToast("Laporan CSV berhasil diunduh!");
}

async function executePurgeDatabase() {
    const confirmInput = document.getElementById('purge-confirm-input').value.trim();
    if (confirmInput !== "HAPUS SEMUA DATA") {
        showToast("Konfirmasi kata kunci tidak sesuai!", true);
        return;
    }

    closeModal('modal-purge');

    const tx = db.transaction(["vehicles", "activities"], "readwrite");
    tx.objectStore("vehicles").clear();
    tx.objectStore("activities").clear();

    tx.oncomplete = () => {
        showToast("Seluruh database berhasil dihapus.");
        document.getElementById('purge-confirm-input').value = "";
        renderDashboard();
    };
}

/* ==========================================
 * 13. INITIALIZATION
 * ========================================== */
document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initDatabase();
        checkSession();
    } catch (e) {
        console.error("Database failed to initialize", e);
    }
});