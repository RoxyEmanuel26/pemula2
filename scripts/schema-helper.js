'use strict';

/**
 * ============================================================================
 * SCHEMA & INTERNATIONAL SEO HELPER
 * Reusable JSON-LD, Reciprocal Hreflang, and EU/US Geo Signals
 * ============================================================================
 */

const BASE_URL = 'https://www.kumpulenak.my.id';
const ASSET_VERSION = '5.5.2';

const EU_HUBS = [
    {
        code: 'de',
        path: '/de',
        file: 'de.html',
        ogLocale: 'de_DE',
        hreflangs: ['de', 'de-DE', 'de-AT', 'de-CH'],
        label: 'Deutsch',
        shortLabel: 'DE'
    },
    {
        code: 'fr',
        path: '/fr',
        file: 'fr.html',
        ogLocale: 'fr_FR',
        hreflangs: ['fr', 'fr-FR', 'fr-BE', 'fr-CH', 'fr-CA'],
        label: 'Français',
        shortLabel: 'FR'
    },
    {
        code: 'es',
        path: '/es',
        file: 'es.html',
        ogLocale: 'es_ES',
        hreflangs: ['es', 'es-ES', 'es-US'],
        label: 'Español',
        shortLabel: 'ES'
    },
    {
        code: 'it',
        path: '/it',
        file: 'it.html',
        ogLocale: 'it_IT',
        hreflangs: ['it', 'it-IT', 'it-CH'],
        label: 'Italiano',
        shortLabel: 'IT'
    },
    {
        code: 'nl',
        path: '/nl',
        file: 'nl.html',
        ogLocale: 'nl_NL',
        hreflangs: ['nl', 'nl-NL', 'nl-BE'],
        label: 'Nederlands',
        shortLabel: 'NL'
    },
    {
        code: 'pl',
        path: '/pl',
        file: 'pl.html',
        ogLocale: 'pl_PL',
        hreflangs: ['pl', 'pl-PL'],
        label: 'Polski',
        shortLabel: 'PL'
    }
];

const RSS_LINK_TAG = '    <link rel="alternate" type="application/rss+xml" title="kumpulenak US &amp; EU HD Video Feed" href="https://www.kumpulenak.my.id/rss.xml">';

function generateWebSiteSchema() {
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "kumpulenak",
        "alternateName": "kumpulenak US & European 1080p HD Video Hub",
        "url": BASE_URL,
        "description": "Free Full HD 1080p 60FPS Adult Video Streaming Directory for the United States, United Kingdom, and Europe across 95+ curated categories with zero registration.",
        "inLanguage": ["en", "en-US", "en-GB", "de", "fr", "es", "it", "nl", "pl"],
        "potentialAction": {
            "@type": "SearchAction",
            "target": {
                "@type": "EntryPoint",
                "urlTemplate": `${BASE_URL}/?q={search_term_string}`
            },
            "query-input": "required name=search_term_string"
        }
    };
}

function generateOrganizationSchema() {
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "kumpulenak",
        "url": BASE_URL,
        "logo": {
            "@type": "ImageObject",
            "url": `${BASE_URL}/assets/icons/android-chrome-512x512.png`,
            "width": 512,
            "height": 512
        },
        "description": "International 18+ Full HD video streaming directory serving viewers in the United States, United Kingdom, Canada, Australia, and across Europe.",
        "foundingDate": "2026",
        "areaServed": [
            "US", "GB", "CA", "AU", "IE", "NZ",
            "DE", "AT", "CH", "FR", "BE", "ES", "IT", "NL", "PL",
            "SE", "NO", "DK", "FI", "PT", "CZ", "LU", "GR"
        ],
        "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "customer service",
            "email": "admin@kumpulenak.my.id",
            "availableLanguage": ["English", "German", "French", "Spanish", "Italian", "Dutch", "Polish"]
        }
    };
}

function generateCollectionPageSchema(name, description, url, inLanguage = 'en') {
    return {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": String(name || 'HD Video Collection'),
        "description": String(description || ''),
        "url": String(url || BASE_URL),
        "inLanguage": inLanguage,
        "isPartOf": {
            "@type": "WebSite",
            "name": "kumpulenak",
            "url": BASE_URL
        }
    };
}

function generateFaqSchema(faqs) {
    if (!Array.isArray(faqs) || faqs.length === 0) return null;
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs.map(item => ({
            "@type": "Question",
            "name": String(item.question || ''),
            "acceptedAnswer": {
                "@type": "Answer",
                "text": String(item.answer || '')
            }
        }))
    };
}

function generateBreadcrumbSchema(items) {
    if (!Array.isArray(items) || items.length === 0) return null;
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": items.map((item, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "name": String(item.name || ''),
            "item": String(item.url || '')
        }))
    };
}

/**
 * Generate VideoObject Schema without restrictive regionsAllowed
 * (Allows indexing in US, UK, CA, AU, NZ and ALL 27+ EU/EEA countries incl. CH, NO, DK, AT, BE, SE, FI)
 */
function generateVideoSchema({
    id,
    title,
    description,
    thumbnailUrl,
    uploadDate,
    durationSec,
    embedUrl,
    views
}) {
    if (!title || !thumbnailUrl || !uploadDate) return null;

    let isoDate = uploadDate;
    if (isoDate && !isoDate.includes('T')) {
        isoDate = `${isoDate.slice(0, 10)}T00:00:00Z`;
    }

    const duration = Math.max(0, Math.floor(Number(durationSec) || 0));
    const viewsCount = Math.max(0, Math.floor(Number(views) || 0));

    const schema = {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        "name": String(title),
        "description": String(description || `Watch ${title} in 1080p full HD free on kumpulenak.`),
        "thumbnailUrl": Array.isArray(thumbnailUrl) ? thumbnailUrl : [String(thumbnailUrl)],
        "uploadDate": isoDate,
        "duration": `PT${duration}S`,
        "embedUrl": embedUrl || `https://www.eporner.com/embed/${id}/`,
        "contentRating": "18+",
        "isFamilyFriendly": false,
        "inLanguage": "en",
        "publisher": {
            "@type": "Organization",
            "name": "kumpulenak",
            "url": BASE_URL,
            "logo": {
                "@type": "ImageObject",
                "url": `${BASE_URL}/assets/icons/android-chrome-512x512.png`,
                "width": 512,
                "height": 512
            }
        }
    };

    if (viewsCount > 0) {
        schema.interactionStatistic = {
            "@type": "InteractionCounter",
            "interactionType": { "@type": "WatchAction" },
            "userInteractionCount": viewsCount
        };
    }

    return schema;
}

function generateItemListSchema(listName, listDesc, items) {
    if (!Array.isArray(items)) return null;
    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": String(listName || 'Video Collection'),
        "description": String(listDesc || ''),
        "numberOfItems": items.length,
        "itemListElement": items.map((item, index) => {
            const entry = {
                "@type": "ListItem",
                "position": index + 1,
                "name": String(item.title || item.name || ''),
                "url": String(item.url || '')
            };
            if (item.image) {
                entry.image = String(item.image);
            }
            return entry;
        })
    };
}

/**
 * Full Strictly Reciprocal Hreflang Cluster for Homepage (/) <-> 6 Native EU Language Hubs (/de, /fr, /es, /it, /nl, /pl)
 */
function buildHomeHreflangCluster() {
    const lines = [
        '    <!-- Hreflang — Full Bidirectional US, UK & European Native Language Cluster -->',
        `    <link rel="alternate" hreflang="en" href="${BASE_URL}/">`,
        `    <link rel="alternate" hreflang="en-US" href="${BASE_URL}/">`,
        `    <link rel="alternate" hreflang="en-GB" href="${BASE_URL}/">`,
        `    <link rel="alternate" hreflang="en-CA" href="${BASE_URL}/">`,
        `    <link rel="alternate" hreflang="en-AU" href="${BASE_URL}/">`,
        `    <link rel="alternate" hreflang="en-IE" href="${BASE_URL}/">`
    ];
    for (const hub of EU_HUBS) {
        const href = `${BASE_URL}${hub.path}`;
        for (const hl of hub.hreflangs) {
            lines.push(`    <link rel="alternate" hreflang="${hl}" href="${href}">`);
        }
    }
    lines.push(`    <link rel="alternate" hreflang="x-default" href="${BASE_URL}/">`);
    return lines.join('\n');
}

/**
 * Tier-1 English Hreflang Cluster for English-only inner pages (/category/*, /trending, /directory, trust pages)
 */
function buildHreflangBlock(canonicalUrl) {
    return [
        '    <!-- Hreflang — Tier-1 US, UK, CA, AU & IE English Cluster -->',
        `    <link rel="alternate" hreflang="en" href="${canonicalUrl}">`,
        `    <link rel="alternate" hreflang="en-US" href="${canonicalUrl}">`,
        `    <link rel="alternate" hreflang="en-GB" href="${canonicalUrl}">`,
        `    <link rel="alternate" hreflang="en-CA" href="${canonicalUrl}">`,
        `    <link rel="alternate" hreflang="en-AU" href="${canonicalUrl}">`,
        `    <link rel="alternate" hreflang="en-IE" href="${canonicalUrl}">`,
        `    <link rel="alternate" hreflang="x-default" href="${canonicalUrl}">`
    ].join('\n');
}

// Accurate og:locale:alternate for English-only inner pages (no phantom non-English declarations)
const OG_LOCALES_EN = [
    '    <meta property="og:locale:alternate" content="en_GB">',
    '    <meta property="og:locale:alternate" content="en_CA">',
    '    <meta property="og:locale:alternate" content="en_AU">',
    '    <meta property="og:locale:alternate" content="en_IE">'
].join('\n');

// Full og:locale:alternate for / and /de|/fr|/es|/it|/nl|/pl (backed by real translated pages!)
function buildOgAlternateLocalesForHub(primaryOgLocale = 'en_US') {
    const all = ['en_US', 'en_GB', 'en_CA', 'en_AU', 'de_DE', 'fr_FR', 'es_ES', 'it_IT', 'nl_NL', 'pl_PL'];
    return all
        .filter(loc => loc !== primaryOgLocale)
        .map(loc => `    <meta property="og:locale:alternate" content="${loc}">`)
        .join('\n');
}

const OG_ALTERNATE_LOCALES = OG_LOCALES_EN;

module.exports = {
    BASE_URL,
    ASSET_VERSION,
    EU_HUBS,
    RSS_LINK_TAG,
    OG_LOCALES_EN,
    OG_ALTERNATE_LOCALES,
    buildOgAlternateLocalesForHub,
    buildHomeHreflangCluster,
    buildHreflangBlock,
    generateWebSiteSchema,
    generateOrganizationSchema,
    generateCollectionPageSchema,
    generateFaqSchema,
    generateBreadcrumbSchema,
    generateVideoSchema,
    generateItemListSchema
};
