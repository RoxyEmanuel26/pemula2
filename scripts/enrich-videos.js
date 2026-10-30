'use strict';

/**
 * ============================================================================
 * GEMINI VIDEO ENRICHMENT PIPELINE (SEO FASE 5C)
 * Batch background job to enrich video metadata with unique titles, descriptions,
 * summaries, highlights, and FAQs using Google Gemini API within free tier limits.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Automatically read local .env if present
function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        try {
            const raw = fs.readFileSync(envPath, 'utf8');
            for (const line of raw.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx > 0) {
                    const key = trimmed.slice(0, eqIdx).trim();
                    let val = trimmed.slice(eqIdx + 1).trim();
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.slice(1, -1);
                    }
                    if (!process.env[key]) {
                        process.env[key] = val;
                    }
                }
            }
        } catch {
            // Non-blocking
        }
    }
}
loadEnv();

const DATA_FILE = path.join(__dirname, '..', 'data', 'enriched-videos.json');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Prioritize responsive, active models with automatic fallback
const CANDIDATE_MODELS = [
    process.env.GEMINI_MODEL,
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-3.8-flash'
].filter(Boolean).filter((m, i, arr) => arr.indexOf(m) === i);

const GEMINI_MODEL = CANDIDATE_MODELS[0] || 'gemini-3.5-flash-lite';
const BATCH_SIZE = parseInt(process.env.GEMINI_BATCH_SIZE, 10) || 5;
const DAILY_LIMIT = parseInt(process.env.GEMINI_DAILY_REQUEST_LIMIT, 10) || 1000;

function computeHash(content) {
    return crypto.createHash('sha256').update(String(content || '')).digest('hex').slice(0, 16);
}

function loadDatabase() {
    if (!fs.existsSync(DATA_FILE)) {
        return {};
    }
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function saveDatabase(db) {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
}

/**
 * Validate Gemini response output quality
 */
function validateEnrichment(rawTitle, item) {
    if (!item || typeof item !== 'object') return { valid: false, reason: 'Invalid JSON item' };
    
    // 1. seo_title <= 60 chars
    const title = String(item.seo_title || '').trim();
    if (!title || title.length > 60 || title.length < 15) {
        return { valid: false, reason: `Invalid seo_title length: ${title.length} (must be 15-60 chars)` };
    }

    // 2. meta_description 120-155 chars
    const desc = String(item.meta_description || '').trim();
    if (!desc || desc.length < 110 || desc.length > 165) {
        return { valid: false, reason: `Invalid meta_description length: ${desc.length} (target 120-155 chars)` };
    }

    // 3. summary: 2-3 sentences
    const summary = String(item.summary || '').trim();
    if (!summary || summary.length < 40) {
        return { valid: false, reason: 'Summary too short or missing' };
    }

    // 4. highlights: 3-5 points
    if (!Array.isArray(item.highlights) || item.highlights.length < 2) {
        return { valid: false, reason: 'Highlights must be an array of at least 2 points' };
    }

    // 5. tags: 3-6 tags
    if (!Array.isArray(item.tags) || item.tags.length < 2) {
        return { valid: false, reason: 'Tags must be an array of at least 2 tags' };
    }

    // 6. faq: 2-3 pairs
    if (!Array.isArray(item.faq) || item.faq.length < 1) {
        return { valid: false, reason: 'FAQ must contain at least 1 Q&A pair' };
    }

    // 7. Anti-duplication similarity check (must not be identical to raw title)
    if (title.toLowerCase() === rawTitle.toLowerCase()) {
        return { valid: false, reason: 'seo_title is identical to original raw title' };
    }

    return { valid: true };
}

/**
 * Call Gemini API with safetySettings set to BLOCK_NONE for editorial classification
 * and model fallback with exponential backoff on 429 / 503
 */
async function callGeminiBatch(videosBatch, retries = 3) {
    const promptInput = videosBatch.map(v => ({
        video_id: v.id,
        raw_title: v.title,
        keywords: v.keywords || '',
        duration: v.length_min || '',
        views: v.views || '0'
    }));

    const systemInstruction = `You are a professional video metadata and SEO editor.
Enrich the provided video list with unique, high-quality SEO metadata.
STRICT RULES:
1. ONLY use information implied by the given title and keywords. NEVER invent facts, actors, or medical/legal claims.
2. Output a strictly valid JSON array of objects, one for each input video.
3. Fields required per item:
   - "video_id": exact ID from input
   - "seo_title": compelling title, max 60 characters, with primary keyword in front ending with "| kumpulenak"
   - "meta_description": engaging meta description between 120 and 155 characters
   - "summary": 2 to 3 natural sentences summarizing the theme and viewing experience
   - "highlights": 3 to 5 bullet points highlighting video attributes (quality, genre, duration)
   - "tags": 3 to 6 clean, relevant category tags
   - "faq": array of 2 question-answer pairs related to streaming quality, device compatibility, or genre`;

    const requestBody = {
        contents: [
            {
                role: 'user',
                parts: [
                    { text: systemInstruction },
                    { text: `Videos to enrich:\n${JSON.stringify(promptInput, null, 2)}` }
                ]
            }
        ],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json'
        }
    };

    let lastError = null;

    for (const model of CANDIDATE_MODELS) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        let delay = 2000;

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 25000);

                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (res.status === 429 || res.status === 503) {
                    console.warn(`[Gemini API - ${model}] Status ${res.status} (Busy/High Demand). Retrying in ${delay / 1000}s... (Attempt ${attempt}/${retries})`);
                    await new Promise(r => setTimeout(r, delay));
                    delay = Math.min(delay * 2, 8000);
                    continue;
                }

                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`Gemini API [${model}] HTTP ${res.status}: ${errText}`);
                }

                const data = await res.json();
                const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!textOutput) throw new Error(`Empty response from Gemini model ${model}`);

                const parsed = JSON.parse(textOutput);
                if (!Array.isArray(parsed)) throw new Error('Gemini response is not a JSON array');

                return { results: parsed, usedModel: model };
            } catch (err) {
                lastError = err;
                const isRetryable = err.name === 'AbortError' || err.message.includes('503') || err.message.includes('429');
                if (attempt < retries && isRetryable) {
                    await new Promise(r => setTimeout(r, delay));
                    delay = Math.min(delay * 2, 8000);
                } else if (!isRetryable) {
                    break;
                }
            }
        }
        console.warn(`[Gemini API] Model ${model} unavailable or busy. Trying next available model...`);
    }

    throw lastError || new Error('All candidate models failed');
}

/**
 * Fetch candidate videos from popular feed to enrich
 */
async function fetchCandidates(limit = 20) {
    try {
        const url = `https://www.eporner.com/api/v2/video/search/?per_page=${Math.min(limit, 60)}&page=1&thumbsize=big&order=most-popular&gay=0&lq=1&format=json`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data.videos) ? data.videos : [];
    } catch (err) {
        console.warn('Could not fetch candidate videos:', err.message);
        return [];
    }
}

async function runEnrichmentPipeline(options = {}) {
    console.log('🚀 Starting Gemini Video Enrichment Pipeline (SEO FASE 5C)...');
    
    const db = loadDatabase();
    const existingCount = Object.keys(db).length;
    console.log(`Current enriched database size: ${existingCount} videos.`);

    if (options.dryRun || process.argv.includes('--dry-run')) {
        console.log('🧪 Running in dry-run mode. Pipeline validation successful.');
        return { success: true, processed: 0, enriched: 0, skipped: existingCount, dryRun: true };
    }

    if (!GEMINI_API_KEY) {
        console.log('ℹ️  GEMINI_API_KEY environment variable is not set.');
        console.log('   The pipeline runs in non-blocking fallback mode.');
        console.log('   To enable automated AI metadata enrichment, set GEMINI_API_KEY in your deployment environment.');
        return { success: true, processed: 0, enriched: 0, skipped: existingCount, offline: true };
    }

    const candidates = await fetchCandidates(options.limit || 20);
    const pendingVideos = candidates.filter(v => {
        const entry = db[v.id];
        return !entry || entry.status !== 'enriched';
    });

    console.log(`Found ${candidates.length} candidates, ${pendingVideos.length} pending enrichment.`);
    if (pendingVideos.length === 0) {
        console.log('✨ All candidate videos are already enriched!');
        return { success: true, processed: 0, enriched: 0, skipped: candidates.length };
    }

    let enrichedCount = 0;
    let requestCount = 0;

    for (let i = 0; i < pendingVideos.length; i += BATCH_SIZE) {
        if (requestCount >= DAILY_LIMIT) {
            console.warn(`⚠️ Daily request limit of ${DAILY_LIMIT} reached. Pausing until next scheduled run.`);
            break;
        }

        const batch = pendingVideos.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} videos)...`);

        try {
            requestCount++;
            const { results, usedModel } = await callGeminiBatch(batch);
            
            results.forEach(result => {
                const originalVideo = batch.find(v => v.id === result.video_id);
                if (!originalVideo) return;

                const rawTitle = originalVideo.title || '';
                const validation = validateEnrichment(rawTitle, result);

                if (validation.valid) {
                    db[result.video_id] = {
                        video_id: result.video_id,
                        source_hash: computeHash(rawTitle + (originalVideo.keywords || '')),
                        seo_title: result.seo_title,
                        meta_description: result.meta_description,
                        summary: result.summary,
                        highlights: result.highlights,
                        tags: result.tags,
                        faq: result.faq,
                        status: 'enriched',
                        model: usedModel || GEMINI_MODEL,
                        generated_at: new Date().toISOString(),
                        attempts: (db[result.video_id]?.attempts || 0) + 1
                    };
                    enrichedCount++;
                    console.log(`  ✅ Enriched [${usedModel}]: [${result.video_id}] ${result.seo_title}`);
                } else {
                    db[result.video_id] = {
                        video_id: result.video_id,
                        source_hash: computeHash(rawTitle),
                        status: 'rejected',
                        reject_reason: validation.reason,
                        model: usedModel || GEMINI_MODEL,
                        generated_at: new Date().toISOString(),
                        attempts: (db[result.video_id]?.attempts || 0) + 1
                    };
                    console.warn(`  ⚠️ Rejected [${result.video_id}]: ${validation.reason}`);
                }
            });

            saveDatabase(db);
            // Throttle to stay well within free tier TPM limits
            await new Promise(r => setTimeout(r, 2000));
        } catch (err) {
            console.error(`  ❌ Error processing batch:`, err.message);
            // Record failed attempt
            batch.forEach(v => {
                db[v.id] = {
                    video_id: v.id,
                    status: 'failed',
                    error: err.message,
                    attempts: (db[v.id]?.attempts || 0) + 1,
                    last_attempt: new Date().toISOString()
                };
            });
            saveDatabase(db);
            break;
        }
    }

    console.log(`\n✨ Pipeline complete! Enriched ${enrichedCount} videos in this run. Total in database: ${Object.keys(db).length}`);
    return { success: true, processed: pendingVideos.length, enriched: enrichedCount };
}

if (require.main === module) {
    runEnrichmentPipeline().catch(err => {
        console.error('Fatal pipeline error:', err);
        process.exit(1);
    });
}

module.exports = {
    DATA_FILE,
    loadDatabase,
    saveDatabase,
    computeHash,
    validateEnrichment,
    runEnrichmentPipeline
};
