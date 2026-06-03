// ==========================================
// INITIAL LIGHTBOX LOGIC
// ==========================================
window.openLightbox = window.openLightbox || function(url){ 
    const m = document.getElementById('lightbox-modal'); 
    const i = document.getElementById('lightbox-img'); 
    if(m && i){ i.src = url; m.classList.remove('hidden'); } 
}; 
window.closeLightbox = window.closeLightbox || function(){ 
    const m = document.getElementById('lightbox-modal'); 
    if(m) m.classList.add('hidden'); 
};

// ==========================================
// CORE GLOBAL DATA LOGBOOK & MANAGEMENT
// ==========================================
let googleSheetsURL = '';
let selectedCategoryName = '';
let currentSession = null;
let uploadedPhotosBase64 = [];

// Data Default Awal Aplikasi
let logbookEntries = [];
let userAccounts = [
    { username: 'admin', password: '123', name: 'Harris Admin', role: 'admin' },
    { username: 'teknisi', password: '123', name: 'Harris Teknisi', role: 'user' }
];
let dropdownSpecialties = ['Mechanical', 'Electrical', 'Plumbing', 'HVAC', 'Civil/Kitchen', 'IT Support'];
let dropdownMaintenanceTypes = ['Corrective Maintenance', 'Preventive Maintenance', 'Project / Installation', 'Emergency Call'];

// State Pagination Internal
let dashboardCurrentPage = 1;
const dashboardItemsPerPage = 7;
let paginatedSearchCurrentPage = 1;
const paginatedSearchItemsPerPage = 10;
let lastFilteredEntriesGlobal = [];

// ==========================================
// APP LIFECYCLE (LOAD)
// ==========================================
window.onload = function() {
    initDefaultDates();
    loadLocalStorageData();
    lucide.createIcons();
    
    // Auto-Connect Link via URL parameter (?api=...)
    const urlParams = new URLSearchParams(window.location.search);
    const apiParam = urlParams.get('api');
    
    if (apiParam && apiParam.startsWith('https://script.google.com/')) {
        googleSheetsURL = apiParam.trim();
        localStorage.setItem('he_sheets_url', apiParam.trim());
        window.history.replaceState({}, document.title, window.location.pathname);
        showAlert('Cloud database terhubung otomatis!', 'success');
    }

    const currentSavedURL = localStorage.getItem('he_sheets_url') || '';
    if (currentSavedURL) {
        googleSheetsURL = currentSavedURL;
        const sheetApiUrlInput = document.getElementById('sheet-api-url');
        if (sheetApiUrlInput) sheetApiUrlInput.value = currentSavedURL;
        updateSyncStatusUI(true);
        syncDataWithSheets(); // Diubah dari silent pull ke fungsi sync pintar yang baru
    } else {
        updateSyncStatusUI(false);
    }

    const savedSession = JSON.parse(localStorage.getItem('he_session'));
    if (savedSession) {
        applyUserSession(savedSession.role, savedSession.name);
    } else {
        showSection('login');
    }

    // Eksekusi penentu tampilan banner diletakkan di paling bawah sebelum render
    checkSyncBannerVisibility();
    renderData();
};

function initDefaultDates() {
    const todayStr = new Date().toISOString().split('T')[0];
    const startDateInput = document.getElementById('filter-start-date');
    const endDateInput = document.getElementById('filter-end-date');
    if (startDateInput) startDateInput.value = todayStr;
    if (endDateInput) endDateInput.value = todayStr;
}

function loadLocalStorageData() {
    if(localStorage.getItem('he_logbooks')) {
        logbookEntries = JSON.parse(localStorage.getItem('he_logbooks'));
    }
    if(localStorage.getItem('he_users')) {
        userAccounts = JSON.parse(localStorage.getItem('he_users'));
    }
    if(localStorage.getItem('he_specialties')) {
        dropdownSpecialties = JSON.parse(localStorage.getItem('he_specialties'));
    }
    if(localStorage.getItem('he_maintenance')) {
        dropdownMaintenanceTypes = JSON.parse(localStorage.getItem('he_maintenance'));
    }
}

function saveToLocalStorage() {
    localStorage.setItem('he_logbooks', JSON.stringify(logbookEntries));
    localStorage.setItem('he_users', JSON.stringify(userAccounts));
    localStorage.setItem('he_specialties', JSON.stringify(dropdownSpecialties));
    localStorage.setItem('he_maintenance', JSON.stringify(dropdownMaintenanceTypes));
}

// ==========================================
// CORE INTERFACE NAVIGATION LOGIC
// ==========================================
function showSection(type) {
    const loginSec = document.getElementById('login-section');
    const dashSec = document.getElementById('dashboard-section');
    const userNav = document.getElementById('user-nav');
    
    if(type === 'login') {
        if(loginSec) loginSec.classList.remove('hidden');
        if(dashSec) dashSec.classList.add('hidden');
        if(userNav) userNav.classList.add('hidden');
    } else {
        if(loginSec) loginSec.classList.add('hidden');
        if(dashSec) dashSec.classList.remove('hidden');
        if(userNav) userNav.classList.remove('hidden');
    }
}

function switchTab(name) {
    const logTab = document.getElementById('tab-content-logbook');
    const userTab = document.getElementById('tab-content-users');
    const btnLog = document.getElementById('btn-tab-logbook');
    const btnUser = document.getElementById('btn-tab-users');
    
    if(!logTab || !userTab || !btnLog || !btnUser) return;

    if(name === 'logbook') {
        logTab.classList.remove('hidden');
        userTab.classList.add('hidden');
        btnLog.className = "flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center space-x-2 bg-white text-orange-600 shadow-md transition-all duration-300";
        btnUser.className = "flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center space-x-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-all duration-300";
    } else {
        logTab.classList.add('hidden');
        userTab.classList.remove('hidden');
        btnUser.className = "flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center space-x-2 bg-white text-orange-600 shadow-md transition-all duration-300";
        btnLog.className = "flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center space-x-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-all duration-300";
    }
}

// ==========================================
// SYSTEM LOGIN & SESSION LOGIC
// ==========================================
function handleLogin(e) {
    e.preventDefault();
    const userIn = document.getElementById('login-username').value.trim();
    const passIn = document.getElementById('login-password').value;
    
    const found = userAccounts.find(u => u.username.toLowerCase() === userIn.toLowerCase() && u.password === passIn);
    if(found) {
        currentSession = found;
        localStorage.setItem('he_session', JSON.stringify({ role: found.role, name: found.name }));
        applyUserSession(found.role, found.name);
        document.getElementById('login-form').reset();
        showAlert(`Selamat datang kembali, ${found.name}!`, 'success');
        renderData();
    } else {
        showAlert('Username atau Password salah!', 'error');
    }
}

function applyUserSession(role, name) {
    currentSession = { role, name };
    const navName = document.getElementById('nav-user-name');
    const navRole = document.getElementById('nav-user-role');
    if(navName) navName.innerText = name;
    if(navRole) navRole.innerText = role === 'admin' ? 'Administrator' : 'Technician';
    
    const adminTabs = document.getElementById('admin-tabs');
    const btnExport = document.getElementById('btn-admin-export-pdf');
    
    if(role === 'admin') {
        if(adminTabs) adminTabs.classList.remove('hidden');
        if(btnExport) btnExport.classList.remove('hidden');
    } else {
        if(adminTabs) adminTabs.classList.add('hidden');
        if(btnExport) btnExport.classList.add('hidden');
        switchTab('logbook');
    }
    showSection('dashboard');
}

function logout() {
    currentSession = null;
    localStorage.removeItem('he_session');
    showSection('login');
    showAlert('Anda telah berhasil keluar dari sistem.', 'success');
}

// ==========================================
// MODAL & FILE HANDLING LOGIC
// ==========================================
function openAddTaskModal() {
    const modal = document.getElementById('add-task-modal');
    if(modal) modal.classList.remove('hidden');
    
    const today = new Date();
    const jobDateInput = document.getElementById('job-date');
    if(jobDateInput) {
        jobDateInput.value = today.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    populateDropdowns('job-specialty', dropdownSpecialties);
    populateDropdowns('job-maintenance-type', dropdownMaintenanceTypes);
    
    resetAddTaskFormState();
}

function closeAddTaskModal() {
    const modal = document.getElementById('add-task-modal');
    if(modal) modal.classList.add('hidden');
}

function resetAddTaskFormState() {
    const form = document.getElementById('logbook-form');
    if(form) form.reset();
    
    const editIdInput = document.getElementById('edit-id');
    if(editIdInput) editIdInput.value = '';
    
    selectedCategoryName = '';
    uploadedPhotosBase64 = [];
    
    const previewContainer = document.getElementById('photo-preview-container');
    if(previewContainer) previewContainer.innerHTML = '';
    
    const jobCatInput = document.getElementById('job-category');
    if(jobCatInput) jobCatInput.value = '';
    
    const categories = ['room', 'meeting', 'public', 'event', 'kitchen'];
    categories.forEach(c => {
        const el = document.getElementById(`cat-${c}`);
        if(el) el.className = "py-3 px-2 rounded-2xl border text-[11px] font-black text-center transition-all duration-200 flex flex-col items-center justify-center space-y-1 bg-slate-50 border-slate-200 text-slate-600 active:scale-95 transform";
    });
}

function selectCategory(name) {
    selectedCategoryName = name;
    const jobCatInput = document.getElementById('job-category');
    if(jobCatInput) jobCatInput.value = name;
    
    const categories = { 'Guest Room': 'room', 'Meeting Room': 'meeting', 'Public Area': 'public', 'Event': 'event', 'Kitchen': 'kitchen' };
    
    Object.keys(categories).forEach(k => {
        const el = document.getElementById(`cat-${categories[k]}`);
        if(!el) return;
        if(k === name) {
            el.className = "py-3 px-2 rounded-2xl border text-[11px] font-black text-center transition-all duration-200 flex flex-col items-center justify-center space-y-1 bg-orange-600 border-orange-600 text-white shadow-lg glow-orange scale-[1.03] transform";
        } else {
            el.className = "py-3 px-2 rounded-2xl border text-[11px] font-black text-center transition-all duration-200 flex flex-col items-center justify-center space-y-1 bg-slate-50 border-slate-200 text-slate-600 active:scale-95 transform";
        }
    });
}

function handlePhotoSelection(e) {
    const files = e.target.files;
    if(!files || files.length === 0) return;
    if(uploadedPhotosBase64.length >= 3) {
        showAlert('Maksimal lampiran hanya 3 foto!', 'error');
        return;
    }
    
    const file = files[0];
    const reader = new FileReader();
    reader.onload = function(evt) {
        uploadedPhotosBase64.push(evt.target.result);
        renderPhotoPreviews('photo-preview-container', uploadedPhotosBase64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
}

function renderPhotoPreviews(containerId, photoList) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = '';
    photoList.forEach((src, idx) => {
        const div = document.createElement('div');
        div.className = "relative rounded-xl overflow-hidden border border-slate-200 h-16 bg-slate-50 shadow-sm";
        div.innerHTML = `
            <img src="${src}" class="w-full h-full object-cover cursor-pointer" onclick="openLightbox('${src}')">
            <button type="button" onclick="removePhoto(${idx}, '${containerId}')" class="absolute top-0.5 right-0.5 bg-red-600 text-white w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center shadow">✕</button>
        `;
        container.appendChild(div);
    });
}

function removePhoto(idx, containerId) {
    if(containerId === 'photo-preview-container') {
        uploadedPhotosBase64.splice(idx, 1);
        renderPhotoPreviews(containerId, uploadedPhotosBase64);
    } else {
        let currentModalPhotos = window.currentModalEditingPhotos || [];
        currentModalPhotos.splice(idx, 1);
        window.currentModalEditingPhotos = currentModalPhotos;
        renderPhotoPreviews(containerId, currentModalPhotos);
    }
}

function populateDropdowns(elId, list) {
    const select = document.getElementById(elId);
    if(!select) return;
    select.innerHTML = '';
    list.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.innerText = item;
        select.appendChild(opt);
    });
}

// ==========================================
// PENANGANAN EDIT LAPORAN (FORM POPULATION)
// ==========================================
function openModalEditLaporan(id) {
    const entry = logbookEntries.find(item => item.id === id);
    if (!entry) return;

    openAddTaskModal(); // Siapkan struktur modal dasar

    // Isi Nilai ID agar sistem tahu ini mode edit
    document.getElementById('edit-id').value = entry.id;

    // Masukkan data lama kembali ke dalam Form Input
    document.getElementById('job-specialty').value = entry.specialty;
    document.getElementById('job-maintenance-type').value = entry.maintenanceType;
    document.getElementById('job-area').value = entry.area;
    document.getElementById('job-detail').value = entry.detail;
    document.getElementById('job-time-start').value = entry.timeStart;
    document.getElementById('job-time-finish').value = entry.timeFinish;
    document.getElementById('job-shift').value = entry.shift;
    document.getElementById('job-status').value = entry.status;
    
    const adminNotesField = document.getElementById('job-admin-notes');
    if(adminNotesField) adminNotesField.value = entry.adminNotes || '';

    // Aktifkan visual kategori terpilih
    selectCategory(entry.category);

    // Muat kembali foto-foto yang sudah di-upload sebelumnya
    uploadedPhotosBase64 = [...(entry.photos || [])];
    renderPhotoPreviews('photo-preview-container', uploadedPhotosBase64);
}

// ==========================================
// PROCESS DATA SUBMISSION LOGIC
// ==========================================
function submitPekerjaan(e) {
    e.preventDefault();
    if(!selectedCategoryName) {
        showAlert('Silakan pilih Kategori Area terlebih dahulu!', 'error');
        return;
    }
    
    const now = new Date();
    const rawId = document.getElementById('edit-id').value;
    const isEdit = (rawId && rawId.trim() !== "");
    const id = isEdit ? rawId : 'LOG-' + Date.now();
    const activeUser = currentSession ? currentSession.name : 'Unknown';
    
    let baseEntry = {
        id: id,
        date: now.toLocaleDateString('id-ID'),
        timestamp: now.getTime(),
        specialty: document.getElementById('job-specialty').value,
        maintenanceType: document.getElementById('job-maintenance-type').value,
        category: selectedCategoryName,
        area: document.getElementById('job-area').value.trim(),
        detail: document.getElementById('job-detail').value.trim(),
        timeStart: document.getElementById('job-time-start').value,
        timeFinish: document.getElementById('job-time-finish').value,
        shift: document.getElementById('job-shift').value,
        status: document.getElementById('job-status').value,
        technician: activeUser,
        photos: [...uploadedPhotosBase64],
        adminNotes: (document.getElementById('job-admin-notes') ? document.getElementById('job-admin-notes').value.trim() : ''),
        updates: []
    };

    if(isEdit) {
        const existingIdx = logbookEntries.findIndex(item => item.id === id);
        if(existingIdx > -1) {
            baseEntry.updates = logbookEntries[existingIdx].updates || [];
            
            baseEntry.updates.push({
                status: baseEntry.status,
                timeStart: baseEntry.timeStart,
                timeFinish: baseEntry.timeFinish,
                detail: `Diubah oleh ${activeUser}: ${baseEntry.detail}`,
                shift: baseEntry.shift,
                technician: activeUser,
                photos: [...baseEntry.photos]
            });
            
            logbookEntries[existingIdx] = baseEntry;
            showAlert('Data Laporan Pekerjaan berhasil diupdate!', 'success');
        }
    } else {
        logbookEntries.unshift(baseEntry);
        showAlert('Laporan Baru berhasil ditambahkan ke logbook!', 'success');
    }
    
    if (typeof triggerSyncUploadSilent === "function") triggerSyncUploadSilent(baseEntry);
    
    saveToLocalStorage();
    closeAddTaskModal();
    renderData();
}

// ==========================================
// RENDER VIEW DATA TABLE & CARDS MOBILE
// ==========================================
function renderData() {
    const tableBody = document.getElementById('log-table-body');
    const mobileCards = document.getElementById('log-cards-mobile');
    const emptyState = document.getElementById('empty-state');
    
    if(!tableBody || !mobileCards) return;
    
    let filtered = [...logbookEntries];
    
    const sDate = document.getElementById('filter-start-date').value;
    const eDate = document.getElementById('filter-end-date').value;
    const search = document.getElementById('filter-search').value.toLowerCase().trim();
    const cat = document.getElementById('filter-category').value;
    const stat = document.getElementById('filter-status').value;
    
    const isDefaultFilter = (!search && !cat && !stat);
    const badgeInfo = document.getElementById('default-days-info');
    
    if(badgeInfo) {
        if(isDefaultFilter) badgeInfo.classList.remove('hidden');
        else badgeInfo.classList.add('hidden');
    }

    if(sDate || eDate) {
        filtered = filtered.filter(entry => {
            let entryDateStr = '';
            if(entry.timestamp) {
                entryDateStr = new Date(entry.timestamp).toISOString().split('T')[0];
            } else {
                const parts = entry.date.split('/');
                if(parts.length === 3) entryDateStr = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
            }
            if(sDate && entryDateStr < sDate) return false;
            if(eDate && entryDateStr > eDate) return false;
            return true;
        });
    }

    if(search) {
        filtered = filtered.filter(e => 
            e.technician.toLowerCase().includes(search) || 
            e.area.toLowerCase().includes(search) || 
            e.detail.toLowerCase().includes(search) ||
            e.specialty.toLowerCase().includes(search)
        );
    }
    if(cat) filtered = filtered.filter(e => e.category === cat);
    if(stat) filtered = filtered.filter(e => e.status === stat);
    
    lastFilteredEntriesGlobal = filtered;
    updateStatistics(filtered);

    if(filtered.length === 0) {
        tableBody.innerHTML = '';
        mobileCards.innerHTML = '';
        if(emptyState) emptyState.classList.remove('hidden');
        const pagContainer = document.getElementById('dashboard-pagination-container');
        if(pagContainer) pagContainer.classList.add('hidden');
        return;
    }
    if(emptyState) emptyState.classList.add('hidden');
    
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / dashboardItemsPerPage);
    if(dashboardCurrentPage > totalPages) dashboardCurrentPage = Math.max(1, totalPages);
    
    const startIdx = (dashboardCurrentPage - 1) * dashboardItemsPerPage;
    const endIdx = startIdx + dashboardItemsPerPage;
    const paginatedItems = filtered.slice(startIdx, endIdx);
    
    const pagContainer = document.getElementById('dashboard-pagination-container');
    if(pagContainer) pagContainer.classList.remove('hidden');
    
    const pagInfo = document.getElementById('dashboard-pagination-info');
    if(pagInfo) pagInfo.innerText = `Showing page ${dashboardCurrentPage} of ${totalPages} (${totalItems} items)`;
    
    buildPaginationUI('dashboard-pagination-controls', totalPages, dashboardCurrentPage, 'dashboard');

    tableBody.innerHTML = '';
    mobileCards.innerHTML = '';
    
    paginatedItems.forEach(entry => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50/80 transition border-b border-slate-100";
        
        let statusBadge = entry.status === 'Selesai' 
            ? `<span class="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">Completed ✅</span>`
            : `<span class="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200">Pending ⏳</span>`;
            
        let photosMarkup = '';
        if(entry.photos && entry.photos.length > 0) {
            photosMarkup = `<div class="flex gap-1 mt-1.5">` + entry.photos.map(p => `<img src="${p}" class="w-7 h-7 object-cover rounded shadow-inner cursor-pointer" onclick="openLightbox('${p}')">`).join('') + `</div>`;
        }
        
        let updatesBadge = '';
        if(entry.updates && entry.updates.length > 0) {
            updatesBadge = `<span class="block text-[9px] text-indigo-600 mt-1 font-bold">⏱ Updated ${entry.updates.length}x</span>`;
        }

        tr.innerHTML = `
            <td class="py-4 px-5"><div>${entry.date}</div><div class="text-[10px] text-slate-400 mt-0.5">${entry.shift}</div></td>
            <td class="py-4 px-5"><div>${entry.specialty}</div><div class="text-[10px] text-slate-400 mt-0.5">${entry.maintenanceType}</div></td>
            <td class="py-4 px-5"><div>${entry.timeStart} - ${entry.timeFinish}</div></td>
            <td class="py-4 px-5 font-extrabold text-slate-900">${entry.technician}</td>
            <td class="py-4 px-5"><div><span class="px-1.5 py-0.5 bg-slate-100 border rounded text-[10px]">${entry.category}</span></div><div class="mt-1 font-extrabold text-slate-700">${entry.area}</div></td>
            <td class="py-4 px-5 max-w-xs"><p class="line-clamp-2">${entry.detail}</p>${photosMarkup}</td>
            <td class="py-4 px-5 text-center">${statusBadge}${updatesBadge}</td>
            <td class="py-4 px-5 text-right space-x-1 whitespace-nowrap">
                <button onclick="viewReportDetail('${entry.id}')" class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition" title="View Details">👁</button>
                <button onclick="openModalEditLaporan('${entry.id}')" class="p-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg transition" title="Update Log">✏️</button>
                ${currentSession && currentSession.role === 'admin' ? `<button onclick="deleteEntry('${entry.id}')" class="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition" title="Delete">🗑</button>` : ''}
            </td>
        `;
        tableBody.appendChild(tr);

        const card = document.createElement('div');
        card.className = "p-4 space-y-3 bg-white";
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <span class="px-2 py-0.5 bg-slate-100 border text-[10px] rounded-md uppercase font-bold text-slate-500">${entry.category}</span>
                    <h5 class="font-extrabold text-slate-900 mt-1">${entry.area}</h5>
                </div>
                ${statusBadge}
            </div>
            <p class="text-xs text-slate-600 line-clamp-3 leading-relaxed">${entry.detail}</p>
            ${entry.photos && entry.photos.length > 0 ? `<div class="flex gap-1.5">` + entry.photos.map(p => `<img src="${p}" class="w-10 h-10 object-cover rounded-xl shadow-inner cursor-pointer" onclick="openLightbox('${p}')">`).join('') + `</div>` : ''}
            <div class="flex justify-between items-center text-[10px] text-slate-400 pt-2 border-t border-slate-50 font-medium">
                <div>By <strong class="text-slate-600">${entry.technician}</strong> • ${entry.shift}</div>
                <div>${entry.date}</div>
            </div>
            <div class="flex justify-end gap-1 pt-1">
                <button onclick="viewReportDetail('${entry.id}')" class="px-3 py-1.5 bg-slate-100 rounded-xl text-slate-700 text-xs font-bold">Detail</button>
                <button onclick="openModalEditLaporan('${entry.id}')" class="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-xl text-xs font-bold">Update</button>
                ${currentSession && currentSession.role === 'admin' ? `<button onclick="deleteEntry('${entry.id}')" class="px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold">Hapus</button>` : ''}
            </div>
        `;
        mobileCards.appendChild(card);
    });

    if (typeof renderSystemUsersList === "function") renderSystemUsersList();
    lucide.createIcons();
}

function updateStatistics(arr) {
    const sTotal = document.getElementById('stat-total');
    const sSelesai = document.getElementById('stat-selesai');
    const sPending = document.getElementById('stat-pending');
    if(sTotal) sTotal.innerText = arr.length;
    if(sSelesai) sSelesai.innerText = arr.filter(e => e.status === 'Selesai').length;
    if(sPending) sPending.innerText = arr.filter(e => e.status === 'Pending').length;
}

function buildPaginationUI(controlsId, totalPages, currentPage, coreType) {
    const controls = document.getElementById(controlsId);
    if(!controls) return;
    controls.innerHTML = '';
    
    const prevBtn = document.createElement('button');
    prevBtn.className = `p-1.5 rounded-lg border text-xs font-bold ${currentPage === 1 ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-white text-slate-600 hover:bg-slate-50'}`;
    prevBtn.innerText = '◀';
    prevBtn.onclick = () => { if(currentPage > 1) triggerPageChange(currentPage - 1, coreType); };
    controls.appendChild(prevBtn);
    
    for(let i=1; i<=totalPages; i++) {
        if(totalPages > 5 && Math.abs(i - currentPage) > 1 && i !== 1 && i !== totalPages) {
            if(i === 2 || i === totalPages - 1) {
                const dots = document.createElement('span');
                dots.className = "text-slate-400 text-xs px-1";
                dots.innerText = '...';
                controls.appendChild(dots);
            }
            continue;
        }
        const btn = document.createElement('button');
        btn.className = `px-2.5 py-1 rounded-lg text-xs font-black ${i === currentPage ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-slate-600 border hover:bg-slate-50'}`;
        btn.innerText = i;
        btn.onclick = () => triggerPageChange(i, coreType);
        controls.appendChild(btn);
    }
    
    const nextBtn = document.createElement('button');
    nextBtn.className = `p-1.5 rounded-lg border text-xs font-bold ${currentPage === totalPages ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-white text-slate-600 hover:bg-slate-50'}`;
    nextBtn.innerText = '▶';
    nextBtn.onclick = () => { if(currentPage < totalPages) triggerPageChange(currentPage + 1, coreType); };
    controls.appendChild(nextBtn);
}

function triggerPageChange(targetPage, coreType) {
    if(coreType === 'dashboard') {
        dashboardCurrentPage = targetPage;
        renderData();
    } else {
        paginatedSearchCurrentPage = targetPage;
        if (typeof renderPaginatedSearchModalTable === "function") renderPaginatedSearchModalTable();
    }
}

// ==========================================
// APPLY FILTERS & SEARCH PROCESS
// ==========================================
function applyFilters(shouldTriggerPopUpModal) {
    dashboardCurrentPage = 1;
    paginatedSearchCurrentPage = 1;
    renderData();
    
    if(shouldTriggerPopUpModal && lastFilteredEntriesGlobal.length > 0) {
        const pModal = document.getElementById('paginated-search-modal');
        if(pModal) pModal.classList.remove('hidden');
        if (typeof renderPaginatedSearchModalTable === "function") renderPaginatedSearchModalTable();
    }
}

function clearFilters() {
    initDefaultDates();
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-status').value = '';
    dashboardCurrentPage = 1;
    renderData();
    showAlert('Filter pencarian berhasil direset.', 'success');
}

function deleteEntry(id) {
    if(!confirm('Apakah anda yakin ingin menghapus data laporan ini secara permanen?')) return;
    logbookEntries = logbookEntries.filter(e => e.id !== id);
    saveToLocalStorage();
    renderData();
    showAlert('Laporan berhasil dihapus dari sistem lokal.', 'success');
}

// ==========================================
// DETAILED REPORT VIEW POP-UP
// ==========================================
function viewReportDetail(id) {
    const entry = logbookEntries.find(e => e.id === id);
    if(!entry) return;
    
    const m = document.getElementById('detail-modal');
    const body = document.getElementById('detail-modal-body');
    if (!m || !body) return;
    
    let statusBadge = entry.status === 'Selesai' 
        ? `<span class="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold border border-emerald-200">Completed ✅</span>`
        : `<span class="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold border border-amber-200">Pending ⏳</span>`;

    let photosList = '- Tidak ada lampiran foto -';
    if(entry.photos && entry.photos.length > 0) {
        photosList = `<div class="grid grid-cols-3 gap-2 mt-1">` + entry.photos.map(p => `<img src="${p}" class="rounded-xl border object-cover h-20 w-full shadow cursor-pointer" onclick="openLightbox('${p}')">`).join('') + `</div>`;
    }

    let updatesHistoryMarkup = '';
    if(entry.updates && entry.updates.length > 0) {
        updatesHistoryMarkup = `
            <div class="mt-4 pt-4 border-t border-slate-200">
                <h4 class="font-black text-indigo-950 uppercase text-[10px] tracking-wider mb-2 flex items-center gap-1">⏱ Riwayat Perkembangan Kerja (${entry.updates.length})</h4>
                <div class="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    ${entry.updates.map((up, idx) => `
                        <div class="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100 text-[11px]">
                            <div class="flex justify-between font-bold text-indigo-900 mb-1">
                                <span>Update #${idx + 1} (${up.status})</span>
                                <span>${up.timeStart} - ${up.timeFinish}</span>
                            </div>
                            <p class="text-slate-600 font-medium whitespace-pre-wrap">${up.detail}</p>
                            ${up.photos && up.photos.length > 0 ? `<div class="flex gap-1 mt-2">` + up.photos.map(ph => `<img src="${ph}" class="w-8 h-8 object-cover rounded shadow-inner cursor-pointer" onclick="openLightbox('${ph}')">`).join('') + `</div>` : ''}
                            <div class="text-[9px] text-slate-400 mt-1.5 font-bold uppercase">Oleh Teknisi: ${up.technician || entry.technician} • ${up.shift}</div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
    }

    body.innerHTML = `
        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-2 gap-3">
            <div><span class="text-slate-400 block text-[9px] font-bold uppercase">Report ID:</span> <strong class="font-mono text-slate-900">${entry.id}</strong></div>
            <div class="text-right">${statusBadge}</div>
            <div><span class="text-slate-400 block text-[9px] font-bold uppercase">Tanggal:</span> <span class="font-semibold text-slate-700">${entry.date} (${entry.shift})</span></div>
            <div><span class="text-slate-400 block text-[9px] font-bold uppercase">Waktu Kerja:</span> <span class="font-semibold text-slate-700">${entry.timeStart} - ${entry.timeFinish}</span></div>
            <div><span class="text-slate-400 block text-[9px] font-bold uppercase">Kategori & Area:</span> <span class="font-extrabold text-slate-800">[${entry.category}] ${entry.area}</span></div>
            <div><span class="text-slate-400 block text-[9px] font-bold uppercase">Spesialisasi:</span> <span class="font-semibold text-slate-700">${entry.specialty}</span></div>
            <div class="col-span-2"><span class="text-slate-400 block text-[9px] font-bold uppercase">Jenis Maintenance:</span> <span class="font-semibold text-slate-700">${entry.maintenanceType}</span></div>
            <div class="col-span-2"><span class="text-slate-400 block text-[9px] font-bold uppercase">Teknisi Penanggung Jawab:</span> <span class="font-black text-orange-600">${entry.technician}</span></div>
        </div>
        <div class="mt-4">
            <h4 class="font-black text-slate-900 uppercase text-[10px] tracking-wider mb-1">📝 Uraian Detail Pekerjaan</h4>
            <p class="text-xs text-slate-600 bg-white border p-3 rounded-2xl font-medium leading-relaxed whitespace-pre-wrap">${entry.detail}</p>
        </div>
        ${entry.adminNotes ? `
        <div class="mt-4 bg-amber-50 border border-amber-200 p-3 rounded-2xl">
            <h4 class="font-black text-amber-900 uppercase text-[10px] tracking-wider mb-1">📌 Catatan / Evaluasi Admin</h4>
            <p class="text-xs text-amber-800 font-medium whitespace-pre-wrap">${entry.adminNotes}</p>
        </div>` : ''}
        <div class="mt-4">
            <h4 class="font-black text-slate-900 uppercase text-[10px] tracking-wider mb-1">🖼 Lampiran Foto Dokumentasi</h4>
            ${photosList}
        </div>
        ${updatesHistoryMarkup}
    `;
    if(m) m.classList.remove('hidden');
}

function closeReportDetailModal() {
    const m = document.getElementById('detail-modal');
    if(m) m.classList.add('hidden');
}

// ==========================================
// LOGIKA SINKRONISASI & SENSITIVITAS BANNER
// ==========================================
function checkSyncBannerVisibility() {
    const banner = document.getElementById('sync-banner');
    if (!banner) return; 

    const savedURL = localStorage.getItem('he_sheets_url') || '';
    const currentURL = savedURL.trim() || googleSheetsURL.trim();
    
    if (!currentURL || currentURL === "") {
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

function updateSyncStatusUI(isConnected) {
    const indicator = document.getElementById('sync-status-indicator');
    if (indicator) {
        if (isConnected) {
            indicator.innerText = "Connected to Cloud Database";
            indicator.className = "text-xs font-bold text-emerald-600 flex items-center gap-1";
        } else {
            indicator.innerText = "Offline Mode / Disconnected";
            indicator.className = "text-xs font-bold text-amber-600 flex items-center gap-1";
        }
    }
    checkSyncBannerVisibility();
}

// ====================================================================
// FUNGSI UTAMA BARU: SINGLE SYNC & DUAL RANGE OPTIMIZATION (ANTI LEMOT)
// ====================================================================
async function syncDataWithSheets() {
    const syncIcon = document.getElementById("sync-icon");
    if(syncIcon) syncIcon.classList.add("animate-spin");

    if (!googleSheetsURL) {
        if(syncIcon) syncIcon.classList.remove("animate-spin");
        return;
    }

    // Mendeteksi jangkauan pencarian dari elemen select #sync-range di HTML
    const rangeElement = document.getElementById("sync-range");
    const rangeTarget = rangeElement ? rangeElement.value : "30days";

    try {
        // Jalur 1: Mengambil Data Logbook Sesuai Range Target (30 Hari / Semua)
        const resLog = await fetch(`${googleSheetsURL}?action=getLogbook&range=${rangeTarget}`).then(r => r.json());
        if (resLog.status === "success") {
            logbookEntries = resLog.data;
        }

        // Jalur 2: Hanya mengambil data manajemen user jika akun yang login berstatus Admin
        if (currentSession && currentSession.role === 'admin') {
            const resUsers = await fetch(`${googleSheetsURL}?action=getUsers`).then(r => r.json());
            if (resUsers.status === "success") {
                userAccounts = resUsers.data;
            }
        }

        // Jalur 3: Sinkronisasi Parameter Dropdown (Dilakukan sekali saat pertama kali kosong)
        if (dropdownSpecialties.length <= 6 || dropdownMaintenanceTypes.length <= 4) {
            const [resSpec, resMaint] = await Promise.all([
                fetch(`${googleSheetsURL}?action=getSpecialties`).then(r => r.json()),
                fetch(`${googleSheetsURL}?action=getMaintenances`).then(r => r.json())
            ]);
            
            if (resSpec.status === "success" && resSpec.data.length > 0) {
                dropdownSpecialties = resSpec.data.map(s => s.name || s);
            }
            if (resMaint.status === "success" && resMaint.data.length > 0) {
                dropdownMaintenanceTypes = resMaint.data.map(m => m.name || m);
            }
        }

        saveToLocalStorage();
        renderData();
        updateSyncStatusUI(true);

    } catch (e) {
        console.error("Gagal melakukan sinkronisasi dengan Google Sheets:", e);
        updateSyncStatusUI(false);
    }

    if(syncIcon) syncIcon.classList.remove("animate-spin");
}

function pullDataFromSheetsSilently() {
    // Dipetakan ulang menuju fungsi sync teroptimasi agar integrasi seragam
    syncDataWithSheets();
}

function showAlert(message, type = 'success') {
    alert(`[${type.toUpperCase()}] ${message}`);
}