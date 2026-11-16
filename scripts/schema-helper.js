'use strict';

/**
 * ============================================================================
 * SCHEMA HELPER (SEO FASE 3)
 * Reusable JSON-LD generator for Google Rich Results compliance
 * ============================================================================
 */

const BASE_URL = 'https://www.kumpulenak.my.id';

function generateWebSiteSchema() {
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "kumpulenak",
        "alternateName": "kumpulenak HD Adult Video Hub",
        "url": BASE_URL,
        "description": "Free Full HD 1080p Adult Video Hub for US & Europe — Watch trending viral clips across 95+ international categories with zero registration.",
        "inLanguage": ["en", "en-US", "en-GB", "de", "fr", "es", "it"],
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
        "logo": `${BASE_URL}/assets/icons/android-chrome-512x512.png`,
        "description": "International 18+ Full HD adult video streaming directory serving viewers in the United States, United Kingdom, and Europe.",
        "foundingDate": "2026",
        "areaServed": ["US", "GB", "CA", "AU", "DE", "FR", "ES", "IT", "NL", "SE", "PL", "EU"],
        "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "customer service",
            "email": "admin@kumpulenak.my.id",
            "availableLanguage": ["English", "German", "French", "Spanish", "Italian", "Dutch"]
        }
    };
}

/**
 * Generate BreadcrumbList Schema
 * @param {Array<{name: string, url: string}>} items 
 */
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
 * Generate VideoObject Schema
 * Only uses verified data from API without fabricating facts.
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
        "description": String(description || `Watch ${title} in full HD for free on kumpulenak.`),
        "thumbnailUrl": Array.isArray(thumbnailUrl) ? thumbnailUrl : [String(thumbnailUrl)],
        "uploadDate": isoDate,
        "duration": `PT${duration}S`,
        "embedUrl": embedUrl || `https://www.eporner.com/embed/${id}/`,
        "contentRating": "18+",
        "regionsAllowed": ["US", "GB", "CA", "AU", "IE", "DE", "FR", "ES", "IT", "NL", "SE", "PL", "EU"]
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

/**
 * Generate ItemList Schema for category or collection pages
 * @param {string} listName
 * @param {string} listDesc
 * @param {Array<{title: string, url: string, image?: string}>} items
 */
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

function buildHreflangBlock(canonicalUrl) {
    return [
        '    <!-- Hreflang — Tier-1 US, UK, CA, AU & EU Regional Targeting -->',
        `    <link rel="alternate" hreflang="en" href="${canonicalUrl}">`,
        `    <link rel="alternate" hreflang="en-US" href="${canonicalUrl}">`,
        `    <link rel="alternate" hreflang="en-GB" href="${canonicalUrl}">`,
        `    <link rel="alternate" hreflang="en-CA" href="${canonicalUrl}">`,
        `    <link rel="alternate" hreflang="en-AU" href="${canonicalUrl}">`,
        `    <link rel="alternate" hreflang="en-IE" href="${canonicalUrl}">`,
        `    <link rel="alternate" hreflang="x-default" href="${canonicalUrl}">`
    ].join('\n');
}

const OG_ALTERNATE_LOCALES = [
    '    <meta property="og:locale:alternate" content="en_GB">',
    '    <meta property="og:locale:alternate" content="en_CA">',
    '    <meta property="og:locale:alternate" content="de_DE">',
    '    <meta property="og:locale:alternate" content="fr_FR">',
    '    <meta property="og:locale:alternate" content="es_ES">',
    '    <meta property="og:locale:alternate" content="it_IT">',
    '    <meta property="og:locale:alternate" content="nl_NL">'
].join('\n');

module.exports = {
    BASE_URL,
    OG_ALTERNATE_LOCALES,
    buildHreflangBlock,
    generateWebSiteSchema,
    generateOrganizationSchema,
    generateBreadcrumbSchema,
    generateVideoSchema,
    generateItemListSchema
};
