'use strict';

/**
 * Centralized Safety Filter, Title Cleaner & US/European Content Curator
 * Protects kumpulenak.my.id from Google SafeSearch / Policy Demotion
 * and ensures 100% authentic US & European Western-Latin curation on primary hubs.
 */

const HARMFUL_SUBSTRINGS = [
    'underage', 'preteen', 'jailbait', 'barely legal',
    'young girl', 'young boy', 'college girl', 'high school',
    'schoolgirl', 'school boy', 'school girl', 'child', 'minor',
    'teenager', 'loli', 'lolita', 'shota', 'pedophil',
    'esema', 'esemaa', 'bocil', 'pramuka', 'anak sd', 'anak smp', 'anak sma',
    'ibu ayah', 'orang tua', 'pelajar', 'siswi', 'perkosa', 'pemerkosaan',
    'dipaksa', 'kesakitan', 'menangis', 'nangis', 'sampe nangi',
    'non-consensual', 'forced sex', 'raped', 'raping', 'sedarah',
    'bestiality', 'zoophilia', 'animal sex', 'dead body', 'necro',
    'snuff', 'torture', 'drugged', 'unconscious', 'sleeping pill',
    'mabuk berat', 'pingsan', 'onlyfans leak', 'leaked tape'
];

const HARMFUL_WORD_REGEX = /\b(teen|teens|kid|kids|school|student|students|abg|sma|smp|smk|bocah|bocil|anak|anaknya|keponakan|kandung|adek|adik|paksa|rape|incest|loli|shota|minor|minors|underage|child|children|preteen|perkosa|sedarah)\b/i;

// Non-Latin scripts (CJK, Hangul, Cyrillic, Arabic, Devanagari, Thai, etc.)
const NON_LATIN_SCRIPT_REGEX = /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F]/;

// Southeast Asian & South Asian local terms that conflict with US/EU GEO targeting on a .my.id ccTLD
const LOCAL_NON_INTERNATIONAL_REGEX = /\b(bokep|ngewe|ngentot|dientot|entot|memek|kontol|pepek|colmek|nyuci|piring|kesakitan|sampe|banget|nangi|nangis|cewek|cowok|selingkuh|kosan|kamar|mandi|indo|indonesian|viral indo|yang|dengan|sama|dari|untuk|kerumah|mantan|mantannya|gadis|goyang|goyangan|bergoyang|nyanyi|sambil|petualangan|minta|jatah|mukanya|judes|bodynya|kenceng|cici|tetangga|hijab|jilbab|bini|suami|istri|janda|toge|tobrut|mbak|abang|di|dan|tapi|jadi|bisa|sudah|belum|lagi|ang|sa|ni|ng|habang|kinantot|kantot|puki|muntik|mahuli|napa|bigla|napalaban|agad|pinay|jakol|sarap|iyot|kantutan|libog|chupa|bhabhi|desi|randi|chudai|suhagrat|devar|aunty|nri|mms|chi und|jav)\b/i;

// Opaque code-only titles (e.g., "A384TID", "SSIS-402") with poor US/EU SERP CTR
const OPAQUE_CODE_ONLY_REGEX = /^[A-Z0-9_-]{3,14}$/i;

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
    return text.replace(/\u00C2+/g, ' ').replace(/\u00A0+/g, ' ');
}

/**
 * Cleans video titles while preserving valid European Latin accents (e.g., Café, Grabación, Mädchen, Français)
 */
function cleanVideoTitle(rawTitle) {
    if (!rawTitle || typeof rawTitle !== 'string') return '';
    let text = repairMojibake(decodeHtmlEntities(rawTitle));

    text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
    text = text.replace(/[\uD835][\uDC00-\uDFFF]/g, ' ');

    text = text.normalize('NFC')
        .replace(/[\u0316-\u036F\u0483-\u0489\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]+/g, '')
        .replace(/[\u0300-\u0315]{2,}/g, '');

    text = text.replace(/\s*\d+(?:\.\d+)?[KMB]?\s*\d+\s*(?:sec(?:ond)?s?|min(?:ute)?s?|hours?|days?|weeks?|months?|years?)\s*ago\b.*$/i, '');
    text = text.replace(/\.(?:mp4|mkv|avi|mov|wmv|flv|webm)\b/gi, '');

    return text.replace(/\s+/g, ' ').trim();
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
 * Strict US & European language/script curator for high-authority GEO US & EU surfaces
 * (Homepage, /trending, /directory, /eu/*, sitemap.xml, rss.xml, US/EU category hubs)
 */
function isUSEUFriendly(video) {
    if (!video || isHarmfulContent(video)) return false;
    const cleaned = cleanVideoTitle(video.title || video.name || '');
    if (!cleaned || cleaned.length < 10) return false;
    if (NON_LATIN_SCRIPT_REGEX.test(cleaned)) return false;
    if (LOCAL_NON_INTERNATIONAL_REGEX.test(cleaned)) return false;
    if (OPAQUE_CODE_ONLY_REGEX.test(cleaned)) return false;

    // Require at least 2 real words and predominantly Latin letters
    const words = cleaned.split(/\s+/).filter(w => /[A-Za-zÀ-ÖØ-öø-ÿ]{2,}/.test(w));
    if (words.length < 2) return false;

    const latinCount = (cleaned.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []).length;
    if (latinCount < 8) return false;

    return true;
}

/**
 * Backward-compatible alias used across generators
 */
function isInternationalFriendly(video) {
    return isUSEUFriendly(video);
}

module.exports = {
    HARMFUL_SUBSTRINGS,
    HARMFUL_WORD_REGEX,
    NON_LATIN_SCRIPT_REGEX,
    LOCAL_NON_INTERNATIONAL_REGEX,
    decodeHtmlEntities,
    repairMojibake,
    cleanVideoTitle,
    isHarmfulContent,
    isUSEUFriendly,
    isInternationalFriendly
};
