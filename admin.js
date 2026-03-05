// ─── STATE MANAGEMENT ─────────────────────────────────────────────
const state = {
    pat: localStorage.getItem('nem_gh_pat') || '',
    gistId: localStorage.getItem('nem_gist_id') || '',
    data: null,
    editingItem: null, // { type: 'member|merch|event', index: -1 }
    entryPin: localStorage.getItem('nem_admin_pin') || '',
};

// ─── CRYPTO HELPERS ────────────────────────────────────────────────
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const DEFAULT_DATA = {
    siteTitle: "NEM — Núcleo de Engenharia Mecânica | ESTG-IPLeiria",
    shortName: "NEM",
    // NOTE: adminPin is stored as a SHA-256 hash. The plain-text default is "!NEM2425mec!"
    adminPin: "7fe1d6ace3d495308f87164649002ae7222340669076b18fd8db2033aef73056",
    mandateYear: "2025/2026",
    heroTitle: "Núcleo de Engenharia Mecânica",
    heroDescription: "Representamos os estudantes de Engenharia Mecânica da ESTG - IPLeiria. Inovação, tradição e futuro.",
    aboutText: "O NEM é o órgão representativo dos alunos de Engenharia Mecânica na Escola Superior de Tecnologia e Gestão de Leiria. O nosso objetivo é dinamizar a vida académica, promover parcerias com a indústria e apoiar os estudantes em todas as frentes.",
    footerOrgName: "NEM ESTG",
    socials: {
        instagram: "https://www.instagram.com/nem_estg/",
        email: "nem.estg@my.ipleiria.pt"
    },
    sections: {
        about: true,
        members: true,
        merch: true,
        calendar: true,
        instagram: false
    },
    sectionOrder: ["about", "members", "merch", "calendar", "instagram"],
    customSections: [], // [{id, label, icon, content}]
    libraryCourses: [], // [{name, src}]
    libraryBars: [], // [{name, src}]
    instagramPosts: [],
    githubUploadOwner: '',
    githubUploadRepo: '',
    members: [
        { name: "João Silva", role: "Presidente", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400", ig: "@joaosilva" },
        { name: "Maria Santos", role: "Vice-Presidente", photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400", ig: "@mariasantos" },
        { name: "Ricardo Pereira", role: "Tesoureiro", photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400", ig: "@ricardo_p" }
    ],
    merch: [
        { name: "Hoodie NEM 25/26", price: "20", description: "Design exclusivo do mandato atual. Algodão de alta qualidade.", image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400", formUrl: "#" },
        { name: "T-Shirt Mecânica", price: "12", description: "O clássico que nunca falha. Disponível em várias cores.", image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400", formUrl: "#" }
    ],
    events: [
        { title: "Workshop SolidWorks", date: "15 Outubro", dateISO: "2026-10-15", status: "Confirmado", location: "Laboratório de CAD", formUrl: "" },
        { title: "Visita de Estudo: Autoeuropa", date: "22 Novembro", dateISO: "2026-11-22", status: "Em discussão", location: "Palmela", formUrl: "" }
    ]
};

// ─── SECTION METADATA ─────────────────────────────────────────────
const BUILTIN_SECTION_META = {
    about: { label: 'Quem Somos', icon: 'fa-info-circle' },
    members: { label: 'Equipa', icon: 'fa-users' },
    merch: { label: 'Merchandise', icon: 'fa-tshirt' },
    calendar: { label: 'Atividades', icon: 'fa-calendar-alt' },
    instagram: { label: 'Instagram', icon: 'fa-instagram fab' }
};

// Build the full SECTION_META including custom sections from state
function getSectionMeta() {
    const meta = { ...BUILTIN_SECTION_META };
    if (state.data && state.data.customSections) {
        state.data.customSections.forEach(cs => {
            meta[cs.id] = { label: cs.label, icon: cs.icon, isCustom: true };
        });
    }
    return meta;
}

// ─── INITIALIZATION ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
    setupModeToggle();
});

function checkAuth() {
    if (!state.pat || !state.gistId || !state.entryPin) {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('admin-dashboard').style.display = 'none';
    } else {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-dashboard').style.display = 'grid';
        loadData();
    }
}

// ─── DATA SYNC ────────────────────────────────────────────────────
async function loadData() {
    toggleLoading(true);
    try {
        const response = await fetch(`https://api.github.com/gists/${state.gistId}`, {
            headers: { 'Authorization': `token ${state.pat}` }
        });

        if (!response.ok) {
            if (response.status === 401) throw new Error('Token inválido');
            if (response.status === 404) {
                alert('Gist não encontrado. Verifica o ID.');
                logout();
                return;
            }
            throw new Error('Falha ao aceder ao Gist');
        }

        const gist = await response.json();
        const file = gist.files['data.json'];

        if (!file) {
            const ok = await customConfirm('O ficheiro data.json não existe neste Gist. Criar com valores padrão?', 'Gist Vazio');
            if (ok) {
                state.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
                await saveData();
            } else {
                logout();
            }
        } else {
            const rawData = JSON.parse(file.content) || {};
            state.data = {
                ...DEFAULT_DATA,
                ...rawData,
                sections: { ...DEFAULT_DATA.sections, ...(rawData.sections || {}) },
                socials: { ...DEFAULT_DATA.socials, ...(rawData.socials || {}) }
            };
            if (!state.data.sectionOrder || state.data.sectionOrder.length === 0) {
                state.data.sectionOrder = [...DEFAULT_DATA.sectionOrder];
            }
            if (!state.data.instagramPosts) state.data.instagramPosts = [];
            if (!state.data.customSections) state.data.customSections = [];
            if (!state.data.libraryCourses) state.data.libraryCourses = [];
            if (!state.data.libraryBars) state.data.libraryBars = [];
            // Ensure custom section IDs are in sectionOrder
            state.data.customSections.forEach(cs => {
                if (!state.data.sectionOrder.includes(cs.id)) {
                    state.data.sectionOrder.push(cs.id);
                }
            });
        }

        // Secondary Security Check — supports both legacy plain-text PINs and SHA-256 hashes
        const storedPin = state.data.adminPin;
        if (storedPin) {
            const isHash = /^[a-f0-9]{64}$/.test(storedPin); // SHA-256 produces 64 hex chars
            let pinOk = false;

            if (isHash) {
                // Modern path: compare hashes
                const enteredHash = await sha256(state.entryPin);
                pinOk = (enteredHash === storedPin);
            } else {
                // Legacy path: plain-text PIN stored in Gist (auto-migrates on save)
                pinOk = (state.entryPin === storedPin);
                if (pinOk) {
                    // Upgrade to hash immediately so next load is secure
                    state.data.adminPin = await sha256(state.entryPin);
                    console.info('Admin PIN migrated from plain-text to SHA-256 hash.');
                }
            }

            if (!pinOk) {
                alert('PIN de Administrador incorreto. Acesso negado.');
                logout();
                return;
            }
        }

        fillForms();
        renderAdminLists();
        renderLayoutTab();
        renderNativeLivePreviews();
    } catch (err) {
        console.error(err);
        showToast('Erro ao carregar dados: ' + err.message, 'danger');
        // Only log out for auth errors, not data/render errors
        if (err.message === 'Token inválido' || err.message === 'Falha ao aceder ao Gist') {
            logout();
        }
    } finally {
        toggleLoading(false);
    }
}


async function saveData() {
    toggleLoading(true);
    try {
        await updateDataFromForms();

        const response = await fetch(`https://api.github.com/gists/${state.gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${state.pat}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    'data.json': {
                        content: JSON.stringify(state.data, null, 2)
                    }
                }
            })
        });

        if (!response.ok) throw new Error('Falha ao guardar no GitHub');
        showToast('Alterações guardadas!');
    } catch (err) {
        alert('Erro ao guardar: ' + err.message);
    } finally {
        toggleLoading(false);
    }
}

// ─── GIST EXPORT / IMPORT ─────────────────────────────────────────

function exportGist() {
    if (!state.data) {
        showToast('Não há dados para exportar.', 'danger');
        return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.data, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `nem_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Download do backup iniciado!', 'success');
}

function importGist() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.style.display = 'none';

    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const ok = await customConfirm('Tens a certeza que queres importar e SOBRESCREVER tudo pelo ficheiro selecionado?', 'Atenção');
        if (!ok) return;

        const reader = new FileReader();
        reader.onload = async function (evt) {
            try {
                const importedData = JSON.parse(evt.target.result);
                // Validate if it roughly looks like our app state
                if (!importedData.sections || typeof importedData.sections !== 'object') {
                    throw new Error('Formato JSON inválido.');
                }

                state.data = importedData;
                fillForms();
                renderLayoutTab();
                renderAdminLists();
                renderNativeLivePreviews();
                saveData(); // Save back to Gist remotely immediately

                showToast('Backup importado com sucesso!');
            } catch (err) {
                showToast('Ocorreu um erro ao ler o ficheiro: ' + err.message, 'danger');
            }
        };
        reader.readAsText(file);
    });

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
}

// ─── CUSTOM DIALOGS (replaces browser's confirm/prompt) ──────────
function customConfirm(message, title = 'Confirmar') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        document.getElementById('custom-confirm-title').textContent = title;
        document.getElementById('custom-confirm-msg').textContent = message;
        modal.style.display = 'flex';

        const ok = document.getElementById('custom-confirm-ok');
        const cancel = document.getElementById('custom-confirm-cancel');

        function cleanup(result) {
            modal.style.display = 'none';
            ok.replaceWith(ok.cloneNode(true));
            cancel.replaceWith(cancel.cloneNode(true));
            resolve(result);
        }

        document.getElementById('custom-confirm-ok').addEventListener('click', () => cleanup(true), { once: true });
        document.getElementById('custom-confirm-cancel').addEventListener('click', () => cleanup(false), { once: true });
    });
}

function customPrompt(label, current = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-prompt-modal');
        const input = document.getElementById('custom-prompt-input');
        document.getElementById('custom-prompt-title').textContent = label;
        input.value = current;
        modal.style.display = 'flex';
        setTimeout(() => input.focus(), 50);

        const ok = document.getElementById('custom-prompt-ok');
        const cancel = document.getElementById('custom-prompt-cancel');

        function cleanup(result) {
            modal.style.display = 'none';
            ok.replaceWith(ok.cloneNode(true));
            cancel.replaceWith(cancel.cloneNode(true));
            resolve(result);
        }

        document.getElementById('custom-prompt-ok').addEventListener('click', () => cleanup(input.value), { once: true });
        document.getElementById('custom-prompt-cancel').addEventListener('click', () => cleanup(null), { once: true });
        input.addEventListener('keydown', function handler(e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); cleanup(input.value); input.removeEventListener('keydown', handler); }
            if (e.key === 'Escape') { cleanup(null); input.removeEventListener('keydown', handler); }
        });
    });
}


function toggleLoading(show) {
    const loadingState = document.getElementById('loading-state');
    if (loadingState) loadingState.style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'animate-fade-in';
    toast.style.cssText = `
        background: ${type === 'success' ? 'var(--text-primary)' : 'var(--danger)'};
        color: #fff;
        padding: 12px 24px;
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-hover);
        margin-bottom: 12px;
        font-weight: 600;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 12px;
    `;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = 'all 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function extractIframeSrc(input) {
    if (!input) return '';
    if (input.includes('<iframe')) {
        const match = input.match(/src=["']([^"']+)["']/);
        return match ? match[1] : input;
    }
    return input.trim();
}

async function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        // SVGs can't be drawn on a canvas — read as Base64 data URL
        if (file.type === 'image/svg+xml' || file.name?.toLowerCase().endsWith('.svg')) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            return;
        }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
                } else {
                    if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
        };
    });
}

// ─── GITHUB REPO IMAGE UPLOADER ───────────────────────────────────
/**
 * Uploads a base64 data URL as a file to the GitHub repository.
 * Falls back to returning the original base64 if repo is not configured.
 * @param {string} base64DataUrl - The data URL from compressImage (e.g. data:image/jpeg;base64,...)
 * @param {string} type - Subfolder name: 'members', 'merch', 'partner_courses', 'bars', 'sections'
 * @returns {Promise<string>} - The public GitHub raw URL, or the original base64 as fallback.
 */
async function uploadImageToGithub(base64DataUrl, type) {
    const owner = state.data?.githubUploadOwner?.trim();
    const repo = state.data?.githubUploadRepo?.trim();

    // Fallback: if not configured, return base64 as-is
    if (!owner || !repo || !state.pat) {
        return base64DataUrl;
    }

    // Strip the data URL prefix to get raw base64 or decoded text
    const base64Content = base64DataUrl.split(',')[1];

    let ext = 'jpg';
    if (base64DataUrl.startsWith('data:image/png')) ext = 'png';
    else if (base64DataUrl.includes('svg')) ext = 'svg'; // handles both base64 and text variants
    else if (base64DataUrl.startsWith('data:image/webp')) ext = 'webp';
    else if (base64DataUrl.startsWith('data:image/gif')) ext = 'gif';

    // Unique filename with timestamp
    const filename = `${type}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
    const path = `assets/images/${type}/${filename}`;

    try {
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${state.pat}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: `Upload image: ${path}`,
                content: base64Content
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.warn('GitHub upload failed:', err.message || response.status);
            showToast('Upload para GitHub falhou, guardando localmente.', 'danger');
            return base64DataUrl; // fallback
        }

        const result = await response.json();
        // Use jsDelivr CDN to ensure correct MIME types (especially for SVGs)
        // Format: https://cdn.jsdelivr.net/gh/user/repo@main/file
        const rawUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@main/${path}`;
        return rawUrl;

    } catch (err) {
        console.error('GitHub upload error:', err);
        showToast('Erro de rede no upload, guardando localmente.', 'danger');
        return base64DataUrl; // fallback
    }
}

async function deleteImageFromGithub(url) {
    if (!url || url.startsWith('data:image')) return; // nothing to delete on github
    const owner = state.data?.githubUploadOwner?.trim();
    const repo = state.data?.githubUploadRepo?.trim();
    if (!owner || !repo || !state.pat) return;

    let path = '';

    try {
        if (url.includes('cdn.jsdelivr.net/gh/')) {
            const parts = url.split('@main/');
            if (parts.length > 1) path = parts[1];
        } else if (url.includes('raw.githubusercontent.com/')) {
            const repoPath = `${owner}/${repo}/main/`;
            if (url.includes(repoPath)) {
                path = url.split(repoPath)[1];
            }
        }

        if (!path) return; // couldn't parse path

        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

        // 1. We need the file's SHA to delete it
        const getRes = await fetch(apiUrl, {
            headers: {
                'Authorization': `token ${state.pat}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!getRes.ok) return; // file might already be gone

        const fileData = await getRes.json();

        // 2. Delete the file
        await fetch(apiUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${state.pat}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: `Delete image: ${path}`,
                sha: fileData.sha
            })
        });

    } catch (err) {
        console.error('Failed to delete image from GitHub:', err);
    }
}

window.migrateBase64ToGithub = async function () {
    const owner = state.data?.githubUploadOwner?.trim();
    const repo = state.data?.githubUploadRepo?.trim();
    if (!owner || !repo || !state.pat) {
        alert("Configura primeiro o Dono, Nome do Repositório e o teu PIN/Token para usar a migração.");
        return;
    }

    const ok = await customConfirm('Isto vai procurar todas as imagens pesadas (base64) guardadas no ficheiro de dados e enviá-las para o teu Github. Pode demorar alguns minutos. Queres continuar?', 'Migrar Imagens');
    if (!ok) return;

    // Help function to migrate a single field if it's base64/data URI
    // returns true if changed
    async function migrateField(obj, field, type) {
        if (!obj[field]) return false;
        if (!obj[field].startsWith('data:image')) return false;

        showToast('A migrar imagem para ' + type + '...', 'info');
        try {
            const url = await uploadImageToGithub(obj[field], type);
            if (url && !url.startsWith('data:image')) {
                obj[field] = url;
                return true;
            }
        } catch (e) { console.error('Migration failed for', type, e); }
        return false;
    }

    let changed = 0;
    try {
        // 1. Members
        for (const m of (state.data.members || [])) {
            if (await migrateField(m, 'photo', 'members')) changed++;
        }
        // 2. Merch
        for (const m of (state.data.merch || [])) {
            if (await migrateField(m, 'image', 'merch')) changed++;
            if (m.images) {
                for (let i = 0; i < m.images.length; i++) {
                    if (m.images[i] && m.images[i].startsWith('data:image')) {
                        showToast('A migrar galeria merch...', 'info');
                        const url = await uploadImageToGithub(m.images[i], 'merch');
                        if (url && !url.startsWith('data:image')) { m.images[i] = url; changed++; }
                    }
                }
            }
        }
        // 3. Events (convivios)
        for (const ev of (state.data.events || [])) {
            if (ev.type === 'convivio') {
                if (await migrateField(ev, 'nemLogo', 'events')) changed++;
                if (await migrateField(ev, 'guestLogo', 'events')) changed++;
                if (await migrateField(ev, 'barLogo', 'events')) changed++;
            }
        }
        // 4. Libraries
        for (const l of (state.data.libraryCourses || [])) {
            if (await migrateField(l, 'src', 'partner_courses')) changed++;
        }
        for (const l of (state.data.libraryBars || [])) {
            if (await migrateField(l, 'src', 'bars')) changed++;
        }
        // 5. Custom Sections (Visual Builder items)
        for (const sc of (state.data.customSections || [])) {
            if (!sc.content) continue;
            try {
                const parsed = JSON.parse(sc.content);
                if (parsed.items && Array.isArray(parsed.items)) {
                    let sectionChanged = false;
                    for (let i = 0; i < parsed.items.length; i++) {
                        let item = parsed.items[i];
                        if (typeof item === 'string') {
                            if (item.startsWith('data:image')) {
                                showToast('A migrar banner da secção...', 'info');
                                const url = await uploadImageToGithub(item, 'sections');
                                if (url && !url.startsWith('data:image')) { parsed.items[i] = url; sectionChanged = true; changed++; }
                            } else if (item.startsWith('{')) {
                                // e.g. logos JSON or gallery images JSON
                                try {
                                    let subObj = JSON.parse(item);
                                    let subChanged = false;
                                    // Logos obj: { nemLogo, guestLogo, barLogo }
                                    if (await migrateField(subObj, 'nemLogo', 'sections')) subChanged = true;
                                    if (await migrateField(subObj, 'guestLogo', 'sections')) subChanged = true;
                                    if (await migrateField(subObj, 'barLogo', 'sections')) subChanged = true;

                                    // Gallery obj: { type, url } // Wait, gallery is usually array of arrays or strings..
                                    // If we find any base64 properties inside objects, better to be explicit.
                                    if (Array.isArray(subObj)) {
                                        for (let j = 0; j < subObj.length; j++) {
                                            if (typeof subObj[j].url === 'string' && subObj[j].url.startsWith('data:image')) {
                                                if (await migrateField(subObj[j], 'url', 'sections')) subChanged = true;
                                            }
                                        }
                                    }

                                    if (subChanged) {
                                        parsed.items[i] = JSON.stringify(subObj);
                                        sectionChanged = true;
                                        changed++;
                                    }
                                } catch (e) { }
                            }
                        }
                    }
                    if (sectionChanged) {
                        sc.content = JSON.stringify(parsed);
                    }
                }
            } catch (e) { }
        }

        if (changed > 0) {
            saveData();
            showToast(`Migração concluída! Foram movidas ${changed} imagens para o GitHub.`, 'success');
            renderAdminLists();
            renderNativeLivePreviews();
        } else {
            showToast('Nenhuma imagem base64 encontrada para migrar.', 'info');
        }
    } catch (e) {
        console.error(e);
        showToast('Erro durante a migração. Parte dos dados podem estar por processar.', 'danger');
    }
}

async function handleFileUpload(input, targetId, isArray = false) {
    const file = input.files[0];
    if (!file) return;
    showToast('A processar imagem...', 'info');
    try {
        const base64 = await compressImage(file);
        const target = document.getElementById(targetId);
        if (isArray) {
            const current = target.value.trim();
            target.value = (current ? current + '\n' : '') + base64;
        } else {
            target.value = base64;
        }
        showToast('Imagem carregada!');
    } catch (err) {
        showToast('Erro ao carregar imagem', 'danger');
    }
}

async function updateDataFromForms() {
    if (!state.data) return;
    if (!state.data.socials) state.data.socials = {};

    const pinValue = document.getElementById('cfg-adminPin').value;
    if (pinValue) {
        state.data.adminPin = await sha256(pinValue);
        state.entryPin = pinValue;
        localStorage.setItem('nem_admin_pin', pinValue);
    }
    state.data.siteTitle = document.getElementById('cfg-siteTitle').value;
    state.data.shortName = document.getElementById('cfg-shortName').value;
    state.data.mandateYear = document.getElementById('cfg-mandateYear').value;
    state.data.footerOrgName = document.getElementById('cfg-footerOrgName').value;
    state.data.heroTitle = document.getElementById('cfg-heroTitle').value;
    state.data.heroDescription = document.getElementById('cfg-heroDescription').value;
    state.data.aboutText = document.getElementById('cfg-aboutText').value;
    state.data.socials.instagram = document.getElementById('cfg-socials-instagram').value;
    state.data.socials.email = document.getElementById('cfg-socials-email').value;

    // Sync the display-only email field in General tab
    const emailDisplay = document.getElementById('cfg-socials-email-display');
    if (emailDisplay) emailDisplay.value = state.data.socials.email;

    // GitHub Repo upload config
    const ghOwner = document.getElementById('cfg-githubUploadOwner');
    if (ghOwner) state.data.githubUploadOwner = ghOwner.value.trim();
    const ghRepo = document.getElementById('cfg-githubUploadRepo');
    if (ghRepo) state.data.githubUploadRepo = ghRepo.value.trim();

    // Instagram posts from Layout tab
    const igField = document.getElementById('cfg-instagramPosts');
    if (igField) {
        state.data.instagramPosts = igField.value
            .split('\n')
            .map(u => u.trim())
            .filter(u => u.startsWith('http'));
    }

    // Maintenance mode from General tab
    const maintToggle = document.getElementById('cfg-maintenanceMode');
    if (maintToggle) state.data.maintenanceMode = maintToggle.checked;
    const maintMsg = document.getElementById('cfg-maintenanceMessage');
    if (maintMsg && maintMsg.value.trim()) state.data.maintenanceMessage = maintMsg.value.trim();
}

// Instant-save maintenance toggle (doesn't wait for form Save button)
window.toggleMaintenanceMode = function (isOn) {
    state.data.maintenanceMode = isOn;
    const msgRow = document.getElementById('maintenance-message-row');
    if (msgRow) msgRow.style.display = isOn ? 'block' : 'none';
    saveData();
    showToast(isOn ? '🔧 Modo Manutenção ativado' : '✅ Site voltou ao normal', isOn ? 'danger' : 'success');
};


function fillForms() {
    const d = state.data;
    const s = d.socials || {};
    document.getElementById('cfg-adminPin').value = state.entryPin || '';
    document.getElementById('cfg-siteTitle').value = d.siteTitle || '';
    document.getElementById('cfg-shortName').value = d.shortName || '';
    document.getElementById('cfg-mandateYear').value = d.mandateYear || '';
    document.getElementById('cfg-footerOrgName').value = d.footerOrgName || '';
    document.getElementById('cfg-heroTitle').value = d.heroTitle || '';
    document.getElementById('cfg-heroDescription').value = d.heroDescription || '';
    document.getElementById('cfg-aboutText').value = d.aboutText || '';
    document.getElementById('cfg-socials-instagram').value = s.instagram || '';
    document.getElementById('cfg-socials-email').value = s.email || '';

    const emailDisplay = document.getElementById('cfg-socials-email-display');
    if (emailDisplay) emailDisplay.value = s.email || '';

    const igField = document.getElementById('cfg-instagramPosts');
    if (igField) igField.value = (d.instagramPosts || []).join('\n');

    // GitHub Repo upload config
    const ghOwner = document.getElementById('cfg-githubUploadOwner');
    if (ghOwner) ghOwner.value = d.githubUploadOwner || '';
    const ghRepo = document.getElementById('cfg-githubUploadRepo');
    if (ghRepo) ghRepo.value = d.githubUploadRepo || '';

    // Maintenance Mode
    const maintToggle = document.getElementById('cfg-maintenanceMode');
    if (maintToggle) {
        maintToggle.checked = !!d.maintenanceMode;
        const msgRow = document.getElementById('maintenance-message-row');
        if (msgRow) msgRow.style.display = d.maintenanceMode ? 'block' : 'none';
    }
    const maintMsg = document.getElementById('cfg-maintenanceMessage');
    if (maintMsg) maintMsg.value = d.maintenanceMessage || '';
}

// ─── SIMPLE / ADVANCED MODE ──────────────────────────────────────
function setupModeToggle() {
    const toggle = document.getElementById('mode-toggle');
    const labelSimple = document.getElementById('label-simple');
    const labelAdvanced = document.getElementById('label-advanced');
    const badge = document.getElementById('badge-mode');
    const dashboard = document.getElementById('admin-dashboard');

    // Restore saved preference (default: simple)
    const savedMode = localStorage.getItem('nem_admin_mode');
    const isAdvanced = savedMode === 'advanced';
    if (isAdvanced) toggle.checked = true;
    applyMode(isAdvanced, dashboard, labelSimple, labelAdvanced, badge);

    toggle.addEventListener('change', () => {
        const isAdvanced = toggle.checked;
        localStorage.setItem('nem_admin_mode', isAdvanced ? 'advanced' : 'simple');
        applyMode(isAdvanced, dashboard, labelSimple, labelAdvanced, badge);
    });
}

function applyMode(isAdvanced, dashboard, labelSimple, labelAdvanced, badge) {
    if (isAdvanced) {
        dashboard.classList.remove('simple-mode');
        labelSimple.classList.remove('active-label');
        labelAdvanced.classList.add('active-label');
        badge.textContent = 'Avançado';
        badge.className = 'badge-advanced';
    } else {
        dashboard.classList.add('simple-mode');
        labelSimple.classList.add('active-label');
        labelAdvanced.classList.remove('active-label');
        badge.textContent = 'Simples';
        badge.className = 'badge-simple';
    }
}

// ─── LAYOUT TAB ───────────────────────────────────────────────────
function renderLayoutTab() {
    renderVisibilityToggles();
    renderSectionOrder();
}

function renderVisibilityToggles() {
    const container = document.getElementById('visibility-toggles');
    if (!container) return;
    const sections = state.data.sections || {};
    const order = state.data.sectionOrder || Object.keys(BUILTIN_SECTION_META);
    const sectionMeta = getSectionMeta();

    container.innerHTML = order.map(key => {
        const meta = sectionMeta[key];
        if (!meta) return '';
        const isOn = sections[key] !== false;
        const isCustom = meta.isCustom;
        return `
        <div class="visibility-toggle-row">
            <div class="section-name">
                <i class="fas ${meta.icon}"></i>
                <span>${meta.label}</span>
                ${isCustom ? '<span style="font-size:0.7rem;background:var(--accent-glow);color:var(--accent);border-radius:20px;padding:1px 7px;font-weight:700;margin-left:6px;">Custom</span>' : ''}
            </div>
            <label class="toggle-switch">
                <input type="checkbox" id="vis-${key}" ${isOn ? 'checked' : ''}
                    onchange="onVisibilityChange('${key}', this.checked)">
                <span class="toggle-slider"></span>
            </label>
        </div>`;
    }).join('');
}

function onVisibilityChange(key, value) {
    if (!state.data.sections) state.data.sections = {};
    state.data.sections[key] = value;
    saveData();
}

function renderSectionOrder() {
    const list = document.getElementById('section-order-list');
    if (!list) return;
    const order = state.data.sectionOrder || Object.keys(BUILTIN_SECTION_META);
    const sectionMeta = getSectionMeta();

    list.innerHTML = order.map((key, idx) => {
        const meta = sectionMeta[key];
        if (!meta) return '';
        const isCustom = meta.isCustom;
        return `
        <div class="section-order-item" data-key="${key}">
            <i class="fas fa-grip-vertical" style="color: var(--text-tertiary); cursor: grab;"></i>
            <i class="fas ${meta.icon}" style="color: var(--text-tertiary); width: 16px;"></i>
            <span style="font-weight: 600;">${meta.label}</span>
            ${isCustom ? '<span style="font-size:0.7rem;background:var(--accent-glow);color:var(--accent);border-radius:20px;padding:1px 7px;font-weight:700;margin-left:4px;">Custom</span>' : ''}
            <div class="order-controls" style="display:flex;flex-direction:row;align-items:center;gap:4px;">
                <button class="btn-icon" onclick="moveSectionOrder('${key}', -1)" ${idx === 0 ? 'disabled' : ''} title="Mover para cima">
                    <i class="fas fa-chevron-up"></i>
                </button>
                <button class="btn-icon" onclick="moveSectionOrder('${key}', 1)" ${idx === order.length - 1 ? 'disabled' : ''} title="Mover para baixo">
                    <i class="fas fa-chevron-down"></i>
                </button>
                ${isCustom ? `<button class="btn-icon" onclick="editCustomSection('${key}')" title="Editar secção" style="color:var(--accent);">
                    <i class="fas fa-edit"></i>
                </button>
                <button type="button" class="btn-icon" onclick="event.preventDefault(); event.stopPropagation(); deleteCustomSection('${key}')" title="Apagar secção" style="color:var(--danger);">
                    <i class="fas fa-trash"></i>
                </button>` : ''}
            </div>
        </div>`;
    }).join('');
}

window.moveSectionOrder = function (key, direction) {
    const order = state.data.sectionOrder;
    const idx = order.indexOf(key);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= order.length) return;

    // Swap
    [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
    state.data.sectionOrder = order;

    renderSectionOrder();
    renderVisibilityToggles(); // Keep visibility list in sync with order
    saveData();
};

// ─── CUSTOM SECTIONS ──────────────────────────────────────────────
// ─── CUSTOM DROPDOWN SELECT ───────────────────────────────────────
window.toggleCustomSelect = function () {
    const options = document.getElementById('ns-icon-options');
    options.classList.toggle('open');
};

window.selectSectionType = function (el) {
    const val = el.dataset.value;
    const text = el.textContent;
    document.getElementById('ns-icon-display').textContent = text.split(' -')[0];
    document.getElementById('ns-icon-options').classList.remove('open');

    // Update the visual builder state
    builderState.icon = val;
    builderState.editingIndex = null;

    // Provide sensible default placeholders for the new type
    if (['fa-file-alt', 'fa-newspaper', 'fa-map-marker-alt', 'fa-star', 'fa-bullhorn'].includes(val)) {
        builderState.items = ['Nova Secção de Texto'];
    } else if (val === 'fa-clipboard-list' || val === 'fa-trophy') {
        builderState.items = ['Item 1', 'Item 2'];
    } else if (['fa-link', 'fa-book'].includes(val)) {
        builderState.items = ['Nome do Botão | https://exemplo.com'];
    } else if (val === 'fa-question-circle') {
        builderState.items = ['Qual é a pergunta? | Escreve aqui a tua resposta.'];
    } else if (val === 'fa-glass-cheers') {
        builderState.items = [
            'Nome do Convívio | Data e Hora | Local | Info das Senhas',
            JSON.stringify({ nemLogo: 'Vetorizado.svg', guestLogo: '', barLogo: '' })
        ];
    } else {
        // Galeria or Parcerias (images) start empty to show the add button
        builderState.items = [];
    }

    renderBuilderPreview();
    updateSimpleLayoutFields();
};

document.addEventListener('click', (e) => {
    const wrapper = e.target.closest('.custom-select-wrapper');
    if (!wrapper) {
        const options = document.getElementById('ns-icon-options');
        if (options && options.classList.contains('open')) {
            options.classList.remove('open');
        }
    }
});

// ─── VISUAL BUILDER STATE & LOGIC ─────────────────────────────────

let builderState = {
    icon: 'fa-file-alt',
    items: [], // Array of strings (text paragraphs, image urls, FAQ pairs, Link pairs, etc)
    editingIndex: -1
};

window.updateSimpleLayoutFields = function () {
    const icon = builderState.icon;
    const label = document.getElementById('ns-simple-data-label');
    const hint = document.getElementById('ns-simple-hint');

    // Only update hint/labels if there is a hint element (we might have removed it in the UI)
    if (label) {
        if (['fa-file-alt', 'fa-newspaper', 'fa-map-marker-alt'].includes(icon)) {
            label.textContent = 'Texto da Secção';
            if (hint) hint.textContent = 'O texto será apresentado de forma simples. Podes usar parágrafos.';
        } else if (['fa-star', 'fa-bullhorn'].includes(icon)) {
            label.textContent = 'Mensagem de Destaque';
            if (hint) hint.textContent = 'Esta mensagem aparecerá num cartão de destaque com cor de fundo.';
        } else if (['fa-images', 'fa-handshake'].includes(icon)) {
            label.textContent = 'Galeria (Imagens ou Logos)';
            if (hint) hint.textContent = 'Clica no botão "+" para adicionar imagens.';
        } else if (['fa-link', 'fa-book'].includes(icon)) {
            label.textContent = 'Lista de Links';
            if (hint) hint.innerHTML = 'Define o texto e o link correspondente.';
        } else if (icon === 'fa-question-circle') {
            label.textContent = 'Perguntas Atuais (FAQs)';
            if (hint) hint.innerHTML = 'Define a pergunta e a resposta.';
        } else if (['fa-clipboard-list', 'fa-trophy'].includes(icon)) {
            label.textContent = 'Itens da Lista';
            if (hint) hint.textContent = 'Adiciona, edita ou remove os tópicos da lista.';
        } else if (icon === 'fa-glass-cheers') {
            label.textContent = 'Detalhes do Convívio & Logos';
            if (hint) hint.innerHTML = 'Preenche os dados base. Clica num espaço de logo para escolher do teu arquivo.';
        } else {
            label.textContent = 'Dados da Secção';
            if (hint) hint.textContent = '';
        }
    }

    renderBuilderPreview();
};

window.renderBuilderPreview = function () {
    const container = document.getElementById('ns-builder-preview');
    if (!container) return;
    const icon = builderState.icon;
    const label = document.getElementById('ns-label').value.trim() || 'Nova Secção';
    let contentHtml = '';

    if (['fa-file-alt', 'fa-newspaper', 'fa-map-marker-alt'].includes(icon)) {
        // Simple Text Paragraphs
        const textBreaks = builderState.items.join('\n').replace(/\n/g, '<br>');
        contentHtml = `<p class="builder-editable" contenteditable="true" onclick="startBuilderEdit(this, 0)" onblur="endBuilderEdit(this, 0, 'text')" tabindex="0" style="color: var(--text-secondary); line-height: 1.8; margin: 0; min-height: 40px;">${textBreaks}</p>`;

    } else if (['fa-star', 'fa-bullhorn'].includes(icon)) {
        // Highlight Card
        const isWarn = icon === 'fa-bullhorn';
        const bg = isWarn ? 'rgba(230, 162, 60, 0.1)' : 'var(--accent-glow)';
        const border = isWarn ? '#E6A23C' : 'var(--accent)';
        const color = isWarn ? '#E6A23C' : 'var(--accent)';
        const textBreaks = builderState.items.join('\n').replace(/\n/g, '<br>');
        contentHtml = `<div style="background: ${bg}; padding: 24px; border-radius: var(--radius-sm); border-left: 4px solid ${border};">
            <p class="builder-editable" contenteditable="true" onclick="startBuilderEdit(this, 0)" onblur="endBuilderEdit(this, 0, 'text')" tabindex="0" style="margin: 0; font-size: 1.1rem; color: ${color}; font-weight: 500; min-height: 30px;">${textBreaks}</p>
        </div>`;

    } else if (icon === 'fa-images') {
        const imgs = builderState.items.map((u, i) => {
            return `<div class="builder-image-wrapper" style="width: 100%; height: 250px;">
                <img src="${u}" style="width: 100%; height: 100%; object-fit: cover;">
                <button class="delete-img-btn" onclick="removeBuilderItem(${i})" title="Remover"><i class="fas fa-trash"></i></button>
            </div>`;
        }).join('');

        const addBtn = `<div class="builder-add-item" onclick="document.getElementById('ns-builder-image-input').click()" style="height: 250px;">
            <div><i class="fas fa-plus" style="font-size: 1.5rem; margin-bottom: 8px;"></i><br>Adicionar</div>
        </div>`;

        contentHtml = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px;">${imgs}${addBtn}</div>`;

    } else if (icon === 'fa-handshake') {
        const logos = builderState.items.map((u, i) => {
            return `<div class="builder-image-wrapper" style="padding: 16px; background: white; display: flex; align-items: center; justify-content: center;">
                <img src="${u}" style="max-height: 80px; max-width: 180px; object-fit: contain;">
                <button class="delete-img-btn" onclick="removeBuilderItem(${i})" title="Remover"><i class="fas fa-trash"></i></button>
            </div>`;
        }).join('');

        const addBtn = `<div class="builder-add-item" onclick="document.getElementById('ns-builder-image-input').click()" style="width: 180px; height: 100px; border-radius: 0;">
            <div><i class="fas fa-plus"></i> Logo</div>
        </div>`;
        contentHtml = `<div style="display: flex; gap: 40px; flex-wrap: wrap; align-items: center; justify-content: center; padding: 32px 0;">${logos}${addBtn}</div>`;

    } else if (['fa-link', 'fa-book'].includes(icon)) {
        // Link Buttons
        const btns = builderState.items.map((l, i) => {
            const parts = l.split('|');
            const t = parts[0]?.trim() || 'Link';
            const u = parts[1]?.trim() || 'https://';
            return `<div style="display: flex; gap: 8px; align-items: center;">
                <div class="btn btn-secondary" style="flex: 1; display: flex; justify-content: space-between; align-items: center; padding: 16px; cursor: default;">
                    <span class="builder-editable" contenteditable="true" onclick="startBuilderEdit(this, ${i})" onblur="updateBuilderListSplit(this, ${i}, 0)" style="font-weight: 600; flex: 1; text-align: left;">${t}</span>
                    <i class="fas fa-external-link-alt" style="color: var(--text-tertiary); margin: 0 16px;"></i>
                    <span class="builder-editable" contenteditable="true" onclick="startBuilderEdit(this, ${i})" onblur="updateBuilderListSplit(this, ${i}, 1)" style="font-weight: 400; font-size: 0.8rem; color: var(--text-tertiary); flex: 1; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${u}</span>
                </div>
                <button class="btn btn-icon" style="color: var(--danger); padding: 12px;" onclick="removeBuilderItem(${i})"><i class="fas fa-trash"></i></button>
            </div>`;
        }).join('');
        const addBtn = `<button class="btn btn-secondary" style="margin-top: 12px; align-self: flex-start;" onclick="addBuilderItem('Novo Link | https://')"><i class="fas fa-plus"></i> Adicionar Link</button>`;
        contentHtml = `<div style="display: flex; flex-direction: column; gap: 12px; max-width: 600px;">${btns}${addBtn}</div>`;

    } else if (icon === 'fa-question-circle') {
        // FAQs
        const faqs = builderState.items.map((l, i) => {
            const parts = l.split('|');
            const q = parts[0]?.trim() || 'Pergunta?';
            const a = parts[1]?.trim() || 'Resposta.';
            return `<div style="display: flex; gap: 8px; align-items: flex-start; margin-bottom: 12px;">
                <details style="background: var(--bg-main); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--panel-border); flex: 1;" open>
                    <summary style="font-weight: 600; cursor: default; color: var(--text-primary); outline: none; list-style: none;">
                        <span class="builder-editable" contenteditable="true" onclick="startBuilderEdit(this, ${i})" onblur="updateBuilderListSplit(this, ${i}, 0)" style="width: 100%; display: block;">${q}</span>
                    </summary>
                    <p class="builder-editable" contenteditable="true" onclick="startBuilderEdit(this, ${i})" onblur="updateBuilderListSplit(this, ${i}, 1)" style="margin: 12px 0 0 0; color: var(--text-secondary); line-height: 1.6; display: block; min-height: 24px;">${a}</p>
                </details>
                <button class="btn btn-icon" style="color: var(--danger); padding: 16px;" onclick="removeBuilderItem(${i})"><i class="fas fa-trash"></i></button>
            </div>`;
        }).join('');
        const addBtn = `<button class="btn btn-secondary" style="margin-top: 4px;" onclick="addBuilderItem('Nova Pergunta? | Nova resposta.')"><i class="fas fa-plus"></i> Adicionar FAQ</button>`;
        contentHtml = `<div style="display: flex; flex-direction: column;">${faqs}${addBtn}</div>`;

    } else if (icon === 'fa-trophy') {
        const items = builderState.items.map((l, i) => {
            return `<div style="position: relative; background: var(--bg-main); padding: 24px; text-align: center; border-radius: var(--radius-md); border: 1px solid var(--panel-border);">
                <button class="btn btn-icon" style="position: absolute; top: 8px; right: 8px; color: var(--danger); font-size: 0.8rem;" onclick="removeBuilderItem(${i})"><i class="fas fa-trash"></i></button>
                <i class="fas fa-trophy" style="font-size: 2rem; color: var(--accent); margin-bottom: 16px;"></i>
                <div class="builder-editable" contenteditable="true" onclick="startBuilderEdit(this, ${i})" onblur="updateBuilderListItem(this, ${i})" style="font-weight: 600; color: var(--text-primary); font-size: 1.1rem; display: block;">${l}</div>
            </div>`;
        }).join('');
        const addBtn = `<div class="builder-add-item" onclick="addBuilderItem('Nova Conquista')" style="min-height: 120px;">
            <div><i class="fas fa-plus" style="font-size: 1.5rem; margin-bottom: 8px;"></i><br>Adicionar</div>
        </div>`;
        contentHtml = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">${items}${addBtn}</div>`;

    } else if (icon === 'fa-clipboard-list') {
        const items = builderState.items.map((l, i) => {
            return `<li style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                <span class="builder-editable" contenteditable="true" onclick="startBuilderEdit(this, ${i})" onblur="updateBuilderListItem(this, ${i})" style="flex: 1;">${l}</span>
                <button class="btn btn-icon" style="color: var(--danger); padding: 4px;" onclick="removeBuilderItem(${i})"><i class="fas fa-trash"></i></button>
            </li>`;
        }).join('');
        const addBtn = `<button class="btn btn-secondary" style="margin-top: 12px; margin-left: 20px;" onclick="addBuilderItem('Novo Item')"><i class="fas fa-plus"></i> Adicionar Item</button>`;
        contentHtml = `<ul style="padding-left: 20px; color: var(--text-secondary); line-height: 1.8; margin: 0;">${items}</ul>${addBtn}`;
    } else if (icon === 'fa-glass-cheers') {
        const textData = builderState.items[0] || 'Nome | Data | Local | Info';
        const parts = textData.split('|');
        const eventName = parts[0]?.trim() || 'Nome do Convívio';
        const eventDate = parts[1]?.trim() || 'Data e Hora';
        const eventVenue = parts[2]?.trim() || 'Local';
        const tokenInfo = parts[3]?.trim() || 'Preço/Info da Senha';

        let logos = { nemLogo: 'Vetorizado.svg', guestLogo: '', barLogo: '' };
        try {
            if (builderState.items[1]) logos = JSON.parse(builderState.items[1]);
        } catch (e) { }

        const renderLogoSlot = (type, src, placeholder) => {
            if (type === 'nem') {
                return `<img src="${src}" style="height: 120px; object-fit: contain;" alt="NEM Logo">`;
            }
            if (src) {
                return `<div style="position:relative; display:inline-block;">
                            <div style="cursor:pointer;" onclick="openLogoPicker('${type}')">
                                <img src="${src}" style="height: 120px; object-fit: contain; border-radius: 4px;" alt="Logo">
                                <div style="position:absolute; inset:0; background:rgba(0,0,0,0.5); color:white; display:flex; align-items:center; justify-content:center; opacity:0; transition:0.2s; border-radius:4px; font-size:0.8rem;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0"><i class="fas fa-edit"></i></div>
                            </div>
                            <button onclick="clearBuilderLogo('${type}'); event.stopPropagation();" title="Remover Logo" style="position:absolute;top:-8px;right:-8px;background:var(--danger);color:white;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:0.7rem;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-sm);z-index:10;"><i class="fas fa-times"></i></button>
                        </div>`;
            } else {
                return `<div onclick="openLogoPicker('${type}')" style="height: 120px; width: 120px; border: 2px dashed var(--panel-border); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-tertiary); font-size: 0.8rem; text-align:center; line-height:1.2;">
                            <i class="fas fa-plus"></i><br>${placeholder}
                        </div>`;
            }
        };

        contentHtml = `
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; border-radius: var(--radius-md); color: white; display:flex; flex-direction:column; gap: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 20px;">
                    <div>
                        <div class="builder-editable" contenteditable="true" onclick="startBuilderEdit(this, 0)" onblur="updateBuilderListSplit(this, 0, 0)" style="font-size: 2rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #fff; margin-bottom: 8px; font-family: 'Outfit', sans-serif;">${eventName}</div>
                        <div style="display:flex; gap:16px; color: #a0aabf; font-size: 0.95rem;">
                            <span><i class="far fa-calendar-alt"></i> <span class="builder-editable" contenteditable="true" onclick="startBuilderEdit(this, 0)" onblur="updateBuilderListSplit(this, 0, 1)">${eventDate}</span></span>
                            <span><i class="fas fa-map-marker-alt"></i> <span class="builder-editable" contenteditable="true" onclick="startBuilderEdit(this, 0)" onblur="updateBuilderListSplit(this, 0, 2)">${eventVenue}</span></span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 16px; background: rgba(255,255,255,0.05); padding: 12px 24px; border-radius: 100px; backdrop-filter: blur(10px);">
                        ${renderLogoSlot('nem', logos.nemLogo)}
                        ${renderLogoSlot('guest', logos.guestLogo, 'Curso')}
                        <div style="height: 40px; width: 1px; background: rgba(255,255,255,0.2);"></div>
                        ${renderLogoSlot('bar', logos.barLogo, 'Bar')}
                    </div>
                </div>
                
                <div style="background: rgba(var(--accent-rgb), 0.15); border: 1px solid rgba(var(--accent-rgb), 0.3); padding: 20px; border-radius: var(--radius-sm); border-left: 4px solid var(--accent); display:flex; align-items:center; gap: 16px;">
                    <i class="fas fa-ticket-alt" style="font-size: 1.8rem; color: var(--accent);"></i>
                    <div>
                        <div style="font-weight: 700; color: #fff; font-size: 1.1rem; margin-bottom:4px;">Senhas</div>
                        <div class="builder-editable" contenteditable="true" onclick="startBuilderEdit(this, 0)" onblur="updateBuilderListSplit(this, 0, 3)" style="color: #cbd5e1; font-size: 0.95rem;">${tokenInfo}</div>
                    </div>
                </div>
            </div>
        `;
    }

    // Wrap the entire thing in the authentic section styling
    const livePreviewHtml = `
        <section style="pointer-events: auto;">
            <div style="margin-bottom: 32px; display: flex; align-items: center; gap: 16px;">
                <h2 style="margin:0;"><i class="fas ${icon}" style="color: var(--accent); margin-right: 12px;"></i>${label}</h2>
            </div>
            <div class="card" style="line-height: 1.8;">
                ${contentHtml}
            </div>
        </section>
    `;

    container.innerHTML = livePreviewHtml;

    // Defer modal scaling slightly to allow the DOM to render the new height
    setTimeout(updateModalScale, 10);
};

// --- Builder Interaction Handlers ---

window.startBuilderEdit = function (element, index) {
    element.focus();
    // Move caret to end
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
};

window.endBuilderEdit = function (element, index, type = 'text') {
    let rawHtml = element.innerHTML || '';
    // Convert <br> back to \n
    let text = rawHtml.replace(/<br\s*[\/]?>/gi, "\n");
    // Strip other HTML tags
    text = text.replace(/<\/?[^>]+(>|$)/g, "");

    // Decode HTML entities
    const txt = document.createElement("textarea");
    txt.innerHTML = text;
    let decoded = txt.value;

    if (type === 'text') {
        builderState.items = decoded.split('\n');
    }
    renderBuilderPreview();
};

window.addBuilderItem = function (defaultStr) {
    builderState.items.push(defaultStr);
    renderBuilderPreview();
};

window.removeBuilderItem = function (index) {
    builderState.items.splice(index, 1);
    renderBuilderPreview();
};

window.updateBuilderListSplit = function (el, index, splitIndex) {
    const current = builderState.items[index] || '|';
    let parts = current.split('|');
    if (parts.length < 2) parts = [current, ''];
    parts[splitIndex] = (el.innerText || el.textContent || '').trim() || ' ';
    builderState.items[index] = parts.join('|');
};

window.updateBuilderListItem = function (el, index) {
    builderState.items[index] = (el.innerText || el.textContent || '').trim() || ' ';
};

window.handleBuilderImageUpload = async function (input) {
    const file = input.files[0];
    if (!file) return;
    showToast('A compilar imagem...', 'info');
    try {
        const base64 = await compressImage(file);
        const src = await uploadImageToGithub(base64, 'sections');
        builderState.items.push(src);
        renderBuilderPreview();
        showToast('Imagem adicionada!');
    } catch (err) {
        showToast('Erro ao carregar imagem', 'danger');
    }
    input.value = '';
};

// --- Convivios Specific: Logo Picker ---
window.openLogoPicker = function (type) {
    if (type === 'nem') return; // Cannot change default logo slot this way

    document.getElementById('logo-picker-type').value = type;
    // Clear any event context so we don't accidentally update an event instead of the builder
    document.getElementById('logo-picker-event-index').value = '';
    document.getElementById('logo-picker-event-slot').value = '';

    // Choose library to show based on type
    const lib = type === 'guest' ? (state.data.libraryCourses || []) : (state.data.libraryBars || []);

    const grid = document.getElementById('logo-picker-grid');
    if (lib.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; padding: 32px; text-align: center; color: var(--text-tertiary);"><i class="fas fa-folder-open" style="font-size: 2rem; margin-bottom: 12px;"></i><br>Ainda não tens logos guardados.</div>';
    } else {
        grid.innerHTML = lib.map((lg, i) => `
            <div style="position: relative; background: white; border: 1px solid var(--panel-border); border-radius: 8px; cursor: pointer; padding: 12px; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: 0.2s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--panel-border)'">
                <button onclick="deleteLibraryLogo(event, '${type}', ${i})" title="Apagar logo" style="position: absolute; top: -8px; right: -8px; width: 22px; height: 22px; background: var(--danger); color: white; border: none; border-radius: 50%; cursor: pointer; font-size: 0.7rem; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm); z-index: 5; line-height: 1;"><i class="fas fa-times"></i></button>
                <div onclick="selectLogo('${lg.src}', '${lg.name ? lg.name.replace(/'/g, "\\'") : ''}')" style="width: 100%; height: 60px; display: flex; align-items: center; justify-content: center;">
                    <img src="${lg.src}" style="max-height: 100%; max-width: 100%; object-fit: contain;">
                </div>
                <input type="text" value="${lg.name || ''}" placeholder="Nome do Local..." onchange="updateLibraryLogoName('${type}', ${i}, this.value)" onclick="event.stopPropagation();" style="width: 100%; font-size: 0.8rem; padding: 4px 6px; text-align: center; border: 1px solid var(--panel-border); border-radius: 4px;">
            </div>
        `).join('');
    }

    document.getElementById('logo-picker-modal').style.display = 'flex';
};

window.deleteLibraryLogo = async function (e, type, index) {
    e.preventDefault();
    e.stopPropagation();
    const ok = await customConfirm('Apagar este logo da biblioteca?', 'Apagar Logo');
    if (!ok) return;

    let srcToDelete = null;

    if (type === 'guest') {
        srcToDelete = state.data.libraryCourses[index]?.src;
        state.data.libraryCourses.splice(index, 1);
    } else if (type === 'bar') {
        srcToDelete = state.data.libraryBars[index]?.src;
        state.data.libraryBars.splice(index, 1);
    }

    if (srcToDelete) {
        // Run in background so UI updates immediately
        deleteImageFromGithub(srcToDelete).catch(console.error);
    }

    saveData();
    showToast('Logo apagado.');
    // Re-render the grid in-place (keep modal open)
    openLogoPicker(type);
};

window.updateLibraryLogoName = function (type, index, name) {
    if (type === 'guest' && state.data.libraryCourses[index]) {
        state.data.libraryCourses[index].name = name;
    } else if (type === 'bar' && state.data.libraryBars[index]) {
        state.data.libraryBars[index].name = name;
    }
    saveData(); // Save changes silently
};

window.closeLogoPicker = function () {
    document.getElementById('logo-picker-modal').style.display = 'none';
};

window.selectLogo = function (base64Src, logoName = '') {
    const type = document.getElementById('logo-picker-type').value;
    const evIdx = document.getElementById('logo-picker-event-index').value;
    const evSlot = document.getElementById('logo-picker-event-slot').value;

    if (evIdx !== '') {
        // Context: native convívio event
        const idx = parseInt(evIdx);
        if (!isNaN(idx) && state.data.events[idx]) {
            state.data.events[idx][evSlot] = base64Src;

            // Auto-populate local location if a Bar logo is chosen and it has a name
            if (type === 'bar' && logoName) {
                state.data.events[idx].location = logoName;
            }

            closeLogoPicker();
            renderNativeLivePreviews();
            saveData();
        }
        return;
    }

    // Context: section builder
    let logos = { nemLogo: 'Vetorizado.svg', guestLogo: '', barLogo: '' };
    try {
        if (builderState.items[1]) logos = JSON.parse(builderState.items[1]);
    } catch (e) { }

    if (type === 'guest') logos.guestLogo = base64Src;
    if (type === 'bar') logos.barLogo = base64Src;

    builderState.items[1] = JSON.stringify(logos);

    closeLogoPicker();
    renderBuilderPreview();
};

window.clearBuilderLogo = function (type) {
    let logos = { nemLogo: 'Vetorizado.svg', guestLogo: '', barLogo: '' };
    try {
        if (builderState.items[1]) logos = JSON.parse(builderState.items[1]);
    } catch (e) { }

    if (type === 'guest') logos.guestLogo = '';
    if (type === 'bar') logos.barLogo = '';

    builderState.items[1] = JSON.stringify(logos);
    renderBuilderPreview();
};

/** Opens logo picker targeting a native convívio event's logo slot rather than the builder. */
window.openConvivioEventLogoPicker = function (eventIndex, slot) {
    // slot: 'guestLogo' or 'barLogo'
    const type = slot === 'guestLogo' ? 'guest' : 'bar';
    // Call openLogoPicker first (it renders the grid and opens the modal)
    // — it also clears the event context inputs, so we set them AFTER
    openLogoPicker(type);
    document.getElementById('logo-picker-event-index').value = eventIndex;
    document.getElementById('logo-picker-event-slot').value = slot;
};

window.handleNewLogoUpload = async function (input) {
    const file = input.files[0];
    if (!file) return;

    const type = document.getElementById('logo-picker-type').value;
    showToast('A compilar logo...', 'info');

    try {
        const base64 = await compressImage(file);
        const ghType = type === 'guest' ? 'partner_courses' : 'bars';
        const src = await uploadImageToGithub(base64, ghType);
        const fileName = file.name.split('.')[0]; // Extract file name without extension

        // Add to library
        if (type === 'guest') {
            state.data.libraryCourses.push({ src, name: fileName, addedAt: Date.now() });
        } else if (type === 'bar') {
            state.data.libraryBars.push({ src, name: fileName, addedAt: Date.now() });
        }

        // Auto select it for the current preview
        selectLogo(src, fileName);
        showToast('Logo gravado e selecionado!');

    } catch (err) {
        showToast('Erro ao carregar imagem', 'danger');
    }
    input.value = '';
};

// ─── INIT MODAL WRAPPER ──────────────────────────────────────────

function setupAddSectionModalMode(cs = null) {
    const isAdvanced = document.getElementById('mode-toggle').checked;

    document.getElementById('modal-simple-fields').style.display = isAdvanced ? 'none' : 'block';
    document.getElementById('modal-advanced-fields').style.display = isAdvanced ? 'block' : 'none';
    document.getElementById('simple-overwrite-warning').style.display = 'none';

    if (isAdvanced) {
        document.getElementById('ns-content').value = cs ? cs.content : '';
    } else {
        if (cs && cs.simpleData) {
            // Restore from simpleData string to builderState array
            const raw = cs.simpleData.raw || '';
            builderState.items = raw.split('\n').filter(Boolean);
            builderState.icon = cs.simpleData.icon || 'fa-file-alt';
        } else {
            if (cs && cs.content) {
                document.getElementById('simple-overwrite-warning').style.display = 'block';
            }
            // Will use defaults setup in openAddSectionModal or editCustomSection
            if (!cs) {
                builderState.items = ['Nova Secção de Texto'];
            }
        }
        renderBuilderPreview();
    }
}


window.openAddSectionModal = function () {
    const modal = document.getElementById('add-section-modal');
    if (modal) {
        document.getElementById('ns-label').value = '';
        document.getElementById('ns-id').value = '';
        document.getElementById('add-section-modal-title').textContent = 'Adicionar Nova Secção';

        // Default visual builder state
        builderState.icon = 'fa-file-alt';
        builderState.items = ['Nova Secção de Texto'];
        builderState.editingIndex = null;

        // Sync custom dropdown UI manually
        const options = document.querySelectorAll('.custom-select-option');
        options.forEach(opt => opt.classList.remove('selected'));
        const selectedOpt = document.querySelector(`.custom-select-option[data-value="fa-file-alt"]`);
        if (selectedOpt) {
            selectedOpt.classList.add('selected');
            const trigger = document.querySelector('.custom-select-trigger');
            if (trigger) trigger.innerHTML = selectedOpt.innerHTML;
        }

        setupAddSectionModalMode(null);
        document.body.style.overflow = 'hidden';
        modal.style.display = 'flex';
        setTimeout(updateModalScale, 10);
    }
};

window.closeAddSectionModal = function () {
    const modal = document.getElementById('add-section-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
};

const simpleLabelInput = document.getElementById('ns-label');
if (simpleLabelInput) {
    simpleLabelInput.addEventListener('input', () => {
        if (!document.getElementById('modal-simple-fields').style.display || document.getElementById('modal-simple-fields').style.display !== 'none') {
            renderBuilderPreview();
        }
    });
}

window.editCustomSection = function (id) {
    const cs = (state.data.customSections || []).find(s => s.id === id);
    if (!cs) return;
    const modal = document.getElementById('add-section-modal');
    if (modal) {
        document.getElementById('ns-label').value = cs.label;
        document.getElementById('ns-id').value = cs.id;
        document.getElementById('add-section-modal-title').textContent = 'Editar Secção';

        builderState.icon = cs.icon || 'fa-file-alt';

        // Sync custom dropdown UI
        const options = document.querySelectorAll('.custom-select-option');
        options.forEach(opt => opt.classList.remove('selected'));
        const selectedOpt = document.querySelector(`.custom-select-option[data-value="${builderState.icon}"]`);
        if (selectedOpt) {
            selectedOpt.classList.add('selected');
            const trigger = document.querySelector('.custom-select-trigger');
            if (trigger) trigger.innerHTML = selectedOpt.innerHTML;
        }

        setupAddSectionModalMode(cs);
        document.body.style.overflow = 'hidden';
        modal.style.display = 'flex';
        setTimeout(updateModalScale, 10);
    }
};

window.saveNewSection = function () {
    const label = document.getElementById('ns-label').value.trim();
    const icon = builderState.icon || 'fa-file-alt';
    const editingId = document.getElementById('ns-id').value.trim();

    if (!label) {
        showToast('Dá um nome à secção.', 'danger');
        return;
    }

    let content = '';
    let simpleData = null;
    const isAdvanced = document.getElementById('mode-toggle').checked;

    if (isAdvanced) {
        content = document.getElementById('ns-content').value;
    } else {
        // Construct raw from builder items so we don't break backward compatibility
        const raw = builderState.items.join('\n');
        const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
        const textBreaks = raw.replace(/\n/g, '<br>');

        if (['fa-file-alt', 'fa-newspaper', 'fa-map-marker-alt'].includes(icon)) {
            content = `<p style="color: var(--text-secondary); line-height: 1.8; margin: 0;">${textBreaks}</p>`;
        } else if (['fa-star', 'fa-bullhorn'].includes(icon)) {
            const isWarn = icon === 'fa-bullhorn';
            const bg = isWarn ? 'rgba(230, 162, 60, 0.1)' : 'var(--accent-glow)';
            const border = isWarn ? '#E6A23C' : 'var(--accent)';
            const color = isWarn ? '#E6A23C' : 'var(--accent)';
            content = `<div style="background: ${bg}; padding: 24px; border-radius: var(--radius-sm); border-left: 4px solid ${border};">
                <p style="margin: 0; font-size: 1.1rem; color: ${color}; font-weight: 500;">${textBreaks}</p>
            </div>`;
        } else if (icon === 'fa-images') {
            const imgs = lines.map(u => `<img src="${u}" style="width: 100%; height: 250px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--panel-border); box-shadow: var(--shadow-sm);">`).join('');
            content = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px;">${imgs}</div>`;
        } else if (icon === 'fa-handshake') {
            const logos = lines.map(u => `<img src="${u}" style="max-height: 80px; max-width: 180px; object-fit: contain; filter: grayscale(100%) opacity(0.7); transition: all 0.2s;" onmouseover="this.style.filter='none'" onmouseout="this.style.filter='grayscale(100%) opacity(0.7)'">`).join('');
            content = `<div style="display: flex; gap: 40px; flex-wrap: wrap; align-items: center; justify-content: center; padding: 32px 0;">${logos}</div>`;
        } else if (['fa-link', 'fa-book'].includes(icon)) {
            const btns = lines.map(l => {
                const parts = l.split('|');
                const t = parts[0]?.trim() || 'Link';
                const u = parts[1]?.trim() || '#';
                return `<a href="${u}" target="_blank" class="btn btn-secondary" style="display: flex; justify-content: space-between; align-items: center; padding: 16px;">
                    <span style="font-weight: 600;">${t}</span> <i class="fas fa-external-link-alt" style="color: var(--text-tertiary);"></i>
                </a>`;
            }).join('');
            content = `<div style="display: flex; flex-direction: column; gap: 12px; max-width: 600px;">${btns}</div>`;
        } else if (icon === 'fa-question-circle') {
            const faqs = lines.map(l => {
                const parts = l.split('|');
                const q = parts[0]?.trim() || '?';
                const a = parts[1]?.trim() || '';
                return `<details style="background: var(--bg-main); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--panel-border); margin-bottom: 12px; transition: all 0.2s;">
                    <summary style="font-weight: 600; cursor: pointer; color: var(--text-primary); outline: none;">${q}</summary>
                    <p style="margin: 12px 0 0 0; color: var(--text-secondary); line-height: 1.6;">${a}</p>
                </details>`;
            }).join('');
            content = `<div style="display: flex; flex-direction: column;">${faqs}</div>`;
        } else if (icon === 'fa-trophy') {
            const items = lines.map(l => `<div style="background: var(--bg-main); padding: 24px; text-align: center; border-radius: var(--radius-md); border: 1px solid var(--panel-border);">
                <i class="fas fa-trophy" style="font-size: 2rem; color: var(--accent); margin-bottom: 16px;"></i>
                <div style="font-weight: 600; color: var(--text-primary); font-size: 1.1rem;">${l}</div>
            </div>`).join('');
            content = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">${items}</div>`;
        } else if (icon === 'fa-clipboard-list') {
            const items = lines.map(l => `<li style="margin-bottom: 8px;">${l}</li>`).join('');
            content = `<ul style="padding-left: 20px; color: var(--text-secondary); line-height: 1.8; margin: 0;">${items}</ul>`;
        } else if (icon === 'fa-glass-cheers') {
            const textData = builderState.items[0] || 'Nome | Data | Local | Info';
            const parts = textData.split('|');
            const eventName = parts[0]?.trim() || 'Nome do Convívio';
            const eventDate = parts[1]?.trim() || 'Data e Hora';
            const eventVenue = parts[2]?.trim() || 'Local';
            const tokenInfo = parts[3]?.trim() || '1 senha - 2,5€ - 3 imperiais/shots da casa ou 2 sangrias/sidras/shots ou 1 bifana';

            let logos = { nemLogo: 'Vetorizado.svg', guestLogo: '', barLogo: '' };
            try {
                if (builderState.items[1]) logos = JSON.parse(builderState.items[1]);
            } catch (e) { }

            const renderPublicLogo = (src) => src ? `<img src="${src}" style="height: 120px; object-fit: contain; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.2));" alt="Logo">` : '';

            content = `
                <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; border-radius: var(--radius-md); color: white; display:flex; flex-direction:column; gap: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); overflow: hidden; position: relative;">
                    <!-- Ambient Glow -->
                    <div style="position:absolute; top:-50px; right:-50px; width:150px; height:150px; background:var(--accent); filter:blur(100px); opacity:0.3; border-radius:50%;"></div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 24px; position:relative; z-index:2;">
                        <div>
                            <h3 style="font-size: 2.2rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #fff; margin: 0 0 12px 0; font-family: 'Outfit', system-ui, sans-serif; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">${eventName}</h3>
                            <div style="display:flex; flex-wrap:wrap; gap:16px; color: #a0aabf; font-size: 1rem; font-weight: 500;">
                                <span style="display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.2); padding:6px 12px; border-radius:100px;"><i class="far fa-calendar-alt" style="color:var(--accent)"></i> ${eventDate}</span>
                                <span style="display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.2); padding:6px 12px; border-radius:100px;"><i class="fas fa-map-marker-alt" style="color:var(--accent)"></i> ${eventVenue}</span>
                            </div>
                        </div>
                        
                        <div style="display: flex; align-items: center; justify-content: center; gap: 20px; background: rgba(255,255,255,0.05); padding: 16px 24px; border-radius: 24px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);">
                            ${renderPublicLogo(logos.nemLogo)}
                            ${logos.guestLogo ? `<div style="height: 60px; width: 2px; background: rgba(255,255,255,0.2); border-radius:2px;"></div>${renderPublicLogo(logos.guestLogo)}` : ''}
                            ${logos.barLogo ? `<div style="height: 60px; width: 2px; background: rgba(var(--accent-rgb),0.5); border-radius:2px;"></div>${renderPublicLogo(logos.barLogo)}` : ''}
                        </div>
                    </div>
                    
                    <div style="background: rgba(var(--accent-rgb), 0.1); border: 1px solid rgba(var(--accent-rgb), 0.3); padding: 24px; border-radius: 16px; border-left: 4px solid var(--accent); display:flex; align-items:center; gap: 20px; position:relative; z-index:2; backdrop-filter: blur(5px);">
                        <div style="background: rgba(var(--accent-rgb),0.2); width:60px; height:60px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <i class="fas fa-ticket-alt" style="font-size: 1.8rem; color: var(--accent); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); transform: rotate(-15deg);"></i>
                        </div>
                        <div>
                            <div style="font-weight: 800; color: #fff; font-size: 1.2rem; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">Senhas</div>
                            <div style="color: #cbd5e1; font-size: 1rem; line-height: 1.5;">${tokenInfo}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        simpleData = { raw, icon };
    }

    if (!state.data.customSections) state.data.customSections = [];

    if (editingId) {
        const idx = state.data.customSections.findIndex(s => s.id === editingId);
        if (idx !== -1) {
            state.data.customSections[idx] = { id: editingId, label, icon, content, simpleData };
        }
    } else {
        const id = 'custom_' + Date.now();
        state.data.customSections.push({ id, label, icon, content, simpleData });
        if (!state.data.sections) state.data.sections = {};
        state.data.sections[id] = true;
        if (!state.data.sectionOrder) state.data.sectionOrder = [];
        state.data.sectionOrder.push(id);
    }

    closeAddSectionModal();
    renderLayoutTab();
    saveData();
    showToast(editingId ? 'Secção atualizada!' : 'Nova secção adicionada!');
};

window.handleFileUpload = function (input, targetId, append = false) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
        const target = document.getElementById(targetId);
        if (target) {
            if (append) {
                target.value = target.value + (target.value ? '\n' : '') + e.target.result;
            } else {
                target.value = e.target.result;
            }
        }
    };
    reader.readAsDataURL(file);
    // Reset file input so same file can be chosen again
    input.value = '';
};

window.deleteCustomSection = async function (id) {
    try {
        if (!await customConfirm('Apagar esta secção? O conteúdo será perdido.', 'Apagar Secção')) return;

        console.log("Deleting custom section:", id);

        // Remove from customSections array
        const initialLen = state.data.customSections ? state.data.customSections.length : 0;
        state.data.customSections = (state.data.customSections || []).filter(s => s.id !== id);
        console.log("Custom sections reduced from", initialLen, "to", state.data.customSections.length);

        // Remove from sectionOrder array
        let newOrder = [];
        if (state.data.sectionOrder) {
            for (let i = 0; i < state.data.sectionOrder.length; i++) {
                if (state.data.sectionOrder[i] !== id) {
                    newOrder.push(state.data.sectionOrder[i]);
                }
            }
        }
        state.data.sectionOrder = newOrder;

        // Remove from sections visibility config
        if (state.data.sections) {
            const newSections = {};
            for (const key in state.data.sections) {
                if (key !== id) {
                    newSections[key] = state.data.sections[key];
                }
            }
            state.data.sections = newSections;
        }

        renderLayoutTab();
        console.log("UI Re-rendered. Calling save...");
        saveData().then(() => {
            console.log("Save complete.");
            showToast('Secção apagada.');
        }).catch(err => {
            console.error("SaveData failed in deleteCustomSection:", err);
        });

    } catch (error) {
        console.error("Error in deleteCustomSection:", error);
        alert("Erro interno ao apagar secção: " + error.message);
    }
};

window.onVisibilityChange = onVisibilityChange;

// ─── SECTIONS & TABS ──────────────────────────────────────────────
function setupEventListeners() {
    // Login
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        state.pat = document.getElementById('github-pat').value.trim();
        state.gistId = document.getElementById('gist-id').value.trim();
        state.entryPin = document.getElementById('admin-pin').value.trim();
        localStorage.setItem('nem_gh_pat', state.pat);
        localStorage.setItem('nem_gist_id', state.gistId);
        localStorage.setItem('nem_admin_pin', state.entryPin);
        checkAuth();
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            item.classList.add('active');
            document.getElementById(`section-${section}`).classList.add('active');

            const titles = {
                general: ['Configurações Gerais', 'Gere as informações base do website.'],
                layout: ['Layout do Site', 'Reordena e activa/desactiva secções do site.'],
                team: ['Equipa', 'Gere os membros da equipa.'],
                merch: ['Merchandise', 'Gere os produtos disponíveis.'],
                events: ['Eventos', 'Gere os eventos e atividades.'],
                socials: ['Redes Sociais', 'Links e contactos.']
            };
            const [title, subtitle] = titles[section] || [section, ''];
            document.getElementById('section-title').textContent = title;
            document.getElementById('section-subtitle').textContent = subtitle;
        });
    });

    // CRUD - Add Item
    document.querySelectorAll('.add-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            openItemModal(btn.dataset.type);
        });
    });

    // Modal behavior
    document.getElementById('close-modal').addEventListener('click', () => {
        document.getElementById('item-modal').style.display = 'none';
        document.body.style.overflow = '';
    });

    document.getElementById('item-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveItemFromModal();
        document.body.style.overflow = '';
    });

    // Auto-save for general config inputs on blur
    document.querySelectorAll('#section-general input, #section-general textarea, #section-socials input').forEach(input => {
        input.addEventListener('blur', () => { saveData(); });
    });

    // Auto-save Instagram posts on blur
    const igField = document.getElementById('cfg-instagramPosts');
    if (igField) igField.addEventListener('blur', () => { saveData(); });
}

function logout() {
    localStorage.removeItem('nem_gh_pat');
    localStorage.removeItem('nem_gist_id');
    localStorage.removeItem('nem_admin_pin');
    location.reload();
}

// ─── CRUD LOGIC ───────────────────────────────────────────────────
function renderAdminLists() {
    // Members
    const membersList = document.getElementById('members-admin-list');
    membersList.innerHTML = state.data.members.map((m, i) => `
        <div class="item-card">
            <img src="${m.photo || 'https://via.placeholder.com/60x60'}" alt="">
            <div>
                <div style="font-weight: 600;">${m.name}</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">${m.role}</div>
            </div>
            <div class="item-actions">
                <button class="btn btn-icon" onclick="editItem('member', ${i})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-icon" style="color: var(--danger);" onclick="deleteItem('member', ${i})"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');

    // Merch
    const merchList = document.getElementById('merch-admin-list');
    merchList.innerHTML = state.data.merch.map((m, i) => `
        <div class="item-card">
            <img src="${m.image || 'https://via.placeholder.com/60x60'}" alt="">
            <div>
                <div style="font-weight: 600;">${m.name}</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">${m.price}€</div>
            </div>
            <div class="item-actions">
                <button class="btn btn-icon" onclick="editItem('merch', ${i})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-icon" style="color: var(--danger);" onclick="deleteItem('merch', ${i})"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');

    // Events
    const eventsList = document.getElementById('events-admin-list');
    const archivedEventsList = document.getElementById('archived-events-admin-list');

    // Normalize "now" to midnight so events today still show as upcoming
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeEvents = [];
    const archivedEvents = [];

    state.data.events.forEach((e, i) => {
        const eventDate = e.dateISO ? new Date(e.dateISO) : new Date(8640000000000000);
        const isArchived = eventDate < today;
        const html = `
        <div class="item-card" style="${isArchived ? 'opacity: 0.6; overflow: hidden; position: relative;' : ''}">
            <div style="background: var(--bg-main); width: 60px; height: 60px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; line-height: 1.2;">
                ${e.date.split(' ')[0]}
                ${e.date.split(' ')[1] ? `<span style="font-size: 0.65rem; font-weight: 600; text-transform: uppercase;">${e.date.split(' ')[1]}</span>` : ''}
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 600; display: flex; align-items: center; gap: 8px;">
                    ${e.title}
                    ${isArchived ? '<span style="font-size: 0.65rem; background: var(--bg-main); color: var(--text-tertiary); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--panel-border); text-transform: uppercase; letter-spacing: 0.5px;">Arquivado</span>' : ''}
                </div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">${e.location}</div>
            </div>
            <div class="item-actions">
                <button class="btn btn-icon" onclick="editItem('event', ${i})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-icon" style="color: var(--danger);" onclick="deleteItem('event', ${i})"><i class="fas fa-trash"></i></button>
            </div>
        </div>
        `;

        if (isArchived) archivedEvents.push(html);
        else activeEvents.push(html);
    });

    eventsList.innerHTML = activeEvents.length ? activeEvents.join('') : '<p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 24px;">Nenhum evento agendado.</p>';
    if (archivedEventsList) {
        archivedEventsList.innerHTML = archivedEvents.length ? archivedEvents.join('') : '<p style="color: var(--text-secondary); font-size: 0.9rem;">Nenhum evento arquivado.</p>';
    }
}

// ─── NATIVE LIVE PREVIEWS ─────────────────────────────────────────

window.renderNativeLivePreviews = function () {
    renderGeneralPreview();
    renderTeamPreview();
    renderMerchPreview();
    renderEventsPreview();
    renderSocialsPreview();
    renderInstagramPreview();
};

window.updateNativeField = function (key, value) {
    // Basic text cleanup
    let cleanValue = (value || '').trim();
    if (state.data[key] !== cleanValue) {
        state.data[key] = cleanValue;
        fillForms();
        saveData();
    }
};

window.renderGeneralPreview = function () {
    const container = document.getElementById('general-preview-container');
    if (!container) return;

    const d = state.data;
    const html = `
        <div style="font-family: inherit; pointer-events: auto;">
            <!-- Config Bar for purely administrative fields hidden in UI mock -->
            <div style="display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 16px; align-items: center; border-bottom: 1px solid var(--panel-border); padding-bottom: 12px;">
                <span style="font-size: 0.8rem; color: var(--text-tertiary); margin-right: auto;">Editar no próprio preview</span>
            </div>

            <!-- Faux App Container -->
            <div style="background: var(--bg-main); border: 1px solid var(--panel-border); border-radius: var(--radius-md); overflow: hidden; box-shadow: var(--shadow-sm);">
                
                <!-- Faux Navbar -->
                <nav style="display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; border-bottom: 1px solid var(--panel-border);">
                    <div style="display: flex; align-items: center; gap: 12px; font-weight: 700;">
                        <i class="fas fa-cube" style="color: var(--text-primary); font-size: 1.5rem;"></i>
                        <span class="builder-editable" contenteditable="true" onblur="updateNativeField('shortName', this.innerText)" title="Editar Nome Curto" style="font-size: 1.2rem;">${d.shortName || 'NEM'}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-tertiary); max-width: 200px; text-align: right;">
                        <span style="display:block; margin-bottom: 2px;">Título Aba do Browser:</span>
                        <span class="builder-editable" contenteditable="true" onblur="updateNativeField('siteTitle', this.innerText)" title="Editar Título da Aba" style="font-weight: 600; color: var(--text-secondary);">${d.siteTitle || 'Título do Site'}</span>
                    </div>
                </nav>

                <!-- Faux Hero -->
                <div style="text-align: center; padding: 64px 24px;">
                    <h1 class="builder-editable" contenteditable="true" onblur="updateNativeField('heroTitle', this.innerText)" style="font-family: 'Merriweather', serif; font-size: 2.5rem; margin: 0 0 16px 0; color: var(--text-primary); line-height: 1.2;">${d.heroTitle || 'Título Hero'}</h1>
                    <p class="builder-editable" contenteditable="true" onblur="updateNativeField('heroDescription', this.innerText)" style="font-size: 1.1rem; color: var(--text-secondary); max-width: 600px; margin: 0 auto; line-height: 1.6;">${d.heroDescription || 'Descrição Hero'}</p>
                    <div style="margin-top: 32px;">
                        <button class="btn btn-primary" style="pointer-events: none;">Ver Merch</button>
                        <button class="btn btn-secondary" style="pointer-events: none; margin-left: 8px;">Atividades</button>
                    </div>
                </div>

                <!-- Faux About -->
                <div style="padding: 40px 24px; background: var(--bg-card); border-top: 1px solid var(--panel-border);">
                    <div style="background: var(--bg-main); padding: 32px; border-radius: var(--radius-md); border: 1px solid var(--panel-border); box-shadow: var(--shadow-sm); max-width: 800px; margin: 0 auto;">
                        <h2 style="margin: 0 0 16px 0;">Quem Somos</h2>
                        <p class="builder-editable" contenteditable="true" onblur="updateNativeField('aboutText', this.innerText)" style="color: var(--text-secondary); line-height: 1.8; margin: 0;">${d.aboutText || 'Texto sobre nós'}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    container.innerHTML = html;
};

// --- Arrays Utility Native ---
let pendingNativeUpload = null;

window.promptNativeImageUpload = function (arrayKey, index, fieldKey) {
    pendingNativeUpload = { arrayKey, index, fieldKey };
    const input = document.getElementById('native-image-upload');
    if (!input) {
        // Create it dynamically if missing
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'native-image-upload';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        fileInput.onchange = (e) => handleNativeImageUpload(e.target);
        document.body.appendChild(fileInput);
    }
    document.getElementById('native-image-upload').click();
};

window.handleNativeImageUpload = async function (input) {
    const file = input.files[0];
    if (!file || !pendingNativeUpload) return;

    showToast('A processar imagem...', 'info');
    try {
        const base64 = await compressImage(file);
        const { arrayKey, index, fieldKey } = pendingNativeUpload;
        const ghType = arrayKey === 'merch' ? 'merch' : 'members';
        const src = await uploadImageToGithub(base64, ghType);

        if (state.data[arrayKey] && state.data[arrayKey][index]) {
            if (arrayKey === 'merch' && fieldKey === 'image') {
                if (!state.data.merch[index].images) state.data.merch[index].images = [];
                state.data.merch[index].images.push(src);
                if (state.data.merch[index].images.length === 1) state.data.merch[index].image = src;
            } else {
                state.data[arrayKey][index][fieldKey] = src;
            }
            renderAdminLists();
            renderNativeLivePreviews();
            saveData();
            showToast('Imagem carregada!');
        }
    } catch (err) {
        showToast('Erro ao carregar imagem', 'danger');
    }
    input.value = '';
    pendingNativeUpload = null;
};

window.updateNativeArrayField = function (arrayKey, index, fieldKey, value) {
    let cleanValue = (value || '').trim();
    if (state.data[arrayKey] && state.data[arrayKey][index]) {
        if (state.data[arrayKey][index][fieldKey] !== cleanValue) {
            state.data[arrayKey][index][fieldKey] = cleanValue;
            renderAdminLists();
            renderNativeLivePreviews();
            saveData();
        }
    }
};

window.deleteItemNative = async function (type, index, e) {
    if (e) {
        try { e.preventDefault(); e.stopPropagation(); } catch (err) { }
    }
    try {
        const typeLabel = type === 'member' ? 'membro' : type === 'merch' ? 'produto' : 'evento';
        const ok = await customConfirm(`Apagar este ${typeLabel}? Esta acção não pode ser desfeita.`, 'Apagar Item');
        if (ok) {
            let arrayKey = type === 'member' ? 'members' : type === 'merch' ? 'merch' : 'events';
            const item = state.data[arrayKey][index];

            // Cleanup associated GitHub images
            if (item) {
                const urlsToDelete = [];
                if (type === 'member' && item.photo) urlsToDelete.push(item.photo);
                if (type === 'merch') {
                    if (item.image) urlsToDelete.push(item.image);
                    if (item.images) urlsToDelete.push(...item.images);
                }
                if (type === 'event') {
                    if (item.nemLogo && item.nemLogo !== 'Vetorizado.svg') urlsToDelete.push(item.nemLogo);
                    if (item.guestLogo) urlsToDelete.push(item.guestLogo);
                    if (item.barLogo) urlsToDelete.push(item.barLogo);
                }
                // Fire and forget deletions
                urlsToDelete.filter(Boolean).forEach(url => deleteImageFromGithub(url).catch(console.error));
            }

            state.data[arrayKey].splice(index, 1);
            renderAdminLists();
            renderNativeLivePreviews();
            saveData();
        }
    } catch (err) {
        showToast('Erro ao apagar: ' + err.message, 'danger');
    }
};

window.removeMerchImage = async function (merchIndex, imgIndex, e) {
    if (e) {
        try { e.preventDefault(); e.stopPropagation(); } catch (err) { }
    }
    try {
        const ok = await customConfirm('Remover esta foto do produto?', 'Apagar Foto');
        if (ok) {
            const m = state.data.merch[merchIndex];
            if (m.images && m.images.length > 0) {
                const urlToDelete = m.images[imgIndex];
                if (urlToDelete) deleteImageFromGithub(urlToDelete).catch(console.error);

                m.images.splice(imgIndex, 1);
                if (m.images.length > 0) m.image = m.images[0];
                else m.image = '';
            }
            renderAdminLists();
            renderNativeLivePreviews();
            saveData();
        }
    } catch (err) {
        showToast('Erro: ' + err.message, 'danger');
    }
};

window.addNativeArrayItem = function (type) {
    if (type === 'member') {
        state.data.members.push({ name: "Novo Membro", role: "Vogal", photo: "", ig: "@user" });
    } else if (type === 'merch') {
        state.data.merch.push({ name: "Novo Produto", price: "0.00", description: "Descrição...", images: [], image: "", formUrl: "" });
    } else if (type === 'event') {
        const today = new Date().toISOString().split('T')[0];
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const m = months[new Date().getMonth()];
        const d = new Date().getDate();
        state.data.events.push({ type: 'regular', title: "Novo Evento", date: `${d} ${m}.`, dateISO: today + "T10:00", status: "Agendado", location: "Local", formUrl: "" });
    }
    renderAdminLists();
    renderNativeLivePreviews();
    saveData();
};

window.renderTeamPreview = function () {
    const container = document.getElementById('team-preview-container');
    if (!container) return;

    const d = state.data;
    const membersHtml = (d.members || []).map((m, i) => `
        <div style="position: relative; overflow: visible;">
            <button style="position: absolute; top: -10px; right: -10px; background: var(--danger); color: white; border: none; border-radius: 50%; width: 28px; height: 28px; padding: 0; box-shadow: var(--shadow-md); z-index: 20; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.8rem;" onclick="deleteItemNative('member', ${i}, event)" title="Remover Membro"><i class="fas fa-trash"></i></button>
            <div class="card member-card" style="padding: 24px; text-align: center;">
                <div class="builder-image-wrapper" style="width: 100%; aspect-ratio: 1; border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 16px; position: relative; cursor: pointer;" onclick="promptNativeImageUpload('members', ${i}, 'photo')" data-native="true" data-array-key="members" data-index="${i}" data-field-key="photo">
                    <img src="${m.photo || 'https://via.placeholder.com/300x300?text=Foto'}" alt="${m.name}" style="width: 100%; height: 100%; object-fit: cover;">
                    <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.5); opacity: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; transition: 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0">
                        <i class="fas fa-camera" style="font-size: 2rem; margin-bottom: 8px;"></i>
                        <span style="font-size: 0.8rem; font-weight: 600;">Alterar Foto</span>
                    </div>
                </div>
                <h3 class="builder-editable" contenteditable="true" onblur="updateNativeArrayField('members', ${i}, 'name', this.innerText)" style="margin: 0 0 4px 0;">${m.name || 'Nome do Membro'}</h3>
                <p class="builder-editable" contenteditable="true" onblur="updateNativeArrayField('members', ${i}, 'role', this.innerText)" style="color: var(--accent); font-weight: 600; margin: 0 0 12px 0; font-size: 0.9rem;">${m.role || 'Cargo'}</p>
                <div class="builder-editable" contenteditable="true" onblur="updateNativeArrayField('members', ${i}, 'ig', this.innerText)" style="color: var(--text-tertiary); font-size: 0.9rem;" placeholder="@instagram">${m.ig || ''}</div>
            </div>
        </div>
    `).join('');

    const addHtml = `
        <div class="card builder-add-item" style="border: 2px dashed var(--panel-border); background: rgba(255,255,255,0.5); display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 250px; cursor: pointer; box-shadow: none;" onclick="addNativeArrayItem('member')">
            <i class="fas fa-plus" style="font-size: 2rem; color: var(--text-tertiary); margin-bottom: 12px;"></i>
            <span style="color: var(--text-secondary); font-weight: 600;">Adicionar Membro</span>
        </div>
    `;

    container.innerHTML = `
        <div style="pointer-events: auto; background: var(--bg-main); padding: 48px 24px; border-radius: var(--radius-md);">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
                <div>
                    <h2>Equipa ${d.mandateYear || '2025/2026'}</h2>
                    <p style="color: var(--text-secondary); margin: 0;">Conhece os rostos por trás do núcleo.</p>
                </div>
            </div>
            <div class="grid">
                ${membersHtml}
                ${addHtml}
            </div>
        </div>
    `;
};

window.promptNativeUrl = async function (arrayKey, index, fieldKey, e) {
    if (e) { try { e.preventDefault(); e.stopPropagation(); } catch (err) { } }
    try {
        const current = state.data[arrayKey][index][fieldKey] || '';
        const val = await customPrompt('Insere o Link ou URL:', current);
        if (val !== null) {
            state.data[arrayKey][index][fieldKey] = extractIframeSrc(val);
            renderAdminLists();
            renderNativeLivePreviews();
            saveData();
        }
    } catch (err) {
        showToast('Erro: ' + err.message, 'danger');
    }
};

window.promptNativeEventDateISO = function (index, e) {
    if (e) { try { e.preventDefault(); e.stopPropagation(); } catch (err) { } }
    const current = (state.data.events[index] && state.data.events[index].dateISO) || '';
    const modal = document.getElementById('custom-prompt-modal');
    const titleEl = document.getElementById('custom-prompt-title');
    const inputEl = document.getElementById('custom-prompt-input');

    // Swap textarea for a datetime-local input
    inputEl.style.display = 'none';
    let dtInput = document.getElementById('custom-dt-input');
    if (!dtInput) {
        dtInput = document.createElement('input');
        dtInput.type = 'datetime-local';
        dtInput.id = 'custom-dt-input';
        dtInput.style.cssText = 'width:100%; font-family:inherit; font-size:1rem; padding:10px 14px; border:1px solid var(--panel-border); border-radius:var(--radius-sm); background:var(--bg-main); color:var(--text-primary); box-sizing:border-box; margin-bottom:20px;';
        inputEl.parentElement.insertBefore(dtInput, inputEl);
    } else {
        dtInput.style.display = '';
    }
    dtInput.value = current || new Date().toISOString().slice(0, 16);

    titleEl.textContent = 'Data & Hora do Evento';
    modal.style.display = 'flex';

    const ok = document.getElementById('custom-prompt-ok');
    const cancel = document.getElementById('custom-prompt-cancel');

    function cleanup(result) {
        modal.style.display = 'none';
        dtInput.style.display = 'none';
        inputEl.style.display = '';
        ok.replaceWith(ok.cloneNode(true));
        cancel.replaceWith(cancel.cloneNode(true));
        if (result !== null) {
            state.data.events[index].dateISO = result;

            // Format a display string (e.g. "5 Mar.")
            const d = new Date(result);
            const months = ['Jan.', 'Fev.', 'Mar.', 'Abr.', 'Mai.', 'Jun.', 'Jul.', 'Ago.', 'Set.', 'Out.', 'Nov.', 'Dez.'];
            const displayStr = `${d.getDate()} ${months[d.getMonth()]}`;
            state.data.events[index].date = displayStr;

            renderAdminLists();
            renderNativeLivePreviews();
            saveData();
        }
    }

    document.getElementById('custom-prompt-ok').addEventListener('click', () => cleanup(dtInput.value), { once: true });
    document.getElementById('custom-prompt-cancel').addEventListener('click', () => cleanup(null), { once: true });
};



window.renderMerchPreview = function () {
    const container = document.getElementById('merch-preview-container');
    if (!container) return;

    const d = state.data;
    const merchHtml = (d.merch || []).map((m, i) => {
        const images = m.images && m.images.length > 0 ? m.images : (m.image ? [m.image] : []);
        // Render thumbnails for preview
        const thumbHtml = images.map((imgUrl, imgIndex) => `
            <div style="position: relative; flex-shrink: 0; width: 54px; height: 54px;">
                <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-sm); border: 2px solid ${imgIndex === 0 ? 'var(--accent)' : 'var(--panel-border)'}; display: block;">
                <button style="position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; background: var(--danger); color: white; border: none; border-radius: 50%; padding: 0; cursor: pointer; font-size: 0.65rem; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm); z-index: 5;" onclick="removeMerchImage(${i}, ${imgIndex}, event)" title="Apagar foto"><i class="fas fa-times"></i></button>
            </div>
        `).join('');

        return `
        <div style="position: relative; overflow: visible;">
            <button style="position: absolute; top: -10px; right: -10px; background: var(--danger); color: white; border: none; border-radius: 50%; width: 28px; height: 28px; padding: 0; box-shadow: var(--shadow-md); z-index: 20; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.8rem;" onclick="deleteItemNative('merch', ${i}, event)" title="Remover Produto"><i class="fas fa-trash"></i></button>
            <div class="card merch-card" style="padding: 24px;">
            
            <div class="builder-image-wrapper" style="width: 100%; aspect-ratio: 1; border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 8px; position: relative; cursor: pointer;" onclick="promptNativeImageUpload('merch', ${i}, 'image')" data-native="true" data-array-key="merch" data-index="${i}" data-field-key="image">
                <img src="${images[0] || 'https://via.placeholder.com/300x300?text=Merch'}" alt="${m.name}" style="width: 100%; height: 100%; object-fit: cover;">
                <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.5); opacity: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; transition: 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0">
                    <i class="fas fa-camera" style="font-size: 2rem; margin-bottom: 8px;"></i>
                    <span style="font-size: 0.8rem; font-weight: 600;">Adicionar / Alterar Foto</span>
                </div>
            </div>
            
            <div style="display: flex; gap: 8px; overflow-x: auto; margin-bottom: 16px; padding-bottom: 8px;">
                ${thumbHtml}
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 12px;">
                <h3 class="builder-editable" contenteditable="true" onblur="updateNativeArrayField('merch', ${i}, 'name', this.innerText)" style="margin: 0; flex: 1; font-size: 1.1rem;">${m.name || 'Nome do Produto'}</h3>
                <div style="display: flex; align-items: center;">
                    <span class="builder-editable" contenteditable="true" onblur="updateNativeArrayField('merch', ${i}, 'price', this.innerText)" style="font-weight: 700; color: var(--accent); min-width: 30px; text-align: right;">${m.price || '0.00'}</span>
                    <span style="font-weight: 700; color: var(--accent);">€</span>
                </div>
            </div>
            
            <strong style="font-size: 0.85rem; color: var(--text-primary); margin-top: 8px;">Breve Descrição (Grid):</strong>
            <p class="builder-editable" contenteditable="true" onblur="updateNativeArrayField('merch', ${i}, 'description', this.innerText)" style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 8px; min-height: 24px; line-height: 1.6; overflow-wrap: break-word; word-break: break-word; white-space: pre-wrap;">${m.description || 'Resumo do produto...'}</p>

            <strong style="font-size: 0.85rem; color: var(--text-primary);">Aprofundado Diferenciado (Popup Saber Mais):</strong>
            <p class="builder-editable" contenteditable="true" onblur="updateNativeArrayField('merch', ${i}, 'detailedDescription', this.innerText)" style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 16px; min-height: 32px; line-height: 1.6; padding: 4px; border: 1px dashed var(--panel-border); background: var(--bg-main); overflow-wrap: break-word; word-break: break-word; white-space: pre-wrap;">${m.detailedDescription || 'Explicação aprofundada...'}</p>
            
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <button onclick="promptNativeUrl('merch', ${i}, 'formUrl', event)" class="btn btn-primary" style="width: 100%; justify-content: center;">
                    <i class="fas fa-link" style="margin-right: 8px;"></i> Editar Link da Compra
                </button>
            </div>
            </div>
        </div>
        `;
    }).join('');

    const addHtml = `
        <div class="card builder-add-item" style="border: 2px dashed var(--panel-border); background: rgba(255,255,255,0.5); display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 350px; cursor: pointer; box-shadow: none;" onclick="addNativeArrayItem('merch')">
            <i class="fas fa-plus" style="font-size: 2rem; color: var(--text-tertiary); margin-bottom: 12px;"></i>
            <span style="color: var(--text-secondary); font-weight: 600;">Adicionar Produto</span>
        </div>
    `;

    container.innerHTML = `
        <div style="pointer-events: auto; padding: 48px 24px; background: var(--bg-main); border-radius: var(--radius-md);">
            <div style="margin-bottom: 32px;">
                <h2>Merchandise</h2>
                <p style="color: var(--text-secondary); margin: 0;">Leva o orgulho da mecânica contigo.</p>
            </div>
            <div class="grid">
                ${merchHtml}
                ${addHtml}
            </div>
        </div>
    `;
};

window.renderEventsPreview = function () {
    const container = document.getElementById('events-preview-container');
    if (!container) return;

    const d = state.data;

    // Shared top-bar buttons (delete + date-config + type-toggle)
    const eventTopBar = (ev, i) => `
        <button style="position: absolute; top: -10px; right: -10px; background: var(--danger); color: white; border: none; border-radius: 50%; width: 28px; height: 28px; padding: 0; box-shadow: var(--shadow-md); z-index: 20; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.8rem;" onclick="deleteItemNative('events', ${i}, event)" title="Remover Evento"><i class="fas fa-trash"></i></button>
        <button style="position: absolute; top: -10px; right: 26px; background: var(--bg-main); color: var(--text-secondary); border: 1px solid var(--panel-border); border-radius: 50%; width: 28px; height: 28px; padding: 0; box-shadow: var(--shadow-md); z-index: 20; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.8rem;" onclick="promptNativeEventDateISO(${i}, event)" title="Configurar Data/Hora"><i class="fas fa-cog"></i></button>
        <!-- Type toggle pill -->
        <div style="position: absolute; top: -10px; right: 64px; display: flex; gap: 0; z-index: 20; border: 1px solid var(--panel-border); border-radius: 20px; overflow: hidden; box-shadow: var(--shadow-sm);">
            <button onclick="setEventType(${i}, 'regular')" style="padding: 3px 10px; font-size: 0.7rem; font-weight: 700; border: none; cursor: pointer; background: ${ev.type === 'convivio' ? 'var(--bg-main)' : 'var(--text-primary)'}; color: ${ev.type === 'convivio' ? 'var(--text-secondary)' : '#fff'}; transition: 0.2s;">Regular</button>
            <button onclick="setEventType(${i}, 'convivio')" style="padding: 3px 10px; font-size: 0.7rem; font-weight: 700; border: none; cursor: pointer; background: ${ev.type === 'convivio' ? '#1a1a2e' : 'var(--bg-main)'}; color: ${ev.type === 'convivio' ? '#fff' : 'var(--text-secondary)'}; transition: 0.2s;">🍻 Convívio</button>
        </div>
    `;

    const renderRegularEvent = (ev, i) => `
        <div style="position: relative; overflow: visible;">
            ${eventTopBar(ev, i)}
            <div class="card" style="display: flex; gap: 24px; align-items: center; flex-wrap: wrap; padding-top: 20px;">
                <div style="background: var(--bg-main); padding: 16px; border-radius: var(--radius-md); text-align: center; min-width: 80px;">
                    <div class="builder-editable" contenteditable="true" onblur="updateNativeArrayField('events', ${i}, 'date', this.innerText)" style="font-weight: 800; font-size: 1.5rem; color: var(--accent); line-height: 1.2;">${(ev.date || 'Data').replace(' ', '<br><span style="font-size: 0.8rem; text-transform: uppercase;">')}</span></div>
                </div>
                <div style="flex: 1; min-width: 200px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px;">
                        <h3 class="builder-editable" contenteditable="true" onblur="updateNativeArrayField('events', ${i}, 'title', this.innerText)" style="margin: 0; min-width: 150px;">${ev.title || 'Título do Evento'}</h3>
                        <span class="status-tag builder-editable" contenteditable="true" onblur="updateNativeArrayField('events', ${i}, 'status', this.innerText)" style="min-width: 50px;">${ev.status || 'Estado'}</span>
                    </div>
                    <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
                        <div style="margin: 0; color: var(--text-secondary); font-size: 0.9rem; display: flex; align-items: center;"><i class="fas fa-map-marker-alt" style="margin-right: 8px;"></i><span class="builder-editable" contenteditable="true" onblur="updateNativeArrayField('events', ${i}, 'location', this.innerText)">${ev.location || 'Local'}</span></div>
                        ${ev.dateISO && ev.dateISO.includes('T') ? `<span style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;"><i class="far fa-clock" style="margin-right: 8px;"></i>${new Date(ev.dateISO).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                    </div>
                </div>
                <button onclick="promptNativeUrl('events', ${i}, 'formUrl', event)" class="btn btn-secondary" style="white-space: nowrap;">
                    <i class="fas fa-link" style="margin-right: 8px;"></i> Editar Link/Form
                </button>
            </div>
        </div>
    `;

    const renderConvivioEvent = (ev, i) => {
        const nemLogo = ev.nemLogo || 'Vetorizado.svg';
        const guestLogo = ev.guestLogo || '';
        const barLogo = ev.barLogo || '';
        const logoSlot = (src, slot, placeholder) => src
            ? `<div style="position:relative;display:inline-block;">
                   <div style="cursor:pointer;" onclick="openConvivioEventLogoPicker(${i}, '${slot}')">
                       <img src="${src}" style="height:120px;object-fit:contain;border-radius:4px;" alt="Logo">
                       <div style="position:absolute;inset:0;background:rgba(0,0,0,0.45);color:white;display:flex;align-items:center;justify-content:center;opacity:0;transition:0.2s;border-radius:4px;font-size:0.8rem;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0"><i class="fas fa-edit"></i></div>
                   </div>
                   <button onclick="updateNativeArrayField('events', ${i}, '${slot}', ''); event.stopPropagation();" title="Remover Logo" style="position:absolute;top:-8px;right:-8px;background:var(--danger);color:white;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:0.7rem;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-sm);z-index:10;"><i class="fas fa-times"></i></button>
               </div>`
            : `<div onclick="openConvivioEventLogoPicker(${i}, '${slot}')" style="height:120px;width:120px;border:2px dashed rgba(255,255,255,0.3);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,0.6);font-size:0.75rem;text-align:center;line-height:1.2;"><i class="fas fa-plus"></i><br>${placeholder}</div>`;
        return `
        <div style="position: relative; overflow: visible;">
            ${eventTopBar(ev, i)}
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: var(--radius-md); padding: 24px; color: white; display:flex; flex-direction:column; gap:20px; margin-top: 8px; box-shadow: var(--shadow-hover);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
                    <div style="flex:1; min-width:200px;">
                        <div class="builder-editable" contenteditable="true" onblur="updateNativeArrayField('events', ${i}, 'title', this.innerText)" style="font-size:1.6rem;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#fff;margin-bottom:8px;">${ev.title || 'Nome do Convívio'}</div>
                        <div style="display:flex;gap:12px;flex-wrap:wrap;color:#a0aabf;font-size:0.9rem;">
                            <div onclick="promptNativeEventDateISO(${i}, event)" style="cursor: pointer; padding: 2px 4px; border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                                <i class="far fa-calendar-alt"></i> <span>${ev.date || 'Data'}</span>
                            </div>
                            <span><i class="fas fa-map-marker-alt"></i> <span class="builder-editable" contenteditable="true" onblur="updateNativeArrayField('events', ${i}, 'location', this.innerText)">${ev.location || 'Local'}</span></span>
                            <span class="status-tag builder-editable" contenteditable="true" onblur="updateNativeArrayField('events', ${i}, 'status', this.innerText)" style="min-width:50px;background:rgba(255,255,255,0.15);color:#fff;">${ev.status || 'Estado'}</span>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:16px;background:rgba(255,255,255,0.07);padding:12px 20px;border-radius:24px;">
                        <img src="${nemLogo}" style="height:120px;object-fit:contain;" alt="NEM">
                        ${guestLogo || barLogo ? '<div style="height:60px;width:1px;background:rgba(255,255,255,0.2);"></div>' : ''}
                        ${logoSlot(guestLogo, 'guestLogo', 'Curso')}
                        ${guestLogo && barLogo ? '<div style="height:60px;width:1px;background:rgba(255,255,255,0.2);"></div>' : ''}
                        ${logoSlot(barLogo, 'barLogo', 'Bar')}
                    </div>
                </div>
                <div style="background:rgba(var(--accent-rgb,149,3,4),0.15);border:1px solid rgba(149,3,4,0.3);padding:16px 20px;border-radius:12px;border-left:4px solid var(--accent);display:flex;align-items:center;gap:16px;">
                    <i class="fas fa-ticket-alt" style="font-size:1.5rem;color:var(--accent);"></i>
                    <div style="flex:1;">
                        <div style="font-weight:700;color:#fff;font-size:0.9rem;margin-bottom:2px;">Senhas</div>
                        <div class="builder-editable" contenteditable="true" onblur="updateNativeArrayField('events', ${i}, 'tokenInfo', this.innerText)" style="color:#cbd5e1;font-size:0.9rem;min-height:20px;">${ev.tokenInfo || '1 senha - 2,5€ - 3 imperiais/shots da casa ou 2 sangrias/sidras/shots ou 1 bifana'}</div>
                    </div>
                    <button onclick="promptNativeUrl('events', ${i}, 'formUrl', event)" class="btn btn-secondary" style="white-space:nowrap;background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.2);color:#fff;flex-shrink:0;"><i class="fas fa-link"></i> Link</button>
                </div>
            </div>
        </div>`;
    };

    const renderEvent = (ev, i) => ev.type === 'convivio'
        ? renderConvivioEvent(ev, i)
        : renderRegularEvent(ev, i);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = [];
    const archived = [];
    (d.events || []).forEach((ev, i) => {
        const eventDate = ev.dateISO ? new Date(ev.dateISO) : new Date(8640000000000000);
        if (eventDate < today) archived.push({ ev, i });
        else upcoming.push({ ev, i });
    });

    upcoming.sort((a, b) => new Date(a.ev.dateISO || 0) - new Date(b.ev.dateISO || 0));
    archived.sort((a, b) => new Date(b.ev.dateISO || 0) - new Date(a.ev.dateISO || 0));

    const upcomingHtml = upcoming.length > 0
        ? upcoming.map(item => renderEvent(item.ev, item.i)).join('')
        : `<div class="empty-state" style="padding: 24px;"><i class="fas fa-calendar-alt empty-icon"></i><p>Sem eventos agendados. Clica abaixo para adicionar.</p></div>`;

    const archivedHtml = archived.length > 0
        ? `<details style="margin-top: 32px;">
                <summary style="cursor: pointer; font-weight: 600; color: var(--text-secondary); padding: 8px 0; list-style: none; display: flex; align-items: center; gap: 8px; user-select: none;">
                    <i class="fas fa-archive"></i> Eventos Arquivados (${archived.length})
                    <i class="fas fa-chevron-down" style="margin-left: auto; font-size: 0.8rem;"></i>
                </summary>
                <div style="display: flex; flex-direction: column; gap: 16px; margin-top: 16px; opacity: 0.7;">
                    ${archived.map(item => renderEvent(item.ev, item.i)).join('')}
                </div>
            </details>`
        : '';

    const addHtml = `
        <button class="btn btn-secondary" style="width: 100%; justify-content: center; padding: 16px; border: 2px dashed var(--panel-border); background: rgba(255,255,255,0.5); color: var(--text-secondary);" onclick="addNativeArrayItem('event')">
            <i class="fas fa-plus"></i> Adicionar Evento
        </button>
    `;

    container.innerHTML = `
        <div style="pointer-events: auto; padding: 48px 24px; background: var(--bg-main); border-radius: var(--radius-md);">
            <div style="margin-bottom: 32px;">
                <h2>Próximas Atividades</h2>
                <p style="color: var(--text-secondary); margin: 0;">Não percas os próximos eventos.</p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 24px;">
                ${upcomingHtml}
                ${addHtml}
            </div>
            ${archivedHtml}
        </div>
    `;
};

window.setEventType = function (index, type) {
    if (!state.data.events[index]) return;
    state.data.events[index].type = type;
    // Set sensible defaults for new convívio fields if not already set
    if (type === 'convivio') {
        if (!state.data.events[index].nemLogo) state.data.events[index].nemLogo = 'Vetorizado.svg';
        if (!state.data.events[index].guestLogo) state.data.events[index].guestLogo = '';
        if (!state.data.events[index].barLogo) state.data.events[index].barLogo = '';
        if (!state.data.events[index].tokenInfo) state.data.events[index].tokenInfo = '1 senha - 2,5€ - 3 imperiais/shots da casa ou 2 sangrias/sidras/shots ou 1 bifana';
    }
    renderNativeLivePreviews();
    saveData();
};

window.renderSocialsPreview = function () {
    const container = document.getElementById('socials-preview-container');
    if (!container) return;

    const d = state.data;

    container.innerHTML = `
        <div style="pointer-events: auto;">
            <footer style="background: var(--bg-card); padding: 64px 24px 32px; border: 1px solid var(--panel-border); border-radius: var(--radius-md); text-align: center;">
                <div style="max-width: 1200px; margin: 0 auto;">
                    <div style="margin-bottom: 32px;">
                        <h2 style="font-family: 'Merriweather', serif; font-size: 1.5rem; margin-bottom: 16px;">Segue-nos</h2>
                        <div style="display: flex; gap: 32px; justify-content: center;">
                            <div class="social-icon" style="cursor: pointer; position: relative; width: 48px; height: 48px; border-radius: 50%; background: var(--bg-main); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; border: 1px solid var(--panel-border); transition: 0.2s;" onclick="promptNativeSocial('instagram')" title="${d.instagram || 'Sem Link'}">
                                <i class="fab fa-instagram" style="color: var(--text-primary);"></i>
                                <span style="position: absolute; bottom: -24px; font-size: 0.75rem; color: var(--text-tertiary); left: 50%; transform: translateX(-50%); white-space: nowrap; background: var(--bg-main); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--panel-border); box-shadow: var(--shadow-sm);">Editar Link</span>
                            </div>
                            <div class="social-icon" style="cursor: pointer; position: relative; width: 48px; height: 48px; border-radius: 50%; background: var(--bg-main); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; border: 1px solid var(--panel-border); transition: 0.2s;" onclick="promptNativeSocial('email')" title="${d.email || 'Sem Email'}">
                                <i class="far fa-envelope" style="color: var(--text-primary);"></i>
                                <span style="position: absolute; bottom: -24px; font-size: 0.75rem; color: var(--text-tertiary); left: 50%; transform: translateX(-50%); white-space: nowrap; background: var(--bg-main); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--panel-border); box-shadow: var(--shadow-sm);">Editar Email</span>
                            </div>
                        </div>
                    </div>
                    <p style="color: var(--text-tertiary); font-size: 0.9rem; margin: 40px 0 0 0;">
                        &copy; ${new Date().getFullYear()} <span class="builder-editable" contenteditable="true" onblur="updateNativeField('footerOrgName', this.innerText)">${d.footerOrgName || 'NEM'}</span>. Todos os direitos reservados.
                    </p>
                </div>
            </footer>
        </div>
    `;
};

window.promptNativeSocial = async function (type) {
    if (!state.data.socials) state.data.socials = {};
    const current = state.data.socials[type] || '';
    const label = type === 'instagram' ? 'Link do Instagram (URL completo)' : 'Email de Contacto';
    const val = await customPrompt(label, current);
    if (val !== null) {
        state.data.socials[type] = val.trim();
        fillForms();
        renderNativeLivePreviews();
        saveData();
    }
};

window.renderInstagramPreview = function () {
    const container = document.getElementById('instagram-preview-container');
    if (!container) return;

    const posts = (state.data.instagramPosts || []).filter(u => u && u.startsWith('http'));
    const MAX = 3;

    const postCards = posts.map((url, i) => {
        // Extract post ID for thumbnail preview
        const match = url.match(/instagram\.com\/p\/([^/?#]+)/);
        const postId = match ? match[1] : null;
        const thumbUrl = postId ? `https://www.instagram.com/p/${postId}/media/?size=m` : null;
        const cleanUrl = url.replace(/\/$/, '').split('?')[0];
        // Extract just the post ID for a clean label
        const shortUrl = postId ? postId : cleanUrl;

        return `
        <div style="position: relative; overflow: visible;">
            <button style="position: absolute; top: -10px; right: -10px; background: var(--danger); color: white; border: none; border-radius: 50%; width: 26px; height: 26px; padding: 0; box-shadow: var(--shadow-md); z-index: 20; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.75rem;" onclick="removeInstagramPost(${i}, event)" title="Remover"><i class="fas fa-times"></i></button>
            <div class="card" style="display: flex; gap: 16px; align-items: center; padding: 16px;">
                <div style="width: 72px; height: 72px; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; background: var(--bg-main); border: 1px solid var(--panel-border); display: flex; align-items: center; justify-content: center;">
                    ${thumbUrl
                ? `<img src="${thumbUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<i class=\\'fab fa-instagram\\' style=\\'font-size:1.8rem;color:var(--accent)\\'></i>'">`
                : `<i class="fab fa-instagram" style="font-size: 1.8rem; color: var(--accent);"></i>`
            }
                </div>
                <div style="flex: 1; min-width: 0; overflow: hidden;">
                    <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); margin-bottom: 4px;">Post ${i + 1}</div>
                    <div style="font-size: 0.8rem; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${url}">${shortUrl}</div>
                    <a href="${url}" target="_blank" style="font-size: 0.8rem; color: var(--accent); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px;"><i class="fas fa-external-link-alt"></i> Ver post</a>
                </div>
                <button onclick="editInstagramPost(${i}, event)" class="btn btn-secondary" style="flex-shrink: 0; padding: 6px 12px; font-size: 0.8rem;"><i class="fas fa-pencil-alt"></i></button>
            </div>
        </div>`;
    }).join('');

    const canAdd = posts.length < MAX;
    const addHtml = canAdd ? `
        <button class="btn btn-secondary" style="width: 100%; justify-content: center; padding: 14px; border: 2px dashed var(--panel-border); background: rgba(255,255,255,0.5); color: var(--text-secondary);" onclick="addInstagramPost(event)">
            <i class="fab fa-instagram" style="margin-right: 8px;"></i> Adicionar Post do Instagram
        </button>` : `<p style="text-align:center; color: var(--text-tertiary); font-size: 0.85rem; margin: 8px 0 0;">Máximo de ${MAX} posts atingido</p>`;

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
            ${posts.length === 0 ? `<div class="empty-state" style="padding: 24px;"><i class="fab fa-instagram empty-icon"></i><p>Sem posts. Clica abaixo para adicionar.</p></div>` : postCards}
            ${addHtml}
            <p class="hint" style="margin: 0; font-size: 0.8rem;">Vai a um post → ⋯ → Incorporar → Copia o link do post (não o código iframe).</p>
        </div>
    `;

    // Sync hidden textarea
    const ta = document.getElementById('cfg-instagramPosts');
    if (ta) ta.value = posts.join('\n');
};

// Accepts a plain URL or the full Instagram blockquote embed code → returns clean URL
function extractInstagramUrl(input) {
    if (!input) return null;
    // Full embed code: extract data-instgrm-permalink="..."
    const permalinkMatch = input.match(/data-instgrm-permalink="([^"]+)"/);
    if (permalinkMatch) return permalinkMatch[1];
    // Plain URL
    if (input.startsWith('http')) return input;
    return null;
}

window.addInstagramPost = async function (e) {
    if (e) { try { e.preventDefault(); e.stopPropagation(); } catch (err) { } }
    const val = await customPrompt('URL ou código de incorporação do Instagram:', '');
    if (!val || !val.trim()) return;
    const url = extractInstagramUrl(val.trim());
    if (!url) { alert('URL inválido. Copia o link ou o código de incorporação do Instagram.'); return; }
    if (!state.data.instagramPosts) state.data.instagramPosts = [];
    const clean = url.split('?')[0].replace(/\/$/, '') + '/';
    if (!state.data.instagramPosts.includes(clean)) {
        state.data.instagramPosts.push(clean);
    }
    renderInstagramPreview();
    saveData();
};

window.editInstagramPost = async function (index, e) {
    if (e) { try { e.preventDefault(); e.stopPropagation(); } catch (err) { } }
    const current = (state.data.instagramPosts || [])[index] || '';
    const val = await customPrompt('Editar URL ou código de incorporação:', current);
    if (val !== null) {
        const url = extractInstagramUrl(val.trim()) || val.trim();
        const clean = url.split('?')[0].replace(/\/$/, '') + '/';
        state.data.instagramPosts[index] = clean;
        renderInstagramPreview();
        saveData();
    }
};

window.removeInstagramPost = async function (index, e) {
    if (e) { try { e.preventDefault(); e.stopPropagation(); } catch (err) { } }
    const ok = await customConfirm('Remover este post da lista?', 'Remover Post');
    if (ok) {
        state.data.instagramPosts.splice(index, 1);
        renderInstagramPreview();
        saveData();
    }
};

function openItemModal(type, index = -1) {
    state.editingItem = { type, index };
    const modal = document.getElementById('item-modal');
    const fields = document.getElementById('modal-fields');
    const title = document.getElementById('modal-title');

    document.body.style.overflow = 'hidden';
    modal.style.display = 'flex';
    title.textContent = (index === -1 ? 'Adicionar ' : 'Editar ') + (type === 'member' ? 'Membro' : type === 'merch' ? 'Produto' : 'Evento');
    setTimeout(updateModalScale, 10);

    const existing = index === -1 ? {}
        : type === 'member' ? state.data.members[index]
            : type === 'merch' ? state.data.merch[index]
                : state.data.events[index];

    if (type === 'member') {
        fields.innerHTML = `
            <label class="field" style="margin-bottom: 12px;">Nome <input type="text" id="m-name" value="${existing.name || ''}" required></label>
            <label class="field" style="margin-bottom: 12px;">Cargo <input type="text" id="m-role" value="${existing.role || ''}" required></label>
            <div style="margin-bottom: 12px;">
                <label class="field">Foto (URL ou Base64) <input type="text" id="m-photo" value="${existing.photo || ''}"></label>
                <input type="file" id="m-photo-file" style="display: none;" accept="image/*" onchange="handleFileUpload(this, 'm-photo')">
                <button type="button" class="btn btn-secondary" style="width: 100%; margin-top: 4px;" onclick="document.getElementById('m-photo-file').click()"><i class="fas fa-upload"></i> Carregar Foto</button>
            </div>
            <label class="field" style="margin-bottom: 12px;">Instagram User <input type="text" id="m-ig" value="${existing.ig || ''}" placeholder="@user"></label>
        `;
    } else if (type === 'merch') {
        fields.innerHTML = `
            <label class="field" style="margin-bottom: 12px;">Nome <input type="text" id="p-name" value="${existing.name || ''}" required></label>
            <label class="field" style="margin-bottom: 12px;">Preço (€) <input type="number" id="p-price" value="${existing.price || ''}" step="0.5" required></label>
            <label class="field" style="margin-bottom: 12px;">Descrição <textarea id="p-description">${existing.description || ''}</textarea></label>
            <div style="margin-bottom: 12px;">
                <label class="field">Imagens (Uma URL/Base64 por linha) <textarea id="p-images" rows="3" placeholder="https://...">${(existing.images || [existing.image] || []).filter(Boolean).join('\n')}</textarea></label>
                <input type="file" id="p-images-file" style="display: none;" accept="image/*" onchange="handleFileUpload(this, 'p-images', true)">
                <button type="button" class="btn btn-secondary" style="width: 100%; margin-top: 4px;" onclick="document.getElementById('p-images-file').click()"><i class="fas fa-upload"></i> Adicionar Foto</button>
            </div>
            <label class="field" style="margin-bottom: 12px;">Link Formulário (URL ou Iframe) <textarea id="p-form" rows="2" placeholder="Cola o link ou o código do iframe">${existing.formUrl || ''}</textarea></label>
        `;
    } else {
        fields.innerHTML = `
            <label class="field" style="margin-bottom: 12px;">Título do Evento <input type="text" id="e-title" value="${existing.title || ''}" required></label>
            <div class="form-row">
                <label class="field">Data e Hora (Para esconder/ordenar) <input type="datetime-local" id="e-dateISO" value="${existing.dateISO || ''}" required></label>
                <label class="field">Data Display (e.g. 15 Out.) <input type="text" id="e-date" value="${existing.date || ''}" required></label>
            </div>
            <label class="field" style="margin-bottom: 12px;">Estado/Status (e.g. Confirmado) <input type="text" id="e-status" value="${existing.status || ''}" placeholder="Em discussão, Adiado..."></label>
            <label class="field" style="margin-bottom: 12px;">Localização <input type="text" id="e-location" value="${existing.location || ''}"></label>
            <label class="field" style="margin-bottom: 12px;">Embedded MS Form (URL ou Iframe) <textarea id="e-form" rows="2" placeholder="Cola o link ou o código do iframe">${existing.formUrl || ''}</textarea></label>
        `;
    }
}

function saveItemFromModal() {
    const { type, index } = state.editingItem;
    let newItem = {};

    if (type === 'member') {
        newItem = {
            name: document.getElementById('m-name').value,
            role: document.getElementById('m-role').value,
            photo: document.getElementById('m-photo').value,
            ig: document.getElementById('m-ig').value
        };
        if (index === -1) state.data.members.push(newItem);
        else state.data.members[index] = newItem;
    } else if (type === 'merch') {
        newItem = {
            name: document.getElementById('p-name').value,
            price: document.getElementById('p-price').value,
            description: document.getElementById('p-description').value,
            images: document.getElementById('p-images').value.split('\n').map(u => u.trim()).filter(Boolean),
            image: document.getElementById('p-images').value.split('\n')[0]?.trim() || '',
            formUrl: extractIframeSrc(document.getElementById('p-form').value)
        };
        if (index === -1) state.data.merch.push(newItem);
        else state.data.merch[index] = newItem;
    } else {
        newItem = {
            title: document.getElementById('e-title').value,
            date: document.getElementById('e-date').value,
            dateISO: document.getElementById('e-dateISO').value,
            status: document.getElementById('e-status').value,
            location: document.getElementById('e-location').value,
            formUrl: extractIframeSrc(document.getElementById('e-form').value)
        };
        if (index === -1) state.data.events.push(newItem);
        else state.data.events[index] = newItem;
    }

    document.getElementById('item-modal').style.display = 'none';
    renderAdminLists();
    saveData();
}

window.editItem = function (type, index) { openItemModal(type, index); };
window.deleteItem = async function (type, index) {
    const ok = await customConfirm('Tem a certeza que deseja apagar este item?', 'Apagar Item');
    if (ok) {
        if (type === 'member') state.data.members.splice(index, 1);
        if (type === 'merch') state.data.merch.splice(index, 1);
        if (type === 'event') state.data.events.splice(index, 1);
        renderAdminLists();
        saveData();
    }
};

// ─── MODAL SCALING ───────────────────────────────────────────────
window.updateModalScale = function () {
    ['item-modal', 'add-section-modal'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal && modal.style.display !== 'none') {
            const card = modal.querySelector('.card');
            if (card) {
                card.style.transform = 'none'; // reset to measure accurately

                // The modal container has 24px padding on all sides (48px total vertical padding)
                const availableHeight = window.innerHeight - 48;
                const actualHeight = card.offsetHeight;

                if (actualHeight > availableHeight) {
                    const scale = availableHeight / actualHeight;
                    card.style.transform = `scale(${scale})`;
                    // Scale from the top so it doesn't get pushed down by flexbox alignment
                    card.style.transformOrigin = 'top center';
                } else {
                    card.style.transform = 'none';
                }
            }
        }
    });
};

window.addEventListener('resize', updateModalScale);

// ─── DRAG & DROP / PASTE IMAGE SUPPORT ────────────────────────────────────────

/**
 * Routes a File object through compress + optional GitHub upload and returns the final URL.
 */
async function _processDroppedImage(file, githubType) {
    const base64 = await compressImage(file);
    return await uploadImageToGithub(base64, githubType);
}

/** 1 ─ BUILDER PREVIEW DROP ZONE (Gallery / Partnership sections) */
function setupBuilderDropZone() {
    const container = document.getElementById('ns-builder-preview');
    if (!container || container._dropSetup) return;
    container._dropSetup = true;

    const ALLOWED = ['fa-images', 'fa-handshake'];

    container.addEventListener('dragover', (e) => {
        if (!ALLOWED.includes(builderState.icon)) return;
        e.preventDefault();
        e.stopPropagation();
        container.style.outline = '3px dashed var(--accent)';
        container.style.outlineOffset = '-3px';
    });

    container.addEventListener('dragleave', (e) => {
        if (!container.contains(e.relatedTarget)) {
            container.style.outline = '';
        }
    });

    container.addEventListener('drop', async (e) => {
        e.preventDefault();
        container.style.outline = '';
        if (!ALLOWED.includes(builderState.icon)) return;
        const files = [...(e.dataTransfer.files || [])].filter(f => f.type.startsWith('image/'));
        if (!files.length) return;
        showToast('A compilar imagem...', 'info');
        try {
            for (const file of files) {
                const src = await _processDroppedImage(file, 'sections');
                builderState.items.push(src);
            }
            renderBuilderPreview();
            showToast(`${files.length > 1 ? files.length + ' imagens adicionadas' : 'Imagem adicionada'}!`);
        } catch (err) {
            showToast('Erro ao processar imagem', 'danger');
        }
    });
}

/** 2 ─ LOGO PICKER MODAL DROP ZONE */
function setupLogoPickerDropZone() {
    const modal = document.getElementById('logo-picker-modal');
    if (!modal || modal._dropSetup) return;
    modal._dropSetup = true;

    const card = modal.querySelector('.card') || modal;

    card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        card.style.outline = '3px dashed var(--accent)';
        card.style.outlineOffset = '-3px';
    });

    card.addEventListener('dragleave', (e) => {
        if (!card.contains(e.relatedTarget)) card.style.outline = '';
    });

    card.addEventListener('drop', async (e) => {
        e.preventDefault();
        card.style.outline = '';
        const type = document.getElementById('logo-picker-type')?.value;
        if (!type) return;
        const files = [...(e.dataTransfer.files || [])].filter(f => f.type.startsWith('image/'));
        if (!files.length) return;
        showToast('A compilar logo...', 'info');
        try {
            const base64 = await compressImage(files[0]);
            const ghType = type === 'guest' ? 'partner_courses' : 'bars';
            const src = await uploadImageToGithub(base64, ghType);
            if (type === 'guest') state.data.libraryCourses.push({ src, addedAt: Date.now() });
            else if (type === 'bar') state.data.libraryBars.push({ src, addedAt: Date.now() });
            selectLogo(src);
            showToast('Logo carregado e selecionado!');
        } catch (err) {
            showToast('Erro ao processar logo', 'danger');
        }
    });
}

/** 3 ─ NATIVE MEMBER / MERCH IMAGE DROP ZONES (event-delegated on containers) */
function setupNativeDropZones() {
    ['team-preview-container', 'merch-preview-container'].forEach(containerId => {
        const container = document.getElementById(containerId);
        if (!container || container._dropSetup) return;
        container._dropSetup = true;

        container.addEventListener('dragover', (e) => {
            const wrapper = e.target.closest('[data-native="true"]');
            if (!wrapper) return;
            e.preventDefault();
            e.stopPropagation();
            wrapper.style.outline = '3px dashed var(--accent)';
            wrapper.style.outlineOffset = '-3px';
        });

        container.addEventListener('dragleave', (e) => {
            const wrapper = e.target.closest('[data-native="true"]');
            if (wrapper && !wrapper.contains(e.relatedTarget)) {
                wrapper.style.outline = '';
            }
        });

        container.addEventListener('drop', async (e) => {
            const wrapper = e.target.closest('[data-native="true"]');
            if (!wrapper) return;
            e.preventDefault();
            wrapper.style.outline = '';
            const files = [...(e.dataTransfer.files || [])].filter(f => f.type.startsWith('image/'));
            if (!files.length) return;
            const arrayKey = wrapper.dataset.arrayKey;
            const index = parseInt(wrapper.dataset.index);
            const fieldKey = wrapper.dataset.fieldKey;
            if (!arrayKey || isNaN(index) || !fieldKey) return;
            if (!state.data[arrayKey] || !state.data[arrayKey][index]) return;
            showToast('A processar imagem...', 'info');
            try {
                const ghType = arrayKey === 'merch' ? 'merch' : 'members';
                const src = await _processDroppedImage(files[0], ghType);
                if (arrayKey === 'merch' && fieldKey === 'image') {
                    if (!state.data.merch[index].images) state.data.merch[index].images = [];
                    state.data.merch[index].images.push(src);
                    if (state.data.merch[index].images.length === 1) state.data.merch[index].image = src;
                } else {
                    state.data[arrayKey][index][fieldKey] = src;
                }
                renderAdminLists();
                renderNativeLivePreviews();
                saveData();
                showToast('Imagem carregada!');
            } catch (err) {
                showToast('Erro ao carregar imagem', 'danger');
            }
        });
    });
}

/** 4 ─ GLOBAL PASTE (Ctrl+V / Cmd+V) SUPPORT */
document.addEventListener('paste', async (e) => {
    // Only intercept if an image is in the clipboard
    const items = [...(e.clipboardData?.items || [])].filter(i => i.type.startsWith('image/'));
    if (!items.length) return;
    const file = items[0].getAsFile();
    if (!file) return;

    const builderModal = document.getElementById('add-section-modal');
    const logoModal = document.getElementById('logo-picker-modal');

    // Context A: Section Builder modal (only for image-type sections)
    if (builderModal && builderModal.style.display === 'flex') {
        const ALLOWED = ['fa-images', 'fa-handshake'];
        if (!ALLOWED.includes(builderState.icon)) {
            showToast('Cole imagens apenas em secções de Galeria ou Parcerias.', 'danger');
            return;
        }
        e.preventDefault();
        showToast('A compilar imagem colada...', 'info');
        try {
            const src = await _processDroppedImage(file, 'sections');
            builderState.items.push(src);
            renderBuilderPreview();
            showToast('Imagem adicionada!');
        } catch (err) { showToast('Erro ao processar imagem', 'danger'); }
        return;
    }

    // Context B: Logo Picker modal
    if (logoModal && logoModal.style.display === 'flex') {
        const type = document.getElementById('logo-picker-type')?.value;
        if (!type) return;
        e.preventDefault();
        showToast('A compilar logo colado...', 'info');
        try {
            const base64 = await compressImage(file);
            const ghType = type === 'guest' ? 'partner_courses' : 'bars';
            const src = await uploadImageToGithub(base64, ghType);
            if (type === 'guest') state.data.libraryCourses.push({ src, addedAt: Date.now() });
            else if (type === 'bar') state.data.libraryBars.push({ src, addedAt: Date.now() });
            selectLogo(src);
            showToast('Logo colado e selecionado!');
        } catch (err) { showToast('Erro ao processar logo', 'danger'); }
        return;
    }
});

// Re-apply native drop zones each time the previews re-render
const _origRenderNativeLivePreviews = window.renderNativeLivePreviews;
window.renderNativeLivePreviews = function () {
    _origRenderNativeLivePreviews.apply(this, arguments);
    // Reset flags so delegation is re-registered on the (possibly re-created) containers
    ['team-preview-container', 'merch-preview-container'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el._dropSetup = false;
    });
    setupNativeDropZones();
};

// Bootstrap static drop zones after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupBuilderDropZone();
    setupLogoPickerDropZone();
    setupNativeDropZones();
});
