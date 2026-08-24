/**
 * PARKIR MAULID PRO - PRODUCTION CONTROLLER
 * Architecture: SPA with Direct Supabase REST API & Storage Integration
 */

/* ==========================================
 * 1. SUPABASE CONFIGURATION
 * ========================================== */
const SUPABASE_URL = "https://YOUR_SUPABASE_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

const TOTAL_CAPACITY = 200;
const BUCKET_NAME = "vehicle-photos";

// Inisialisasi Client Supabase via CDN
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Variables
let currentSession = null;
let activeExitVehicle = null;
let tempCapturedPhotoMasuk = null;
let tempCapturedPhotoKeluar = null;
let isOnline = navigator.onLine;

/* ==========================================
 * 2. SYSTEM UTILITIES & ONLINE MONITOR
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
    }, 3500);
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

function updateNetworkStatus() {
    isOnline = navigator.onLine;
    const badge = document.getElementById('network-badge');
    if (!badge) return;

    if (isOnline) {
        badge.className = "px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5";
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ONLINE`;
    } else {
        badge.className = "px-2 py-1 rounded-full text-[10px] font-bold bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-1.5";
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-500"></span> OFFLINE`;
        showToast("🔴 KONEKSI TERPUTUS. Operasi database dinonaktifkan.", true);
    }
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

/* ==========================================
 * 3. LOGGING SYSTEM (SUPABASE ACTIVITY_LOGS)
 * ========================================== */
async function saveActivityLog(type, plate, description) {
    if (!currentSession) return;
    try {
        await supabase.from('activity_logs').insert([{
            admin_id: currentSession.user.email,
            activity_type: type,
            plate_number: plate || null,
            description: description,
            created_at: new Date().toISOString()
        }]);
    } catch (e) {
        console.error("Gagal mencatat activity log:", e);
    }
}

/* ==========================================
 * 4. AUTHENTICATION (SUPABASE AUTH)
 * ========================================== */
async function checkAuthSession() {
    updateNetworkStatus();
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (session) {
        currentSession = session;
        document.getElementById('current-officer').textContent = sanitize(session.user.email.split('@')[0]);
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-header').classList.remove('hidden');
        document.getElementById('app-main').classList.remove('hidden');
        document.getElementById('app-nav').classList.remove('hidden');
        renderDashboard();
    } else {
        currentSession = null;
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-header').classList.add('hidden');
        document.getElementById('app-main').classList.add('hidden');
        document.getElementById('app-nav').classList.add('hidden');
    }
}

async function loginAdmin(e) {
    e.preventDefault();
    if (!isOnline) {
        showToast("🔴 KONEKSI DATABASE TERPUTUS. Gagal login.", true);
        return;
    }

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errorEl = document.getElementById('login-error');
    const btnSubmit = document.getElementById('btn-login-submit');

    errorEl.classList.add('hidden');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Authenticating...`;

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<span>AUTHENTICATE LOGIN</span> <i class="fa-solid fa-arrow-right-to-bracket"></i>`;

    if (error) {
        errorEl.textContent = "Autentikasi Gagal: " + error.message;
        errorEl.classList.remove('hidden');
        return;
    }

    currentSession = data.session;
    await saveActivityLog("LOGIN", null, "Admin login ke sistem operasional");
    showToast("Login Berhasil! Session Terverifikasi.");
    checkAuthSession();
}

async function logoutAdmin() {
    if (currentSession) {
        await saveActivityLog("LOGOUT", null, "Admin logout dari sistem");
    }
    await supabase.auth.signOut();
    showToast("Session dihentikan.");
    checkAuthSession();
}

/* ==========================================
 * 5. COMPRESS & UPLOAD FOTO (SUPABASE STORAGE)
 * ========================================== */
function previewPhoto(event, containerId) {
    const file = event.target.files[0];
    if (!file) return;

    if (containerId === 'preview-masuk-container') {
        tempCapturedPhotoMasuk = file;
    } else if (containerId === 'preview-keluar-container') {
        tempCapturedPhotoKeluar = file;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="relative w-full h-36 rounded-xl overflow-hidden border border-emerald-500/50">
                <img src="${e.target.result}" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                    <span class="text-xs bg-emerald-500 text-slate-950 px-2 py-1 rounded-lg font-bold">Foto Tersimpan Sementara</span>
                </div>
            </div>
        `;
    };
    reader.readAsDataURL(file);
}

async function uploadPhotoToStorage(fileObject, fileNamePrefix) {
    const ext = fileObject.name.split('.').pop();
    const filePath = `${fileNamePrefix}_${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, fileObject, { cacheControl: '3600', upsert: true });

    if (error) throw new Error("Gagal mengupload foto: " + error.message);

    const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
}

/* ==========================================
 * 6. TRANSAKSI MOTOR MASUK (DATABASE ONLINE)
 * ========================================== */
async function handleMotorMasuk(e) {
    e.preventDefault();

    if (!isOnline) {
        showToast("🔴 KONEKSI DATABASE TERPUTUS. Data belum disimpan.", true);
        return;
    }

    if (!tempCapturedPhotoMasuk) {
        showToast("📸 Foto fisik motor wajib diambil terlebih dahulu!", true);
        return;
    }

    const btnSubmit = document.getElementById('btn-submit-masuk');
    const plat = document.getElementById('in-plat').value.toUpperCase().replace(/\s+/g, '').trim();
    const merek = document.getElementById('in-merek').value.trim();
    const warna = document.getElementById('in-warna').value.trim();
    const lokasi = document.getElementById('in-lokasi').value.toUpperCase().trim();
    const ciri = document.getElementById('in-ciri').value.trim();

    try {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> MEMERIKSA DUPLIKASI...`;

        // Anti Duplikasi Check di Supabase Database
        const { data: existing, error: dupError } = await supabase
            .from('vehicles')
            .select('*')
            .eq('plate_number', plat)
            .eq('status', 'MASIH_PARKIR');

        if (dupError) throw dupError;

        if (existing && existing.length > 0) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<i class="fa-solid fa-cloud-arrow-up text-base"></i> <span>SIMPAN MOTOR MASUK</span>`;

            const dup = existing[0];
            const dupDetails = document.getElementById('dup-details');
            dupDetails.innerHTML = `
                <p><b>ID Transaksi:</b> ${sanitize(dup.transaction_code)}</p>
                <p><b>Plat:</b> ${sanitize(dup.plate_number)}</p>
                <p><b>Merek:</b> ${sanitize(dup.brand_model)} (${sanitize(dup.color)})</p>
                <p><b>Lokasi:</b> ${sanitize(dup.parking_location)}</p>
                <p><b>Waktu Masuk:</b> ${sanitize(dup.entry_date)} • ${sanitize(dup.entry_time)}</p>
            `;
            openModal('modal-duplicate');
            await saveActivityLog("DUPLIKASI_ATTEMPT", plat, "Upaya input plat ganda yang masih parkir");
            return;
        }

        btnSubmit.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> UPLOADING FOTO...`;
        const entryPhotoUrl = await uploadPhotoToStorage(tempCapturedPhotoMasuk, `entry_${plat}`);

        btnSubmit.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> MENYIMPAN TRANSAKSI...`;
        
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
        const timeStr = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');
        const displayDate = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const transactionCode = `PM-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

        const { error: insertError } = await supabase.from('vehicles').insert([{
            transaction_code: transactionCode,
            plate_number: plat,
            brand_model: merek,
            color: warna,
            parking_location: lokasi,
            special_notes: ciri || "-",
            entry_photo: entryPhotoUrl,
            exit_photo: null,
            entry_date: displayDate,
            entry_time: timeStr,
            exit_date: null,
            exit_time: null,
            entry_officer: currentSession.user.email,
            exit_officer: null,
            status: "MASIH_PARKIR"
        }]);

        if (insertError) throw insertError;

        await saveActivityLog("MOTOR_MASUK", plat, `Pendaftaran motor masuk di ${lokasi}`);
        showToast(`✅ Transaksi ${plat} berhasil disimpan ke server!`);

        // Reset Form
        document.getElementById('form-masuk').reset();
        tempCapturedPhotoMasuk = null;
        document.getElementById('preview-masuk-container').innerHTML = `
            <i class="fa-solid fa-camera text-3xl text-emerald-400"></i>
            <p class="text-xs font-semibold text-slate-300">Ambil Foto Fisik Motor</p>
            <p class="text-[10px] text-slate-500">Klik untuk membuka kamera HP</p>
        `;

        switchTab('dashboard');
    } catch (err) {
        showToast(`🔴 FAIL: ${err.message}`, true);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `<i class="fa-solid fa-cloud-arrow-up text-base"></i> <span>SIMPAN MOTOR MASUK</span>`;
    }
}

/* ==========================================
 * 7. TRANSAKSI MOTOR KELUAR & SEARCH
 * ========================================== */
async function searchVehicle() {
    if (!isOnline) {
        showToast("🔴 KONEKSI DATABASE TERPUTUS. Gagal pencarian.", true);
        return;
    }

    const query = document.getElementById('search-out-plat').value.toUpperCase().replace(/\s+/g, '').trim();
    if (!query) {
        showToast("Masukkan nomor plat kendaraan!", true);
        return;
    }

    const card = document.getElementById('verification-card');
    card.classList.add('hidden');

    const { data: vehicles, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('plate_number', query)
        .order('created_at', { ascending: false });

    if (error || !vehicles || vehicles.length === 0) {
        showToast(`🔴 Kendaraan plat ${query} tidak ditemukan di database!`, true);
        await saveActivityLog("CARI_GAGAL", query, "Pencarian plat tidak ditemukan");
        return;
    }

    // Prioritaskan transaksi yang MASIH_PARKIR
    const vehicle = vehicles.find(v => v.status === "MASIH_PARKIR") || vehicles[0];
    activeExitVehicle = vehicle;
    await saveActivityLog("CARI_KENDARAAN", query, `Pencarian data kendaraan ID ${vehicle.transaction_code}`);

    document.getElementById('v-plat').textContent = sanitize(vehicle.plate_number);
    document.getElementById('v-merek-warna').textContent = `${sanitize(vehicle.brand_model)} - ${sanitize(vehicle.color)} (${sanitize(vehicle.special_notes)})`;
    document.getElementById('v-lokasi').textContent = sanitize(vehicle.parking_location);
    document.getElementById('v-id').textContent = sanitize(vehicle.transaction_code);
    document.getElementById('v-foto-masuk').src = vehicle.entry_photo;

    const badge = document.getElementById('v-status-badge');
    badge.textContent = vehicle.status;

    document.querySelectorAll('.verif-check').forEach(cb => cb.checked = false);
    validateChecklist();
    tempCapturedPhotoKeluar = null;
    document.getElementById('preview-keluar-container').innerHTML = `
        <p class="text-xs text-slate-400"><i class="fa-solid fa-camera text-emerald-400"></i> Ketuk Ambil Foto Keluar</p>
    `;

    if (vehicle.status === "MASIH_PARKIR") {
        badge.className = "text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
        document.getElementById('section-foto-keluar').classList.remove('hidden');
        document.getElementById('section-checklist').classList.remove('hidden');
        document.getElementById('section-exit-button').classList.remove('hidden');
        document.getElementById('section-already-exit').classList.add('hidden');
    } else {
        badge.className = "text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700";
        document.getElementById('section-foto-keluar').classList.add('hidden');
        document.getElementById('section-checklist').classList.add('hidden');
        document.getElementById('section-exit-button').classList.add('hidden');
        document.getElementById('section-already-exit').classList.remove('hidden');

        document.getElementById('v-keluar-waktu').textContent = `${sanitize(vehicle.exit_date)} • ${sanitize(vehicle.exit_time)}`;
        document.getElementById('v-keluar-petugas').textContent = sanitize(vehicle.exit_officer);

        if (vehicle.exit_photo) {
            document.getElementById('v-foto-keluar').src = vehicle.exit_photo;
            document.getElementById('v-foto-keluar-container').classList.remove('hidden');
        } else {
            document.getElementById('v-foto-keluar-container').classList.add('hidden');
        }
    }

    card.classList.remove('hidden');
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
        btn.className = "w-full py-3.5 bg-slate-800 text-slate-500 font-extrabold rounded-xl text-xs transition cursor-not-allowed";
    }
}

function confirmProcessExit() {
    if (!activeExitVehicle) return;
    document.getElementById('modal-confirm-exit-text').textContent = `Apakah Anda yakin motor ${sanitize(activeExitVehicle.plate_number)} telah diverifikasi dan diizinkan keluar?`;
    openModal('modal-confirm-exit');
}

async function executeVehicleExit() {
    closeModal('modal-confirm-exit');
    if (!activeExitVehicle || !isOnline) {
        showToast("🔴 KONEKSI TERPUTUS atau Transaksi Tidak Valid.", true);
        return;
    }

    if (activeExitVehicle.status === "SUDAH_KELUAR") {
        showToast("⚠️ Transaksi ini sudah diselesaikan sebelumnya!", true);
        return;
    }

    try {
        let exitPhotoUrl = null;
        if (tempCapturedPhotoKeluar) {
            showToast("Mengupload foto keluar...");
            exitPhotoUrl = await uploadPhotoToStorage(tempCapturedPhotoKeluar, `exit_${activeExitVehicle.plate_number}`);
        }

        const now = new Date();
        const timeStr = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');
        const displayDate = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        const { error } = await supabase
            .from('vehicles')
            .update({
                status: "SUDAH_KELUAR",
                exit_date: displayDate,
                exit_time: timeStr,
                exit_officer: currentSession.user.email,
                exit_photo: exitPhotoUrl || activeExitVehicle.exit_photo,
                updated_at: now.toISOString()
            })
            .eq('id', activeExitVehicle.id)
            .eq('status', 'MASIH_PARKIR'); // Double submission lock

        if (error) throw error;

        await saveActivityLog("MOTOR_KELUAR", activeExitVehicle.plate_number, "Motor diverifikasi & diizinkan keluar");
        showToast(`✅ Motor ${activeExitVehicle.plate_number} RESMI KELUAR.`);

        searchVehicle();
    } catch (err) {
        showToast(`🔴 GAGAL KELUAR: ${err.message}`, true);
    }
}

/* ==========================================
 * 8. DASHBOARD & DATA RENDERING
 * ========================================== */
async function renderDashboard() {
    if (!isOnline) return;

    // Fetch Active Parking Stats
    const { count, error } = await supabase
        .from('vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'MASIH_PARKIR');

    if (!error) {
        document.getElementById('stat-active').textContent = count || 0;
        document.getElementById('stat-capacity').textContent = `${count || 0}/${TOTAL_CAPACITY}`;
    }

    // Fetch Recent Activity Logs
    const { data: logs } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);

    const logContainer = document.getElementById('recent-logs-list');
    if (logs && logs.length > 0) {
        logContainer.innerHTML = logs.map(l => `
            <div class="p-2 border-b border-slate-800/60 flex justify-between items-center text-[11px]">
                <div>
                    <span class="font-bold text-white">${sanitize(l.activity_type)}</span>
                    <span class="text-slate-500">${l.plate_number ? `- ${sanitize(l.plate_number)}` : ''}</span>
                    <p class="text-[10px] text-slate-400">${sanitize(l.description)}</p>
                </div>
                <span class="text-[9px] text-slate-500 font-mono">${new Date(l.created_at).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</span>
            </div>
        `).join('');
    } else {
        logContainer.innerHTML = `<p class="text-center py-2 text-slate-600">Belum ada aktivitas.</p>`;
    }
}

async function renderHistory(filterStatus = "ALL") {
    if (!isOnline) return;

    let query = supabase.from('vehicles').select('*').order('created_at', { ascending: false });
    if (filterStatus !== "ALL") {
        query = query.eq('status', filterStatus);
    }

    const { data: vehicles } = await query.limit(50);
    const container = document.getElementById('history-list');

    if (!vehicles || vehicles.length === 0) {
        container.innerHTML = `<p class="text-center py-6 text-xs text-slate-500">Tidak ada riwayat transaksi.</p>`;
        return;
    }

    container.innerHTML = vehicles.map(v => `
        <div class="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
            <div>
                <p class="font-bold text-white font-mono">${sanitize(v.plate_number)} <span class="text-[10px] text-slate-400 font-sans">(${sanitize(v.parking_location)})</span></p>
                <p class="text-[10px] text-slate-400">${sanitize(v.entry_date)} • ${sanitize(v.entry_time)}</p>
            </div>
            <span class="px-2 py-1 rounded text-[9px] font-bold ${v.status === 'MASIH_PARKIR' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}">
                ${v.status}
            </span>
        </div>
    `).join('');
}

function filterHistory(status) {
    renderHistory(status);
}

/* ==========================================
 * 9. BACKUP & EXPORT REAL DATA
 * ========================================== */
async function exportToCSV() {
    const { data: vehicles, error } = await supabase.from('vehicles').select('*');
    if (error || !vehicles || vehicles.length === 0) {
        showToast("Tidak ada data untuk diexport!", true);
        return;
    }

    const headers = ["ID", "Kode Transaksi", "Plat Nomor", "Merek/Model", "Warna", "Lokasi", "Status", "Tgl Masuk", "Jam Masuk", "Tgl Keluar", "Jam Keluar"];
    const rows = vehicles.map(v => [
        v.id, v.transaction_code, v.plate_number, v.brand_model, v.color, v.parking_location, v.status, v.entry_date, v.entry_time, v.exit_date || '-', v.exit_time || '-'
    ]);

    let csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Backup_ParkirMaulid_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function exportBackupJSON() {
    const { data: vehicles } = await supabase.from('vehicles').select('*');
    const { data: logs } = await supabase.from('activity_logs').select('*');

    const backupObject = {
        exported_at: new Date().toISOString(),
        system: "ParkirMaulid PRO Production",
        vehicles: vehicles || [],
        activity_logs: logs || []
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObject, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `FullBackup_ParkirMaulid_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

/* ==========================================
 * 10. TAB NAVIGATION & INITIALIZATION
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
    if (tabId === 'cari') renderHistory('ALL');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener("DOMContentLoaded", () => {
    // Bind Form Handlers
    document.getElementById('login-form').addEventListener('submit', loginAdmin);
    document.getElementById('form-masuk').addEventListener('submit', handleMotorMasuk);

    // Initial Auth Verification
    checkAuthSession();
});