// ─── CONFIGURATION ────────────────────────────────────────────────
// The Gist ID will be stored in localStorage or hardcoded here after initialization
const DEFAULT_GIST_ID = '3aab0c11bfa7f69760e17dd067c65247'; // Leave empty for first-time setup

const DEFAULT_DATA = {
    siteTitle: "NEM — Núcleo de Engenharia Mecânica | ESTG-IPLeiria",
    shortName: "NEM",
    mandateYear: "2025/2026",
    heroTitle: "Núcleo de Engenharia Mecânica",
    heroDescription: "Representamos os estudantes de Engenharia Mecânica da ESTG - IPLeiria. Inovação, tradição e futuro.",
    aboutText: "O NEM é o órgão representativo dos alunos de Engenharia Mecânica na Escola Superior de Tecnologia e Gestão de Leiria. O nosso objetivo é dinamizar a vida académica, promover parcerias com a indústria e apoiar os estudantes em todas as frentes.",
    footerOrgName: "NEM ESTG",
    socials: {
        instagram: "https://www.instagram.com/nem_estg/",
        email: "nem.estg@my.ipleiria.pt"
    },
    // Section visibility — all on by default, instagram off until posts are added
    sections: {
        about: true,
        members: true,
        merch: true,
        calendar: true,
        instagram: false
    },
    // Section render order
    sectionOrder: ["about", "members", "merch", "calendar", "instagram"],
    // Instagram post URLs (admin pastes 2-3 public post URLs)
    instagramPosts: [],
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
    ],
    maintenanceMode: false,
    maintenanceMessage: "Estamos a trabalhar para melhorar o site. Voltamos já já!",
    libraryCourses: [],
    libraryBars: []
};

const state = {
    gistId: localStorage.getItem('nem_gist_id') || DEFAULT_GIST_ID,
    data: DEFAULT_DATA // Fallback by default
};

// ─── INITIALIZATION ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    if (!state.gistId) {
        console.warn('No Gist ID found. Using fallback data.');
        renderSite();
        hideLoader();
        return;
    }

    try {
        await fetchData();
        renderSite();
    } catch (error) {
        console.error('Error fetching data from Gist:', error);
        // Fallback already in state.data
        renderSite();
    } finally {
        hideLoader();
    }
});

function showMaintenancePage() {
    // Suppress the background watermark during maintenance
    document.body.classList.add('maintenance-mode');
    const d = state.data;
    const ig = d.socials && d.socials.instagram ? d.socials.instagram : '';
    const em = d.socials && d.socials.email ? d.socials.email : '';
    document.body.innerHTML = `
        <div style="min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; background:var(--bg-main,#f5f0ea); font-family:'Inter',system-ui,sans-serif; padding:32px; text-align:center;">
            <img src="Vetorizado_red_black.svg" alt="NEM Logo" style="width:140px; height:140px; object-fit:contain; margin-bottom:24px;">
            <h1 style="font-size:1.8rem; font-weight:800; margin:0 0 12px; color:var(--text-primary,#1a1a1a);">${d.shortName || 'NEM'}</h1>
            <p style="font-size:1.1rem; color:var(--text-secondary,#666); max-width:480px; line-height:1.6; margin:0 0 32px;">${d.maintenanceMessage || 'Site em manutenção. Voltamos em breve!'}</p>
            <div style="display:flex; gap:20px; justify-content:center; margin-bottom:48px;">
                ${ig ? `<a href="${ig}" target="_blank" title="Instagram" style="width:48px;height:48px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:#c13584;box-shadow:0 2px 12px rgba(0,0,0,0.08);text-decoration:none;border:1px solid rgba(0,0,0,0.06);"><i class="fab fa-instagram"></i></a>` : ''}
                ${em ? `<a href="mailto:${em}" title="Email" style="width:48px;height:48px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:#555;box-shadow:0 2px 12px rgba(0,0,0,0.08);text-decoration:none;border:1px solid rgba(0,0,0,0.06);"><i class="far fa-envelope"></i></a>` : ''}
            </div>
            <a href="admin.html" style="font-size:0.75rem;color:rgba(0,0,0,0.25);text-decoration:none;padding:6px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:20px;transition:0.2s;" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1">⚡ Admin</a>
        </div>`;
    // Inject FontAwesome if not already loaded
    if (!document.querySelector('link[href*="fontawesome"]')) {
        const fa = document.createElement('link');
        fa.rel = 'stylesheet';
        fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        document.head.appendChild(fa);
    }
}


function hideLoader() {
    const loader = document.getElementById('loading-overlay');
    if (!loader) return;
    loader.style.opacity = '0';
    loader.style.transition = 'opacity 0.5s ease';
    setTimeout(() => loader.remove(), 500);
}

// ─── DATA FETCHING ────────────────────────────────────────────────
async function fetchData() {
    // Cache-bust so toggling maintenance mode takes effect immediately
    const response = await fetch(`https://api.github.com/gists/${state.gistId}?t=${Date.now()}`);
    if (!response.ok) throw new Error('Failed to fetch Gist');

    const gist = await response.json();
    const configFile = gist.files['data.json'];
    if (!configFile) throw new Error('data.json not found in Gist');

    const raw = JSON.parse(configFile.content);
    // Merge with defaults so new fields are always present
    state.data = {
        ...DEFAULT_DATA,
        ...raw,
        sections: { ...DEFAULT_DATA.sections, ...(raw.sections || {}) },
        socials: { ...DEFAULT_DATA.socials, ...(raw.socials || {}) },
    };
    if (!state.data.sectionOrder || state.data.sectionOrder.length === 0) {
        state.data.sectionOrder = DEFAULT_DATA.sectionOrder;
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

// ─── RENDERING ────────────────────────────────────────────────────
function renderSite() {
    const d = state.data;

    // ── Maintenance Mode ────────────────────────────────────────
    if (d.maintenanceMode) {
        showMaintenancePage();
        return;
    }
    // ────────────────────────────────────────────────────────────

    const sections = d.sections || DEFAULT_DATA.sections;
    const order = d.sectionOrder || DEFAULT_DATA.sectionOrder;

    // --- Text & Metadata ---
    document.title = d.siteTitle;
    const logoText = document.getElementById('nav-logo-text');
    if (logoText) logoText.textContent = d.shortName;
    document.getElementById('hero-title').textContent = d.heroTitle;
    document.getElementById('hero-description').textContent = d.heroDescription;
    document.getElementById('about-text').textContent = d.aboutText;
    document.getElementById('members-year-title').textContent = `Equipa ${d.mandateYear}`;

    // --- Members ---
    const membersGrid = document.getElementById('members-grid');
    membersGrid.innerHTML = d.members.map(m => `
        <div class="card member-card animate-fade-in">
            <img src="${m.photo || 'https://via.placeholder.com/300x300?text=NEM'}" alt="${m.name}" loading="lazy">
            <h3 style="margin-bottom: 4px;">${m.name}</h3>
            <p style="color: var(--accent); font-weight: 600; margin: 0 0 12px 0; font-size: 0.9rem;">${m.role}</p>
            ${m.ig ? `<a href="https://instagram.com/${m.ig.replace('@', '')}" target="_blank" style="color: var(--text-tertiary);"><i class="fab fa-instagram"></i> @${m.ig.replace('@', '')}</a>` : ''}
        </div>
    `).join('');

    // --- Merch ---
    const merchGrid = document.getElementById('merch-grid');
    merchGrid.innerHTML = d.merch.map(item => {
        return `
        <div class="card merch-card animate-fade-in">
            <img src="${item.image || (item.images && item.images[0]) || 'https://via.placeholder.com/300x300?text=Merch'}" alt="${item.name}" loading="lazy">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h3 style="margin: 0;">${item.name}</h3>
                <span style="font-weight: 700; color: var(--accent);">${item.price}€</span>
            </div>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 16px;">${item.description}</p>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <button onclick="openProductModal(${d.merch.indexOf(item)})" class="btn btn-primary" style="width: 100%;">Saber Mais</button>
            </div>
        </div>
    `}).join('');

    // --- Events ---
    const eventsList = document.getElementById('events-list');
    if (d.events && d.events.length > 0) {
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        const futureEvents = d.events
            .filter(ev => !ev.dateISO || new Date(ev.dateISO) >= today)
            .sort((a, b) => {
                if (!a.dateISO) return 1;
                if (!b.dateISO) return -1;
                return new Date(a.dateISO) - new Date(b.dateISO);
            });

        if (futureEvents.length === 0) {
            eventsList.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-alt empty-icon"></i><p>Sem eventos agendados de momento. Fica atento!</p></div>`;
        } else {
            eventsList.innerHTML = futureEvents.map(ev => {
                // ── Convívio type ────────────────────────────────────────
                if (ev.type === 'convivio') {
                    const nemLogo = ev.nemLogo || 'Vetorizado.svg';
                    const guestLogo = ev.guestLogo || '';
                    const barLogo = ev.barLogo || '';
                    const divider = '<div style="height:36px;width:1px;background:rgba(255,255,255,0.25);"></div>';
                    const logoImg = (src, alt) => src ? `<img src="${src}" alt="${alt}" style="height:120px;object-fit:contain;">` : '';
                    const logosHtml = [
                        logoImg(nemLogo, 'NEM'),
                        guestLogo ? divider + logoImg(guestLogo, 'Curso Convidado') : '',
                        barLogo ? divider + logoImg(barLogo, 'Bar') : ''
                    ].join('');

                    const eventDate = ev.dateISO ? new Date(ev.dateISO) : null;
                    let displayTime = '';
                    let isSoon = false;
                    let countdownText = '';

                    if (eventDate) {
                        displayTime = new Date(ev.dateISO).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
                        const midnightEvent = new Date(eventDate);
                        midnightEvent.setHours(0, 0, 0, 0);
                        const daysRemaining = Math.round((midnightEvent - today) / (1000 * 60 * 60 * 24));

                        isSoon = daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0;
                        if (daysRemaining === 0) countdownText = 'Hoje!';
                        else if (daysRemaining === 1) countdownText = 'Amanhã';
                        else countdownText = `Faltam ${daysRemaining} dias`;
                    }

                    const hasForm = ev.formUrl && (ev.formUrl.includes('forms') || ev.formUrl.includes('tally.so'));
                    const formHtml = hasForm
                        ? `<details class="transition-all"><summary class="btn btn-primary" style="background:var(--accent);">Inscrever Agora</summary><div class="form-wrapper"><iframe src="${ev.formUrl}" allowfullscreen></iframe></div></details>`
                        : ev.formUrl ? `<a href="${ev.formUrl}" target="_blank" class="btn btn-primary" style="background:var(--accent);">Mais Info</a>` : '';

                    return `
                    <div class="animate-fade-in" style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:var(--radius-md);padding:28px;color:white;display:flex;flex-direction:column;gap:20px;box-shadow:var(--shadow-hover); position: relative;">
                        ${isSoon ? `<div class="soon-badge" style="top:-15px;right:24px;"><span class="pulse"></span>${countdownText}</div>` : ''}
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;">
                            <div style="flex:1;min-width:200px;">
                                <h3 style="color:#fff;margin:0 0 8px;font-size:1.4rem;text-transform:uppercase;letter-spacing:1px;">${ev.title}</h3>
                                <div style="display:flex;gap:16px;flex-wrap:wrap;color:#a0aabf;font-size:0.9rem;">
                                    <span><i class="far fa-calendar-alt"></i> ${ev.date}${displayTime ? ' · ' + displayTime : ''}</span>
                                    ${ev.location ? `<span><i class="fas fa-map-marker-alt"></i> ${ev.location}</span>` : ''}
                                    ${ev.status ? `<span class="status-tag" style="background:rgba(255,255,255,0.15);color:#fff;">${ev.status}</span>` : ''}
                                </div>
                            </div>
                            <div style="display:flex;align-items:center;gap:16px;background:rgba(255,255,255,0.07);padding:12px 20px;border-radius:24px;">
                                ${logosHtml}
                            </div>
                        </div>
                        ${ev.tokenInfo ? `
                        <div style="background:rgba(149,3,4,0.15);border:1px solid rgba(149,3,4,0.35);padding:14px 18px;border-radius:12px;border-left:4px solid var(--accent);display:flex;align-items:center;gap:14px;">
                            <i class="fas fa-ticket-alt" style="font-size:1.3rem;color:var(--accent);flex-shrink:0;"></i>
                            <span style="color:#cbd5e1;font-size:0.9rem;">${ev.tokenInfo}</span>
                        </div>` : ''}
                        ${formHtml ? `<div>${formHtml}</div>` : ''}
                    </div>`;
                }

                // ── Regular event ────────────────────────────────────────
                const hasForm = ev.formUrl && (ev.formUrl.includes('forms') || ev.formUrl.includes('tally.so'));
                const eventDate = ev.dateISO ? new Date(ev.dateISO) : null;

                // Compare calendar days (midnight-normalized) so today = 0, tomorrow = 1
                let daysRemaining = null;
                if (eventDate) {
                    const evMidnight = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
                    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    daysRemaining = Math.round((evMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
                }
                const isSoon = daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0;

                let countdownText = '';
                if (isSoon) {
                    if (daysRemaining === 0) countdownText = 'Hoje!';
                    else if (daysRemaining === 1) countdownText = 'Amanhã';
                    else countdownText = `Faltam ${daysRemaining} dias`;
                }

                const displayTime = eventDate ? eventDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '';
                return `
                <div class="card animate-fade-in" style="display: flex; gap: 24px; align-items: center; flex-wrap: wrap; position: relative; overflow: visible;">
                    ${isSoon ? `<div class="soon-badge"><span class="pulse"></span>${countdownText}</div>` : ''}
                    <div style="background: var(--bg-main); padding: 16px; border-radius: var(--radius-md); text-align: center; min-width: 80px; position: relative;">
                        <div style="font-weight: 800; font-size: 1.5rem; color: var(--accent); line-height: 1;">${ev.date.split(' ')[0]}</div>
                        <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700;">${ev.date.split(' ')[1] || ''}</div>
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px;">
                            <h3 style="margin: 0;">${ev.title}</h3>
                            ${ev.status ? `<span class="status-tag">${ev.status}</span>` : ''}
                        </div>
                        <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                            <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;"><i class="fas fa-map-marker-alt" style="margin-right: 8px;"></i>${ev.location}</p>
                            ${displayTime ? `<p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;"><i class="far fa-clock" style="margin-right: 8px;"></i>${displayTime}</p>` : ''}
                        </div>
                    </div>
                    ${hasForm ? `
                        <div style="width: 100%;">
                            <details class="transition-all">
                                <summary class="btn btn-primary">Inscrever Agora</summary>
                                <div class="form-wrapper">
                                    <iframe src="${ev.formUrl}" allowfullscreen></iframe>
                                </div>
                            </details>
                        </div>
                    ` : ev.formUrl ? `
                        <a href="${ev.formUrl}" target="_blank" class="btn btn-secondary">Mais Info</a>
                    ` : ''}
                </div>
            `}).join('');

        }
    } else {
        eventsList.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-alt empty-icon"></i><p>Sem eventos agendados de momento. Fica atento!</p></div>`;
    }

    // --- Instagram Posts ---
    renderInstagramPosts(d.instagramPosts || []);

    // --- Custom Sections ---
    renderCustomSections(d.customSections || []);

    // --- Footer ---
    const s = d.socials || {};
    document.getElementById('footer-org-name').textContent = d.footerOrgName || d.shortName;
    document.getElementById('ig-link').href = s.instagram || '#';
    document.getElementById('email-link').href = s.email ? `mailto:${s.email}` : '#';
    document.getElementById('current-year').textContent = new Date().getFullYear();

    // --- Apply section visibility ---
    applyLayout(sections, order);
}

// ─── INSTAGRAM EMBED ─────────────────────────────────────────────
function renderInstagramPosts(posts) {
    const container = document.getElementById('instagram-feed');
    if (!container) return;

    if (!posts || posts.length === 0) {
        const section = document.getElementById('instagram');
        if (section) section.style.display = 'none';
        return;
    }

    // Render Instagram native embeds using the official blockquote method
    container.innerHTML = posts.slice(0, 3).map(url => {
        const cleanUrl = url.trim().split('?')[0].replace(/\/$/, '');
        return `
        <div class="instagram-post-wrapper">
            <blockquote class="instagram-media"
                data-instgrm-captioned
                data-instgrm-permalink="${cleanUrl}/"
                data-instgrm-version="14"
                style="background:#FFF; border:0; border-radius:3px; box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15); margin:1px; max-width:540px; min-width:326px; padding:0; width:calc(100% - 2px);">
            </blockquote>
        </div>`;
    }).join('');

    // Load embed.js once; if already loaded call process() immediately
    if (window.instgrm && window.instgrm.Embeds) {
        window.instgrm.Embeds.process();
    } else if (!document.getElementById('ig-embed-script')) {
        const script = document.createElement('script');
        script.id = 'ig-embed-script';
        script.src = 'https://www.instagram.com/embed.js';
        script.async = true;
        document.body.appendChild(script);
    }
}




// ─── CUSTOM SECTIONS ─────────────────────────────────────────────
function renderCustomSections(customSections) {
    const main = document.querySelector('main.container');
    if (!main) return;

    // Remove any previously injected custom sections that are no longer in data
    const existingCustom = main.querySelectorAll('section[data-custom-section]');
    existingCustom.forEach(el => el.remove());

    if (!customSections || customSections.length === 0) return;

    // Insert custom sections (they'll be ordered later by applyLayout)
    customSections.forEach(cs => {
        const section = document.createElement('section');
        section.id = cs.id;
        section.setAttribute('data-custom-section', 'true');
        section.className = 'animate-fade-in';
        section.style.animationDelay = '0.3s';
        section.innerHTML = `
            <div style="margin-bottom: 32px; display: flex; align-items: center; gap: 16px;">
                <h2 style="margin:0;"><i class="fas ${cs.icon || 'fa-file-alt'}" style="color: var(--accent); margin-right: 12px;"></i>${cs.label}</h2>
            </div>
            <div class="card" style="line-height: 1.8;">
                ${cs.content || '<p style="color: var(--text-secondary);">Sem conteúdo ainda.</p>'}
            </div>
        `;
        // Insert before the footer
        const footer = document.getElementById('contacts');
        if (footer) {
            main.insertBefore(section, footer);
        } else {
            main.appendChild(section);
        }
    });
}


const SECTION_NAV_MAP = {
    about: null,           // About has no nav link
    members: 'members',
    merch: 'merch',
    calendar: 'calendar',
    instagram: 'instagram'
};

const SECTION_NAV_LABELS = {
    about: 'Sobre',
    members: 'Equipa',
    merch: 'Merch',
    calendar: 'Calendário',
    instagram: 'Instagram'
};

function applyLayout(sections, order) {
    const main = document.querySelector('main.container');
    const navLinks = document.querySelector('.nav-links');
    if (!main || !navLinks) return;

    const d = state.data;

    // Build the ordered list of section element IDs (built-in + custom)
    const sectionIds = {
        about: 'about',
        members: 'members',
        merch: 'merch',
        calendar: 'calendar',
        instagram: 'instagram'
    };
    // Add custom sections to the map
    (d.customSections || []).forEach(cs => {
        sectionIds[cs.id] = cs.id;
    });

    // Nav labels (built-in + custom)
    const navLabels = {
        ...SECTION_NAV_LABELS,
    };
    (d.customSections || []).forEach(cs => {
        navLabels[cs.id] = cs.label;
    });

    // Reorder sections in DOM
    order.forEach(key => {
        const el = document.getElementById(sectionIds[key]);
        if (el) main.appendChild(el);
    });
    // Always keep footer last
    const footer = document.getElementById('contacts');
    if (footer) main.appendChild(footer);

    // Apply visibility to sections
    Object.keys(sectionIds).forEach(key => {
        const el = document.getElementById(sectionIds[key]);
        if (!el) return;
        // Instagram visibility is driven by whether posts exist, not the sections toggle
        if (key === 'instagram') {
            el.style.display = (d.instagramPosts && d.instagramPosts.length > 0) ? '' : 'none';
        } else {
            el.style.display = sections[key] !== false ? '' : 'none';
        }
    });

    // Rebuild nav links in order
    navLinks.innerHTML = '';
    order.forEach(key => {
        if (key === 'about') return;
        // Instagram nav link follows post presence, not sections toggle
        if (key === 'instagram') {
            if (!d.instagramPosts || d.instagramPosts.length === 0) return;
        } else if (sections[key] === false) return;

        const href = key === 'calendar' ? '#calendar' : `#${key}`;
        const label = navLabels[key] || key;
        const a = document.createElement('a');
        a.href = href;
        a.textContent = label;
        navLinks.appendChild(a);
    });
    // Always add Contactos last
    const contact = document.createElement('a');
    contact.href = '#contacts';
    contact.textContent = 'Contactos';
    navLinks.appendChild(contact);
}

// ─── PRODUCT MODAL & SLIDER ─────────────────────────────────────────
let currentSlide = 0;
let modalImages = [];

function openProductModal(index) {
    const product = state.data.merch[index];
    if (!product) return;

    modalImages = product.images && product.images.length > 0 ? product.images : (product.image ? [product.image] : []);
    if (modalImages.length === 0) modalImages.push('https://via.placeholder.com/600x600?text=Merch');
    currentSlide = 0;

    document.getElementById('modal-product-name').textContent = product.name;
    document.getElementById('modal-product-price').textContent = `${product.price}€`;
    document.getElementById('modal-product-description').textContent = product.description;

    const detailedEl = document.getElementById('modal-product-detailed-description');
    if (detailedEl) detailedEl.innerHTML = product.detailedDescription ? product.detailedDescription.replace(/\n/g, '<br>') : '';

    const track = document.getElementById('slider-track');
    const dots = document.getElementById('slider-dots');

    track.innerHTML = modalImages.map(img => `<img src="${img}" alt="">`).join('');
    dots.innerHTML = modalImages.map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></div>`).join('');

    const formContainer = document.getElementById('modal-product-form-container');
    const hasForm = product.formUrl && (product.formUrl.includes('forms') || product.formUrl.includes('tally.so'));

    if (hasForm) {
        formContainer.innerHTML = `
            <div class="form-wrapper" style="margin-top: 0;">
                <iframe src="${product.formUrl}" allowfullscreen></iframe>
            </div>
        `;
    } else {
        formContainer.innerHTML = `
            <a href="${product.formUrl || '#'}" target="_blank" class="btn btn-secondary" style="width: 100%; justify-content: center;">
                <i class="fas fa-external-link-alt"></i> Link Externo
            </a>
        `;
    }

    document.getElementById('product-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    updateSlider();
}

function closeProductModal() {
    document.getElementById('product-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function moveSlider(direction) {
    currentSlide = (currentSlide + direction + modalImages.length) % modalImages.length;
    updateSlider();
}

function goToSlide(index) {
    currentSlide = index;
    updateSlider();
}

function updateSlider() {
    const track = document.getElementById('slider-track');
    const dots = document.querySelectorAll('.dot');

    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    dots.forEach((dot, i) => dot.classList.toggle('active', i === currentSlide));

    const btns = document.querySelectorAll('.slider-btn');
    btns.forEach(btn => btn.style.display = modalImages.length > 1 ? 'flex' : 'none');
}

// Close modal on click outside
window.onclick = function (event) {
    const modal = document.getElementById('product-modal');
    if (event.target == modal) {
        closeProductModal();
    }
}
