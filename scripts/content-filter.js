'use strict';

/**
 * Centralized Safety Filter, Title Cleaner & International Content Curator
 * Protects kumpulenak.my.id from Google SafeSearch / CSAM / Policy Demotion
 * and curates clean, high-CTR English/International titles.
 */

const HARMFUL_SUBSTRINGS = [
    'underage', 'preteen', 'jailbait', 'barely legal',
    'young girl', 'young boy', 'college girl', 'high school',
    'schoolgirl', 'school boy', 'school girl', 'child', 'minor',
    'teenager', 'loli', 'lolita', 'shota', 'pedophil',
    'esema', 'esemaa', 'bocil', 'pramuka', 'anak sd', 'anak smp', 'anak sma',
    'pelajar', 'siswi', 'perkosa', 'pemerkosaan', 'dipaksa', 'kesakitan',
    'menangis', 'nangis', 'sampe nangi', 'non-consensual', 'forced sex',
    'raped', 'raping', 'sedarah', 'bestiality', 'zoophilia', 'animal sex',
    'dead body', 'necro', 'snuff', 'torture', 'drugged', 'unconscious',
    'sleeping pill', 'mabuk berat', 'pingsan'
];

const HARMFUL_WORD_REGEX = /\b(teen|teens|kid|kids|school|student|students|abg|sma|smp|smk|bocah|adek|adik|paksa|rape|incest|loli|shota|minor|minors|underage|child|children|preteen)\b/i;

const LOCAL_NON_INTERNATIONAL_REGEX = /\b(bokep|ngewe|ngentot|memek|kontol|pepek|colmek|nyuci|piring|kesakitan|sampe|banget|nangi|nangis|cewek|cowok|selingkuh|kosan|kamar kos|indo viral)\b/i;

function decodeHtmlEntities(value) {
    return String(value || '')
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/&quot;/gi, '"')
        .replace(/&apos;|&#39;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&amp;/gi, '&');
}

function repairMojibake(value) {
    let text = String(value || '');
    const score = candidate => (candidate.match(/[\u00C2-\u00F4][\u0080-\u00BF]|\uFFFD/g) || []).length;
    for (let pass = 0; pass < 3; pass++) {
        if (score(text) === 0 || [...text].some(char => char.codePointAt(0) > 255)) break;
        const repaired = Buffer.from(text, 'latin1').toString('utf8');
        if (score(repaired) >= score(text)) break;
        text = repaired;
    }
    // Remove stray孤立 'Â' (\u00C2) left over from double-encoded NBSP
    return text.replace(/\u00C2+/g, ' ').replace(/\u00A0+/g, ' ');
}

/**
 * Cleans video titles while preserving valid Latin accents (e.g., Café, Grabación)
 * Removes Zalgo/combining spam, Mathematical Unicode fonts, scraped "1.8K11 Hours Ago" tails, and .mp4 suffixes.
 */
function cleanVideoTitle(rawTitle) {
    if (!rawTitle || typeof rawTitle !== 'string') return '';
    let text = repairMojibake(decodeHtmlEntities(rawTitle));

    // Remove control characters
    text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');

    // Remove Mathematical Alphanumeric Symbols (fancy Unicode fonts)
    text = text.replace(/[\uD835][\uDC00-\uDFFF]/g, ' ');

    // Remove Zalgo / overlay / underdot combining marks (U+0316 to U+036F, U+0483 to U+0489, etc.)
    // while keeping normal composed accents (NFC) intact
    text = text.normalize('NFC')
        .replace(/[\u0316-\u036F\u0483-\u0489\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]+/g, '')
        .replace(/[\u0300-\u0315]{2,}/g, '');

    // Strip scraped view count + relative time suffixes (e.g. "1.8K11 Hours Ago", "45K 2 Days Ago")
    text = text.replace(/\s*\d+(?:\.\d+)?[KMB]?\s*\d+\s*(?:sec(?:ond)?s?|min(?:ute)?s?|hours?|days?|weeks?|months?|years?)\s*ago\b.*$/i, '');

    // Strip raw file extensions at end of title (.mp4, .mkv, .avi, .mov, .wmv)
    text = text.replace(/\.(?:mp4|mkv|avi|mov|wmv|flv|webm)\b/gi, '');

    // Collapse whitespace
    text = text.replace(/\s+/g, ' ').trim();
    return text;
}

/**
 * Checks whether a video or title contains any harmful / policy-violating keywords
 */
function isHarmfulContent(titleOrVideo, extraKeywords = '') {
    let title = '';
    let kw = extraKeywords || '';
    if (titleOrVideo && typeof titleOrVideo === 'object') {
        title = String(titleOrVideo.title || titleOrVideo.name || '');
        kw = String(titleOrVideo.keywords || '') + ' ' + kw;
    } else {
        title = String(titleOrVideo || '');
    }
    const cleaned = cleanVideoTitle(title).toLowerCase();
    const rawLower = title.toLowerCase();
    const kwLower = kw.toLowerCase();
    const combined = `${cleaned} ${rawLower} ${kwLower}`;

    for (const sub of HARMFUL_SUBSTRINGS) {
        if (combined.includes(sub)) return true;
    }
    if (HARMFUL_WORD_REGEX.test(combined)) {
        return true;
    }
    return false;
}

/**
 * Checks whether a video is suitable for prominent International SEO placement
 * (Homepage & Category hubs: safe, clean Latin title, no local Indonesian slang)
 */
function isInternationalFriendly(video) {
    if (!video || isHarmfulContent(video)) return false;
    const cleaned = cleanVideoTitle(video.title || video.name || '');
    if (!cleaned || cleaned.length < 5) return false;
    if (LOCAL_NON_INTERNATIONAL_REGEX.test(cleaned)) return false;
    // Must contain at least 4 ASCII Latin letters
    const latinCount = (cleaned.match(/[A-Za-z]/g) || []).length;
    if (latinCount < 4) return false;
    return true;
}

module.exports = {
    HARMFUL_SUBSTRINGS,
    HARMFUL_WORD_REGEX,
    LOCAL_NON_INTERNATIONAL_REGEX,
    decodeHtmlEntities,
    repairMojibake,
    cleanVideoTitle,
    isHarmfulContent,
    isInternationalFriendly
};
