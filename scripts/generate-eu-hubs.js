'use strict';

const fs = require('fs');
const path = require('path');
const {
    BASE_URL,
    RSS_LINK_TAG,
    buildOgAlternateLocalesForHub,
    buildHomeHreflangCluster,
    generateCollectionPageSchema,
    generateBreadcrumbSchema,
    generateItemListSchema,
    generateFaqSchema
} = require('./schema-helper');
const { cleanVideoTitle, isUSEUFriendly } = require('./content-filter');

const ROOT_DIR = path.join(__dirname, '..');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'index.html');
const EU_DIR = ROOT_DIR;

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function slugify(title) {
    return String(title || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
        .replace(/-+$/g, '');
}

const EU_HUB_CONFIGS = [
    {
        code: 'de',
        lang: 'de',
        ogLocale: 'de_DE',
        geoRegion: 'DE',
        geoPlace: 'Germany, Austria, Switzerland, Europe',
        languageName: 'German',
        staticCat: 'eu-de',
        queries: ['german', 'european', 'amateur', 'milf', 'hd porn 1080p'],
        title: 'Kostenlose 1080p HD Videos — Deutschland & EU | kumpulenak',
        desc: 'Streame kostenlose 1080p Full HD 60FPS Erwachsenenvideos in Deutschland, Österreich und der Schweiz. Schnelles HTML5-Streaming ohne Anmeldung auf kumpulenak.',
        h1: 'Kostenlose 1080p Full HD Erwachsenenvideos — Deutschland, Österreich &amp; Schweiz',
        sectionLabel: 'Beliebte Deutsche &amp; Europäische 1080p HD Videos',
        breadcrumbName: 'Deutsch (DE/AT/CH)',
        searchPlaceholder: '1080p HD Videos durchsuchen...',
        editorialHeading: 'Deutsche &amp; Europäische Full HD 1080p Video-Sammlung',
        editorialParagraphs: [
            'Willkommen in der deutschsprachigen Ausgabe von kumpulenak für Zuschauer in Deutschland, Österreich und der Schweiz (DACH). Entdecke täglich aktualisierte 1080p Full HD und 60FPS Clips aus über 95 kuratierten Kategorien.',
            'Alle Videos laufen direkt über schnelle europäische Edge-Server im HTML5-Player auf iPhone, Android, Tablet und Desktop — komplett kostenlos, privat und ohne verpflichtende Registrierung.'
        ],
        faqHeading: 'Häufig gestellte Fragen (FAQ)',
        faqs: [
            {
                question: 'Ist das Streaming in 1080p HD in Deutschland, Österreich und der Schweiz kostenlos?',
                answer: 'Ja, alle 1080p Full HD Videos auf kumpulenak können in Deutschland, Österreich, der Schweiz und europaweit zu 100 % kostenlos und ohne Konto gestreamt werden.'
            },
            {
                question: 'Funktioniert der Videoplayer auf Smartphone, Tablet und Smart-TV?',
                answer: 'Ja, unsere europäische Edge-Auslieferung nutzt modernes HTML5-Streaming für Safari (iOS), Chrome (Android) sowie alle Desktop-Browser ohne App-Installation.'
            },
            {
                question: 'Wie oft werden neue deutsche und europäische HD-Videos hinzugefügt?',
                answer: 'Unsere Sammlung wird täglich automatisch aktualisiert, einschließlich beliebter Rubriken wie Deutsch, Europäisch, Amateur, MILF, POV und 60FPS.'
            }
        ],
        featuredCats: [
            { slug: 'german', name: 'Deutsch / German' },
            { slug: 'european', name: 'Europäisch' },
            { slug: 'amateur', name: 'Amateure' },
            { slug: 'milf', name: 'MILF & Reife Frauen' },
            { slug: 'czech', name: 'Tschechisch' },
            { slug: 'pov', name: 'POV' },
            { slug: 'hd-porn-1080p', name: 'Full HD 1080p' },
            { slug: '60-fps', name: '60 FPS' }
        ]
    },
    {
        code: 'fr',
        lang: 'fr',
        ogLocale: 'fr_FR',
        geoRegion: 'FR',
        geoPlace: 'France, Belgium, Switzerland, Europe',
        languageName: 'French',
        staticCat: 'eu-fr',
        queries: ['french', 'european', 'romantic', 'amateur', 'hd porn 1080p'],
        title: 'Vidéos HD 1080p Gratuites — France &amp; Europe | kumpulenak',
        desc: 'Regardez des vidéos adultes 1080p Full HD 60FPS gratuites en France, Belgique et Suisse sur kumpulenak. Streaming HTML5 rapide sur 95+ catégories sans inscription.',
        h1: 'Vidéos Adultes 1080p Full HD Gratuites — France, Belgique &amp; Suisse',
        sectionLabel: 'Meilleures Vidéos Françaises &amp; Européennes 1080p HD',
        breadcrumbName: 'Français (FR/BE/CH)',
        searchPlaceholder: 'Rechercher des vidéos 1080p HD...',
        editorialHeading: 'Streaming Vidéo Full HD 1080p Français &amp; Européen',
        editorialParagraphs: [
            'Bienvenue sur l\'édition francophone de kumpulenak dédiée aux spectateurs de France, Belgique, Suisse et Canada francophone. Parcourez chaque jour des milliers de scènes 1080p Full HD et 60FPS réparties dans 95 catégories.',
            'Grâce à nos serveurs CDN européens à faible latence, profitez d\'une lecture HTML5 fluide sur mobile iOS, Android et ordinateur sans inscription ni abonnement.'
        ],
        faqHeading: 'Questions Fréquentes (FAQ)',
        faqs: [
            {
                question: 'Le streaming 1080p HD est-il gratuit en France, Belgique et Suisse ?',
                answer: 'Oui, toutes les vidéos HD sur kumpulenak sont accessibles gratuitement en France, en Belgique, en Suisse et dans toute l\'Europe sans création de compte.'
            },
            {
                question: 'Puis-je regarder les vidéos sur iPhone et Android sans application ?',
                answer: 'Oui, le lecteur HTML5 natif s\'adapte automatiquement aux smartphones, tablettes et écrans d\'ordinateur avec un chargement instantané.'
            },
            {
                question: 'Quelles catégories francophones et européennes sont les plus populaires ?',
                answer: 'Nos visiteurs francophones privilégient les hubs Français, Européen, Amateur, Romantique, MILF, POV et Full HD 1080p mis à jour quotidiennement.'
            }
        ],
        featuredCats: [
            { slug: 'french', name: 'Français / French' },
            { slug: 'european', name: 'Européen' },
            { slug: 'romantic', name: 'Romantique' },
            { slug: 'amateur', name: 'Amateur' },
            { slug: 'milf', name: 'MILF & Matures' },
            { slug: 'pov', name: 'POV' },
            { slug: 'hd-porn-1080p', name: 'Full HD 1080p' },
            { slug: '60-fps', name: '60 FPS' }
        ]
    },
    {
        code: 'es',
        lang: 'es',
        ogLocale: 'es_ES',
        geoRegion: 'ES',
        geoPlace: 'Spain, Europe, United States',
        languageName: 'Spanish',
        staticCat: 'eu-es',
        queries: ['spanish', 'latina', 'european', 'amateur', 'hd porn 1080p'],
        title: 'Vídeos HD 1080p Gratis — España &amp; Europa | kumpulenak',
        desc: 'Disfruta de vídeos adultos gratis en 1080p Full HD 60FPS en España, Europa y EE.UU. Reproducción HTML5 rápida en más de 95 categorías sin registro en kumpulenak.',
        h1: 'Vídeos Adultos 1080p Full HD Gratis — España, Europa y EE.UU.',
        sectionLabel: 'Vídeos Populares en Español y Europa 1080p HD',
        breadcrumbName: 'Español (ES/US)',
        searchPlaceholder: 'Buscar vídeos 1080p HD...',
        editorialHeading: 'Catálogo Español, Latino y Europeo en 1080p Full HD',
        editorialParagraphs: [
            'Bienvenido a la edición en español de kumpulenak para usuarios en España, Europa y la comunidad hispana en Estados Unidos. Explora estrenos diarios en 1080p Full HD y 60FPS organizados en 95 categorías.',
            'Nuestros servidores edge en Europa y Norteamérica garantizan streaming HTML5 instantáneo en iPhone, Android y ordenador, 100 % gratis y sin registro obligatorio.'
        ],
        faqHeading: 'Preguntas Frecuentes (FAQ)',
        faqs: [
            {
                question: '¿Es gratis ver vídeos en 1080p HD desde España y Estados Unidos?',
                answer: 'Sí, todos los vídeos en kumpulenak se reproducen gratis en alta definición 1080p desde España, Estados Unidos y toda Europa sin necesidad de crear una cuenta.'
            },
            {
                question: '¿Funciona correctamente en teléfonos móviles iOS y Android?',
                answer: 'Sí, nuestro reproductor HTML5 adaptable está optimizado para navegadores móviles y de escritorio con carga ultrarrápida.'
            },
            {
                question: '¿Con qué frecuencia se actualiza el catálogo en español?',
                answer: 'Añadimos nuevos títulos todos los días en categorías destacadas como Español, Latina, Europeo, Amateur, MILF y Full HD 1080p.'
            }
        ],
        featuredCats: [
            { slug: 'spanish', name: 'Español / Spanish' },
            { slug: 'latina', name: 'Latina' },
            { slug: 'european', name: 'Europeo' },
            { slug: 'amateur', name: 'Amateur' },
            { slug: 'milf', name: 'MILF / Maduras' },
            { slug: 'pov', name: 'POV' },
            { slug: 'hd-porn-1080p', name: 'Full HD 1080p' },
            { slug: '60-fps', name: '60 FPS' }
        ]
    },
    {
        code: 'it',
        lang: 'it',
        ogLocale: 'it_IT',
        geoRegion: 'IT',
        geoPlace: 'Italy, Switzerland, Europe',
        languageName: 'Italian',
        staticCat: 'eu-it',
        queries: ['italian', 'european', 'romantic', 'amateur', 'hd porn 1080p'],
        title: 'Video HD 1080p Gratis — Italia &amp; Europa | kumpulenak',
        desc: 'Guarda video per adulti gratis in 1080p Full HD 60FPS in Italia ed Europa su kumpulenak. Streaming HTML5 veloce su oltre 95 categorie senza registrazione.',
        h1: 'Video per Adulti 1080p Full HD Gratis — Italia &amp; Europa',
        sectionLabel: 'Migliori Video Italiani &amp; Europei 1080p HD',
        breadcrumbName: 'Italiano (IT/CH)',
        searchPlaceholder: 'Cerca video 1080p HD...',
        editorialHeading: 'Streaming Video Full HD 1080p Italiano ed Europeo',
        editorialParagraphs: [
            'Benvenuto nell\'edizione italiana di kumpulenak pensata per gli spettatori in Italia e Svizzera italiana. Esplora ogni giorno nuovi video in 1080p Full HD e 60FPS suddivisi in 95 categorie curate.',
            'Grazie ai nodi CDN europei ad alta velocità, ogni clip si avvia istantaneamente via HTML5 su smartphone iOS, Android e desktop, completamente gratis e senza account.'
        ],
        faqHeading: 'Domande Frequenti (FAQ)',
        faqs: [
            {
                question: 'Lo streaming 1080p HD su kumpulenak è gratuito in Italia?',
                answer: 'Sì, tutti i video sono visibili gratuitamente in alta definizione 1080p in Italia, Svizzera e tutta Europa senza registrazione.'
            },
            {
                question: 'Posso guardare i video da smartphone senza scaricare app?',
                answer: 'Certamente: il player HTML5 funziona direttamente su Safari, Chrome e altri browser mobili e desktop con buffering minimo.'
            },
            {
                question: 'Quali categorie sono più seguite in Italia?',
                answer: 'Le raccolte più popolari includono Italiano, Europeo, Amatoriale, MILF, Romantico, POV e Full HD 1080p con aggiornamenti quotidiani.'
            }
        ],
        featuredCats: [
            { slug: 'italian', name: 'Italiano / Italian' },
            { slug: 'european', name: 'Europeo' },
            { slug: 'amateur', name: 'Amatoriale' },
            { slug: 'milf', name: 'MILF & Mature' },
            { slug: 'romantic', name: 'Romantico' },
            { slug: 'pov', name: 'POV' },
            { slug: 'hd-porn-1080p', name: 'Full HD 1080p' },
            { slug: '60-fps', name: '60 FPS' }
        ]
    },
    {
        code: 'nl',
        lang: 'nl',
        ogLocale: 'nl_NL',
        geoRegion: 'NL',
        geoPlace: 'Netherlands, Belgium, Europe',
        languageName: 'Dutch',
        staticCat: 'eu-nl',
        queries: ['european', 'amateur', 'hd porn 1080p', 'blonde', 'milf'],
        title: "Gratis 1080p HD Video's — Nederland &amp; België | kumpulenak",
        desc: "Stream gratis 1080p Full HD 60FPS video's voor volwassenen in Nederland en België op kumpulenak. Snelle HTML5-weergave in 95+ categorieën zonder registratie.",
        h1: "Gratis 1080p Full HD Video's — Nederland &amp; België",
        sectionLabel: "Populaire Europese &amp; 1080p HD Video's",
        breadcrumbName: 'Nederlands (NL/BE)',
        searchPlaceholder: "Zoek 1080p HD video's...",
        editorialHeading: "Nederlandse &amp; Europese 1080p Full HD Video-Directory",
        editorialParagraphs: [
            "Welkom bij de Nederlandstalige editie van kumpulenak voor bezoekers in Nederland en België (Vlaanderen). Bekijk dagelijks vernieuwde 1080p Full HD en 60FPS clips verdeeld over 95 categorieën.",
            "Dankzij snelle Europese CDN-servers in Amsterdam en Frankfurt starten alle HTML5-streams direct op mobiel, tablet en desktop zonder account of abonnement."
        ],
        faqHeading: 'Veelgestelde vragen (FAQ)',
        faqs: [
            {
                question: "Is 1080p HD streamen gratis in Nederland en België?",
                answer: "Ja, alle video's op kumpulenak zijn 100% gratis in 1080p HD te bekijken vanuit Nederland, België en heel Europa zonder registratie."
            },
            {
                question: "Werkt de speler op iPhone, Android en laptop?",
                answer: "Ja, onze mobielvriendelijke HTML5-speler werkt direct in Safari, Chrome, Edge en Firefox zonder downloads."
            },
            {
                question: "Hoe vaak wordt het aanbod bijgewerkt?",
                answer: "De catalogus wordt elke dag automatisch aangevuld met populaire Europese, Amateur, MILF, Blonde, POV en 60FPS releases."
            }
        ],
        featuredCats: [
            { slug: 'european', name: 'Europees' },
            { slug: 'amateur', name: 'Amateur' },
            { slug: 'blonde', name: 'Blond' },
            { slug: 'milf', name: 'MILF' },
            { slug: 'german', name: 'Duits' },
            { slug: 'pov', name: 'POV' },
            { slug: 'hd-porn-1080p', name: 'Full HD 1080p' },
            { slug: '60-fps', name: '60 FPS' }
        ]
    },
    {
        code: 'pl',
        lang: 'pl',
        ogLocale: 'pl_PL',
        geoRegion: 'PL',
        geoPlace: 'Poland, Central Europe, Europe',
        languageName: 'Polish',
        staticCat: 'eu-pl',
        queries: ['european', 'czech', 'amateur', 'milf', 'hd porn 1080p'],
        title: 'Darmowe Filmy HD 1080p — Polska i Europa | kumpulenak',
        desc: 'Oglądaj darmowe filmy dla dorosłych w jakości 1080p Full HD 60FPS w Polsce i Europie na kumpulenak. Szybki odtwarzacz HTML5, 95+ kategorii bez rejestracji.',
        h1: 'Darmowe Filmy 1080p Full HD — Polska i Europa',
        sectionLabel: 'Popularne Europejskie Filmy 1080p HD',
        breadcrumbName: 'Polski (PL)',
        searchPlaceholder: 'Szukaj filmów 1080p HD...',
        editorialHeading: 'Europejski Katalog Filmów 1080p Full HD dla Polski',
        editorialParagraphs: [
            'Witamy w polskiej edycji kumpulenak dla widzów w Polsce i Europie Środkowej. Codziennie publikujemy tysiące wyselekcjonowanych nagrań w jakości 1080p Full HD i 60FPS w ponad 95 kategoriach.',
            'Szybkie europejskie serwery brzegowe zapewniają płynne odtwarzanie HTML5 na smartfonach iPhone, Android oraz komputerach — w 100% za darmo i bez zakładania konta.'
        ],
        faqHeading: 'Najczęściej zadawane pytania (FAQ)',
        faqs: [
            {
                question: 'Czy oglądanie filmów w 1080p HD na kumpulenak jest darmowe w Polsce?',
                answer: 'Tak, wszystkie filmy 1080p HD są dostępne całkowicie za darmo w Polsce i całej Europie bez rejestracji oraz opłat.'
            },
            {
                question: 'Czy strona działa płynnie na telefonach z Androidem i iOS?',
                answer: 'Tak, odtwarzacz HTML5 automatycznie dostosowuje jakość wideo do ekranu smartfona, tabletu i komputera.'
            },
            {
                question: 'Jakie kategorie cieszą się największą popularnością w Europie?',
                answer: 'Najczęściej wybierane działy to Europejskie, Amatorskie, MILF, Czeskie, POV, Blondynki oraz Full HD 1080p aktualizowane codziennie.'
            }
        ],
        featuredCats: [
            { slug: 'european', name: 'Europejskie' },
            { slug: 'czech', name: 'Czeskie' },
            { slug: 'amateur', name: 'Amatorskie' },
            { slug: 'milf', name: 'MILF' },
            { slug: 'blonde', name: 'Blondynki' },
            { slug: 'pov', name: 'POV' },
            { slug: 'hd-porn-1080p', name: 'Full HD 1080p' },
            { slug: '60-fps', name: '60 FPS' }
        ]
    }
];

function generateCardHTML(video, index) {
    const title = cleanVideoTitle(video.title || 'Untitled');
    const safeTitle = escapeHTML(title);
    const slug = slugify(title);
    const videoUrl = `/v/${video.id}${slug ? '-' + slug : ''}`;
    const thumbUrl = (video.default_thumb && video.default_thumb.src) ? video.default_thumb.src : '';
    const views = video.views ? Number(video.views).toLocaleString('en-US') : '0';
    const added = video.added ? video.added.slice(0, 10) : '';
    const length = video.length_min || '';
    const rate = video.rate || '';

    let badges = '';
    if (length) badges += `<span class="badge-duration">${escapeHTML(length)}</span>`;
    if (rate) badges += `<span class="badge-rating">⭐ ${escapeHTML(String(rate))}</span>`;

    const imgAttrs = index < 2
        ? 'width="360" height="202" fetchpriority="high" loading="eager" decoding="async"'
        : 'width="360" height="202" loading="lazy" decoding="async"';

    return `                <a href="${escapeHTML(videoUrl)}" class="card" aria-label="${safeTitle}">
                    <div class="card-img-wrapper">
                        ${badges}
                        <img src="${escapeHTML(thumbUrl)}" alt="${safeTitle} 1080p HD Video Thumbnail" ${imgAttrs} class="loaded" onload="this.classList.add('loaded')" onerror="this.classList.add('loaded'); this.style.background='#333';">
                    </div>
                    <div class="card-meta">
                        <div class="card-date-views">
                            <span class="card-date">📅 ${escapeHTML(added)}</span>
                            <span class="card-views">👁 ${escapeHTML(views)}</span>
                        </div>
                        <h3 class="card-title">${safeTitle}</h3>
                    </div>
                </a>`;
}

async function fetchHubVideos(queries, targetCount = 24) {
    const seen = new Set();
    const collected = [];
    for (const q of queries) {
        if (collected.length >= targetCount) break;
        const url = `https://www.eporner.com/api/v2/video/search/?query=${encodeURIComponent(q)}&per_page=24&page=1&thumbsize=big&order=most-popular&gay=0&lq=1&format=json`;
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            if (!data || !Array.isArray(data.videos)) continue;
            for (const v of data.videos) {
                if (!v || !v.id || seen.has(v.id)) continue;
                if (!v.default_thumb || !v.default_thumb.src) continue;
                if (!isUSEUFriendly(v)) continue;
                v.title = cleanVideoTitle(v.title);
                seen.add(v.id);
                collected.push(v);
                if (collected.length >= targetCount) break;
            }
            await new Promise(r => setTimeout(r, 120));
        } catch (err) {
            console.warn(`Warning fetching EU hub query "${q}":`, err.message);
        }
    }
    return collected;
}

function buildLangBarHtml(activeCode) {
    const items = [
        { code: 'en', href: '/', label: '🇺🇸🇬🇧 English (US/UK)' },
        { code: 'de', href: '/de', label: '🇩🇪 Deutsch' },
        { code: 'fr', href: '/fr', label: '🇫🇷 Français' },
        { code: 'es', href: '/es', label: '🇪🇸 Español' },
        { code: 'it', href: '/it', label: '🇮🇹 Italiano' },
        { code: 'nl', href: '/nl', label: '🇳🇱 Nederlands' },
        { code: 'pl', href: '/pl', label: '🇵🇱 Polski' }
    ];
    return [
        '            <!-- European & International Native Language Switcher -->',
        '            <nav class="eu-lang-bar" aria-label="European Language Editions">',
        ...items.map(i => `                <a href="${i.href}" class="eu-lang-pill${i.code === activeCode ? ' active' : ''}" hreflang="${i.code}">${i.label}</a>`),
        '            </nav>'
    ].join('\n');
}

async function generateEuHubs() {
    console.log('🇪🇺 Generating 6 Native-Language European Static Hubs (/de, /fr, /es, /it, /nl, /pl)...');
    fs.mkdirSync(EU_DIR, { recursive: true });
    const template = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

    for (const cfg of EU_HUB_CONFIGS) {
        const videos = await fetchHubVideos(cfg.queries, 24);
        if (videos.length < 12) {
            throw new Error(`EU hub /${cfg.code} returned only ${videos.length} clean videos`);
        }

        const pageUrl = `${BASE_URL}/${cfg.code}`;
        let html = template;

        // Native HTML lang & regional meta
        html = html.replace(/<html lang="[^"]*"/, `<html lang="${cfg.lang}"`);
        html = html.replace(/<title>.*?<\/title>/s, `<title>${cfg.title}</title>`);
        html = html.replace(/<meta name="description"[\s\S]*?>/s, `<meta name="description" content="${escapeHTML(cfg.desc)}">`);
        html = html.replace(/<meta name="language" content=".*?">/s, `<meta name="language" content="${cfg.languageName}">`);
        html = html.replace(
            /<meta name="geo\.region"[^>]*>\s*<meta name="geo\.placename"[^>]*>/,
            `<meta name="geo.region" content="${cfg.geoRegion}">\n    <meta name="geo.placename" content="${cfg.geoPlace}">`
        );

        // Open Graph & Twitter
        html = html.replace(/<meta property="og:locale:alternate"[^>]*>\s*/g, '');
        html = html.replace(
            /<meta property="og:locale" content="[^"]*">/,
            `<meta property="og:locale" content="${cfg.ogLocale}">\n${buildOgAlternateLocalesForHub(cfg.ogLocale)}`
        );
        html = html.replace(/<meta property="og:title" content=".*?">/s, `<meta property="og:title" content="${cfg.title}">`);
        html = html.replace(/<meta property="og:description"[\s\S]*?>/s, `<meta property="og:description" content="${escapeHTML(cfg.desc)}">`);
        html = html.replace(/<meta property="og:url" content=".*?">/s, `<meta property="og:url" content="${pageUrl}">`);
        html = html.replace(/<meta name="twitter:title" content=".*?">/s, `<meta name="twitter:title" content="${cfg.title}">`);
        html = html.replace(/<meta name="twitter:description"[\s\S]*?>/s, `<meta name="twitter:description" content="${escapeHTML(cfg.desc)}">`);
        html = html.replace(/<link rel="canonical"[^>]*href=".*?">/s, `<link rel="canonical" id="canonicalLink" href="${pageUrl}">`);

        // Strictly reciprocal Hreflang cluster matching homepage (/)
        html = html.replace(
            /[ \t]*<!-- Hreflang[\s\S]*?(?:<link rel="alternate"[^>]*>\s*)+/,
            `${buildHomeHreflangCluster()}\n${RSS_LINK_TAG}\n\n`
        );

        // LCP preload for #1 regional thumbnail
        const lcpThumb = videos[0]?.default_thumb?.src || '';
        html = html.replace(/[ \t]*<link rel="preload" as="image"[^>]*>\s*/g, '');
        if (lcpThumb) {
            html = html.replace(
                '<!-- Preload Critical Resources -->',
                `<!-- Preload Critical Resources -->\n    <link rel="preload" as="image" href="${escapeHTML(lcpThumb)}" fetchpriority="high">`
            );
        }

        // Replace schemas: CollectionPage + BreadcrumbList + ItemList + FAQPage (remove homepage WebSite/Org duplication)
        html = html.replace(/\s*<!-- JSON-LD Structured Data: WebSite \+ SearchAction -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
        html = html.replace(/\s*<!-- JSON-LD Structured Data: Organization -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
        html = html.replace(/\s*<!-- JSON-LD BreadcrumbList -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
        html = html.replace(/\s*<!-- JSON-LD ItemList -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');

        const collectionSchema = generateCollectionPageSchema(cfg.title.replace(/&amp;/g, '&'), cfg.desc, pageUrl, cfg.lang);
        const breadcrumbSchema = generateBreadcrumbSchema([
            { name: 'Home', url: `${BASE_URL}/` },
            { name: cfg.breadcrumbName, url: pageUrl }
        ]);
        const cardItems = videos.map(v => {
            const t = cleanVideoTitle(v.title || 'Untitled');
            const slug = slugify(t);
            return {
                title: t,
                url: `${BASE_URL}/v/${v.id}${slug ? '-' + slug : ''}`,
                image: (v.default_thumb && v.default_thumb.src) ? v.default_thumb.src : ''
            };
        });
        const itemListSchema = generateItemListSchema(cfg.h1.replace(/&amp;/g, '&'), cfg.desc, cardItems);
        const faqSchema = generateFaqSchema(cfg.faqs);

        const schemasHtml = [
            '\n    <!-- JSON-LD CollectionPage -->',
            `    <script type="application/ld+json">\n${JSON.stringify(collectionSchema, null, 2)}\n    </script>`,
            '\n    <!-- JSON-LD BreadcrumbList -->',
            `    <script type="application/ld+json">\n${JSON.stringify(breadcrumbSchema, null, 2)}\n    </script>`,
            '\n    <!-- JSON-LD ItemList -->',
            `    <script type="application/ld+json">\n${JSON.stringify(itemListSchema, null, 2)}\n    </script>`,
            '\n    <!-- JSON-LD FAQPage -->',
            `    <script type="application/ld+json">\n${JSON.stringify(faqSchema, null, 2)}\n    </script>`
        ].join('\n');

        html = html.replace('<!-- Gallery Styles -->', `${schemasHtml}\n\n    <!-- Gallery Styles -->`);
        html = html.replace('<body>', `<body data-static-category="${cfg.staticCat}">`);
        html = html.replace(/placeholder="Search 1080p HD videos\.\.\."/, `placeholder="${escapeHTML(cfg.searchPlaceholder)}"`);

        // Visual breadcrumb + localized H1 + Editorial + Active Language Switcher
        const visualBreadcrumb =
            '            <nav class="breadcrumb-nav" aria-label="Breadcrumb">\n' +
            '                <a href="/">Home</a>\n' +
            '                <span class="sep">›</span>\n' +
            `                <span class="current" aria-current="page">${escapeHTML(cfg.breadcrumbName)}</span>\n` +
            '            </nav>\n';

        html = html.replace(/<h1 class="main-seo-title">.*?<\/h1>/s, `${visualBreadcrumb}            <h1 class="main-seo-title">${cfg.h1}</h1>`);

        const featuredCatLinks = cfg.featuredCats
            .map(c => `<a href="/category/${c.slug}" class="video-tag">${escapeHTML(c.name)}</a>`)
            .join(' ');

        const editorialHtml = [
            '\n            <section class="category-editorial" aria-label="Editorial">',
            `                <h2>${cfg.editorialHeading}</h2>`,
            ...cfg.editorialParagraphs.map(p => `                <p>${escapeHTML(p)}</p>`),
            `                <div class="video-tags" style="margin-top: 12px;">${featuredCatLinks}</div>`,
            '            </section>'
        ].join('\n');

        html = html.replace(
            /<p class="main-seo-desc" id="mainSeoDesc">.*?<\/p>/s,
            `<p class="main-seo-desc" id="mainSeoDesc">${escapeHTML(cfg.desc)}</p>${editorialHtml}`
        );

        html = html.replace(
            /[ \t]*<!-- European & International Native Language Switcher -->\s*<nav class="eu-lang-bar"[\s\S]*?<\/nav>/,
            buildLangBarHtml(cfg.code)
        );

        html = html.replace(
            /<(?:div|h2) class="section-label" id="sectionLabel">.*?<\/(?:div|h2)>/s,
            `<h2 class="section-label" id="sectionLabel">${cfg.sectionLabel}</h2>`
        );

        const cardsHtml = videos.map((v, i) => generateCardHTML(v, i)).join('\n');
        html = html.replace(
            /<div class="card-grid" id="cardGrid">[\s\S]*?<\/div>\s*<!-- PAGINATION -->/s,
            `<div class="card-grid" id="cardGrid">\n${cardsHtml}\n            </div>\n\n            <!-- PAGINATION -->`
        );

        // Inject visible native-language FAQ section right before seo-crawl-hub (and before Adsterra Native Banner)
        const faqHtml = [
            '            <section class="category-faq" aria-label="FAQ">',
            `                <h2>${escapeHTML(cfg.faqHeading)}</h2>`,
            ...cfg.faqs.map(f => `                <div class="faq-item"><h3>${escapeHTML(f.question)}</h3><p>${escapeHTML(f.answer)}</p></div>`),
            '            </section>'
        ].join('\n');

        html = html.replace(
            '            <nav class="seo-crawl-hub"',
            `${faqHtml}\n\n            <nav class="seo-crawl-hub"`
        );

        const outPath = path.join(EU_DIR, `${cfg.code}.html`);
        fs.writeFileSync(outPath, html, 'utf8');
        console.log(`   ✅ Generated /${cfg.code} (${outPath}) with ${videos.length} regional HD videos & native ${cfg.languageName} SEO.`);
    }
}

if (require.main === module) {
    generateEuHubs().catch(err => {
        console.error('❌ Failed to generate EU hubs:', err);
        process.exit(1);
    });
}

module.exports = { generateEuHubs, EU_HUB_CONFIGS };
