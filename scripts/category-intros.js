'use strict';

/**
 * ============================================================================
 * CATEGORY EDITORIAL INTROS (SEO FASE 5A)
 * Unique, human-like editorial paragraphs (2-3 paragraphs) per category hub.
 * Prevents thin content penalties and builds topical authority.
 * ============================================================================
 */

const EDITORIAL_INTROS = {
    'amateur': {
        heading: 'Authentic Amateur & Homemade Adult Clips',
        paragraphs: [
            'Explore genuine, passionate moments with our curated selection of amateur and homemade adult videos. Unlike heavily scripted studio productions, this collection celebrates real-life intimacy, authentic connections, and spontaneous encounters captured by verified couples and creators worldwide.',
            'Each video in this section is hand-selected to ensure pristine audiovisual quality, featuring crisp full HD resolution, natural lighting, and unedited passion. Whether you are seeking cozy bedroom rendezvous or private home recordings, stream without interruptions on desktop, tablet, or smartphone.',
            'Our amateur catalog receives fresh uploads daily, prioritizing community-rated favorites and trending home clips. Enjoy fast, private playback with zero mandatory registration or subscription fees.'
        ]
    },
    'babe': {
        heading: 'Stunning Babes & Top Model Performances',
        paragraphs: [
            'Immerse yourself in top-tier glamour and sensual beauty with our premier collection of gorgeous babes and top-rated adult models. This gallery brings together captivating performances, striking aesthetics, and charismatic stars delivering unforgettable romantic and explicit scenes.',
            'Stream every video in vibrant high-definition resolution with optimized bitrates for instantaneous streaming on all modern mobile and desktop browsers. From sunlit solo photo-shoots turned intimate to high-energy studio productions, each title delivers exceptional visual fidelity.',
            'Updated around the clock, our babes section is thoroughly categorized to help you effortlessly navigate trending stars, popular releases, and top-rated clips from top international creators.'
        ]
    },
    'milf': {
        heading: 'Sophisticated MILF & Mature Women Streaming',
        paragraphs: [
            'Celebrate the confidence, elegance, and uninhibited passion of mature women with our exclusive MILF category. Featuring seasoned models and experienced performers, these videos highlight authentic desire, seductive storytelling, and refined sensuality.',
            'Every title in this collection is curated for discerning viewers who appreciate confident partners who know exactly what they want. Enjoy crystal-clear 1080p high definition, fluid playback speeds, and responsive controls whether watching on personal mobile devices or widescreen monitors.',
            'Discover daily trending releases, viewer-acclaimed favorites, and private encounters updated continuously without any required account creation or paywalls.'
        ]
    },
    'pov': {
        heading: 'First-Person Point-of-View (POV) Encounters',
        paragraphs: [
            'Step directly into the action with our immersive Point-of-View (POV) adult video hub. Filmed with wearable cameras and dynamic close-up angles, POV scenes place you directly in the driver\'s seat for an unparalleled sensation of personal presence and realism.',
            'Designed to deliver maximum immersion, our POV releases feature high-bitrate full HD and 60 FPS video streams that capture every subtle expression, glance, and touch with astonishing visual clarity and natural audio fidelity.',
            'Browse hundreds of top-rated first-person encounters, filter by favorite performer or scenario, and enjoy frictionless streaming with zero popups or forced registrations.'
        ]
    },
    'asian': {
        heading: 'Premier Asian Adult Videos & Exotic Stars',
        paragraphs: [
            'Discover an extensive anthology of top-quality Asian adult videos featuring beloved performers and emerging talent from across East and Southeast Asia. This gallery highlights diverse themes ranging from gentle romance to thrilling, energetic studio performances.',
            'All clips are formatted in high-resolution video streams, ensuring optimal color accuracy, fluid frame rates, and rapid loading times across mobile and desktop connections worldwide.',
            'With new releases indexed every single day, our Asian hub offers clean navigation, authentic ratings, and direct links to popular sub-genres without subscription requirements.'
        ]
    },
    'ebony': {
        heading: 'Gorgeous Ebony Stars & Sensual Performances',
        paragraphs: [
            'Experience the beauty, vibrancy, and undeniable magnetism of ebony performers in our dedicated video collection. From celebrated industry stars to rising amateur creators, this hub showcases passionate encounters and captivating visual productions.',
            'Optimized for fast, buffer-free playback, every title offers rich color definition and sharp high-definition visuals tailored for smartphones, tablets, and desktop computers alike.',
            'Explore top-rated ebony scenes, browse community reviews, and stream verified high-quality adult entertainment with complete anonymity and no hidden fees.'
        ]
    },
    'latina': {
        heading: 'Passionate Latina Babes & Fiery Encounters',
        paragraphs: [
            'Feel the heat with our hand-picked catalog of Latina adult videos, featuring fiery passion, irresistible curves, and charismatic performers from Latin America and beyond. This section celebrates uninhibited pleasure and dynamic chemistry.',
            'Stream seamlessly in full HD quality with crisp soundscapes, responsive scrub bars, and minimal initial loading latency. Whether you prefer romantic couple scenarios or intense solo spotlights, every clip is ready for immediate viewing.',
            'Updated daily with the most popular viral clips, our Latina hub provides secure, private browsing without requiring personal information or sign-ups.'
        ]
    },
    'blonde': {
        heading: 'Dazzling Blonde Beauties & Iconic Scenes',
        paragraphs: [
            'Indulge in a luminous showcase of radiant blonde stars and gorgeous models. Featuring classic romance, playful scenarios, and high-octane explicit scenes, this collection remains an enduring favorite among our global community.',
            'Every video stream is tuned for lightning-fast delivery and pristine 1080p picture quality, ensuring you never miss a moment of the action regardless of your screen size or network speed.',
            'Discover trending blonde releases, find beloved performers, and enjoy complete access to our adult library free of charge and with guaranteed privacy.'
        ]
    },
    'big-ass': {
        heading: 'Curvy Booties & Sensual Big-Ass Performances',
        paragraphs: [
            'For admirers of voluptuous curves and striking silhouettes, our big-ass video gallery delivers the ultimate compilation of eye-catching clips. From athletic dancers to naturally curvier creators, enjoy high-impact scenes with unmatched energy.',
            'Recorded in high-definition video with sharp contrast and fluid frame rates, each clip highlights every movement in breathtaking detail on mobile screens and wide displays.',
            'Browse the highest-rated booty clips on the web, updated daily with verified view counts, authentic ratings, and instant playback capabilities.'
        ]
    },
    'big-tits': {
        heading: 'Busty Beauties & Natural Big-Tits Clips',
        paragraphs: [
            'Immerse yourself in our premier destination for busty babes and big-tits performances. Featuring both all-natural models and glamorous performers, this category presents a diverse variety of passionate and artistic scenes.',
            'Delivered through optimized streaming servers, every title loads quickly in full HD resolution with clear audio and zero buffering delays.',
            'Find your favorite performers, explore related themes, and enjoy seamless streaming without account registration or recurring charges.'
        ]
    },
    'cosplay': {
        heading: 'Creative Cosplay & Fantasy Roleplay Scenes',
        paragraphs: [
            'Where imagination meets passion: our cosplay and roleplay category features imaginative costumes, fantasy themes, and creative scenarios inspired by anime, gaming, and pop culture icons.',
            'Enjoy vibrant, color-rich high-definition video playback that showcases detailed costumes, elaborate sets, and enthusiastic performances by top creators in the cosplay scene.',
            'Updated regularly with trending fan conventions and private studio creations, stream your favorite fantasy scenarios privately and securely on any device.'
        ]
    },
    'hd-porn-1080p': {
        heading: 'Ultra-Sharp 1080p High-Definition Video Gallery',
        paragraphs: [
            'Experience visual clarity at its finest with our dedicated 1080p Full HD adult gallery. Designed specifically for viewers who demand cinematic quality, rich textures, and true-to-life colors in their streaming experience.',
            'Powered by modern encoding standards, our HD player delivers instant video start times, minimal buffering, and responsive touch controls on both iOS and Android devices.',
            'Explore thousands of verified full HD scenes spanning all genres, organized cleanly by popularity, release date, and community ratings.'
        ]
    },
    'european': {
        heading: 'European HD Adult Videos & Continental Performers',
        paragraphs: [
            'Discover Europe\'s finest adult entertainment in our dedicated European HD category. Featuring acclaimed models and authentic amateur couples from Germany, France, Italy, Spain, the Czech Republic, Scandinavia, and across the EU, this hub delivers passionate, uninhibited performances.',
            'Every European clip streams in full 1080p HD via fast European and US edge CDN nodes, ensuring instant buffering and sharp visuals on mobile phones, tablets, and desktop screens.',
            'Updated daily with trending Euro productions, public adventures, and intimate private recordings — stream completely free with zero mandatory sign-ups.'
        ]
    },
    'british': {
        heading: 'British & UK Pornstars, Amateurs & HD Scenes',
        paragraphs: [
            'Enjoy an authentic taste of the UK with our curated British adult video collection. Showcasing glamorous English models, Scottish and Irish creators, and candid amateur UK couples filmed in London, Manchester, and beyond.',
            'All British scenes are delivered in adaptive high definition with crystal-clear audio and fast UK/EU edge streaming performance across iOS, Android, and desktop browsers.',
            'Browse top-rated UK homemade releases and iconic British studio features updated daily at no cost.'
        ]
    },
    'german': {
        heading: 'German / Deutsch HD Adult Videos & Amateur Scenes',
        paragraphs: [
            'Welcome to our German (Deutsch) HD adult hub featuring popular performers, authentic German amateur couples (Deutsche Pornos & Amateure), and renowned European studio productions filmed in Berlin, Munich, and Hamburg.',
            'Each German-language and continental scene is encoded for ultra-fast European streaming up to 1080p Full HD with responsive playback controls and zero registration barriers.',
            'From spontaneous reality encounters to high-energy group productions, explore the most-watched Deutsche HD clips updated daily.'
        ]
    },
    'french': {
        heading: 'French / Français Chic Adult Cinema & Amateur Clips',
        paragraphs: [
            'Experience sensual Parisian passion and bold French adult cinema (Vidéos X Françaises) in our dedicated French category. Featuring celebrated French performers and passionate amateur lovers, these clips blend elegance, chemistry, and unrestrained desire.',
            'Stream every French production in full high definition with rapid EU edge delivery, smooth scrubbing, and seamless compatibility across all modern smartphones and computers.',
            'Refreshed daily with trending French releases, romantic encounters, and intimate homemade clips free of charge.'
        ]
    },
    'spanish': {
        heading: 'Spanish / Español Fiery HD Adult Videos',
        paragraphs: [
            'Dive into the intensity of our Spanish (Vídeos Porno en Español) collection, spotlighting passionate performers from Spain and international Hispanic creators. Expect uninhibited chemistry, sun-drenched settings, and authentic pleasure.',
            'Every Spanish HD clip is optimized for fast streaming across Europe, the United States, and Latin America with zero buffering delays and crystal-clear 1080p playback.',
            'Browse top-rated Spanish scenes and fresh daily uploads privately and completely free.'
        ]
    },
    'italian': {
        heading: 'Italian / Italiano Sensual HD Videos & Classic Gems',
        paragraphs: [
            'Explore timeless Mediterranean allure in our Italian (Video Porno Italiani) hub. Showcasing charismatic Italian models, real couples, and iconic European productions, this collection celebrates romantic intensity and unbridled passion.',
            'Delivered in high-bitrate HTML5 video up to 1080p HD, every Italian release plays instantaneously on both mobile and widescreen displays across Europe and North America.',
            'Discover trending Italian favorites and curated full-length scenes updated every day with zero sign-up required.'
        ]
    },
    'czech': {
        heading: 'Czech HD Productions, Street Castings & Amateur Gems',
        paragraphs: [
            'Renowned across Europe and the United States for raw authenticity and stunning models, our Czech HD category brings together popular Prague castings, reality scenarios, and charismatic Central European performers.',
            'Stream crystal-clear full HD scenes with rapid loading times and smooth adaptive quality across smartphones, tablets, and desktops.',
            'Daily curated updates highlight the highest-rated Czech releases, all accessible freely and anonymously.'
        ]
    },
    'russian': {
        heading: 'Russian Models, Eastern European Beauties & HD Clips',
        paragraphs: [
            'Browse stunning Eastern European talent in our Russian HD adult video hub. Featuring captivating Russian models, glamorous solo showcases, and passionate couple performances, this category ranks among our most popular global collections.',
            'Optimized for rapid 1080p streaming across EU and US servers, every video delivers vivid detail, reliable playback, and mobile-first responsiveness.',
            'Explore thousands of high-rated clips updated around the clock with no registration fees.'
        ]
    },
    'american': {
        heading: 'American / USA Stars, Viral Studios & 1080p HD Clips',
        paragraphs: [
            'Stream top-tier US adult entertainment in our American HD hub, uniting Hollywood-grade studios, famous US pornstars, and authentic American amateur creators from Los Angeles, Miami, Las Vegas, and New York.',
            'Every American video supports instant HTML5 playback up to 1080p Full HD and 60 FPS, served via low-latency North American and European edge networks.',
            'Stay up to date with daily viral US releases, trending scenes, and viewer favorites with 100% free access.'
        ]
    },
    'romantic': {
        heading: 'Romantic, Sensual & Female-Friendly Full HD Scenes',
        paragraphs: [
            'Tailored for viewers seeking genuine chemistry, tender foreplay, and passionate intimacy, our Romantic & Female-Friendly category features artistic lighting, real-couple closeness, and story-driven scenes.',
            'Stream soothing, cinematic 1080p HD encounters with crystal-clear audio and uninterrupted playback on any device.',
            'Hand-curated daily to highlight emotional connection alongside full-resolution adult cinematography with zero sign-up hurdles.'
        ]
    },
    'dance': {
        heading: 'Sensual Dance, Striptease & Twerk HD Videos',
        paragraphs: [
            'Watch mesmerizing strip dances, erotic choreography, and rhythmic twerk performances in crystal-clear high definition. Featuring charismatic solo performers and playful party clips from around the world.',
            'Optimized for smooth high-frame-rate playback up to 60 FPS on iOS, Android, and desktop screens.',
            'Updated daily with trending dance and striptease highlights free to stream anytime.'
        ]
    },
    'live-cam': {
        heading: 'Recorded Live Webcam Shows & Interactive Cam Clips',
        paragraphs: [
            'Enjoy unscripted excitement in our Live Cam archive, showcasing recorded interactive webcam shows, solo cam models, and spontaneous live-stream highlights from performers in the US and Europe.',
            'Every cam recording plays immediately in HD HTML5 format without pop-up registration forms or token paywalls.',
            'Check back daily for fresh cam highlights and top-rated interactive performances.'
        ]
    }
};

/**
 * Generate contextual editorial paragraphs for any category
 * @param {string} slug
 * @param {string} title
 */
function getCategoryEditorial(slug, title) {
    if (EDITORIAL_INTROS[slug]) {
        return EDITORIAL_INTROS[slug];
    }

    const cleanTitle = title || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    return {
        heading: `Explore Top ${cleanTitle} Adult Videos`,
        paragraphs: [
            `Welcome to the dedicated ${cleanTitle} collection on kumpulenak. Here you will find an extensive, carefully organized anthology of high-performing adult clips spotlighting the best talent, viral releases, and community favorites in this genre.`,
            `All videos in our ${cleanTitle} hub are streamed in crisp high-definition video with fast CDN delivery, smooth playback across smartphones and laptops, and zero intrusive registration hurdles. Each scene is indexed with authentic duration and community feedback to help you find top-tier entertainment effortlessly.`,
            `Our catalog is refreshed daily with new titles and trending uploads. Browse through the collection below, explore related tags, and enjoy a premium, private adult viewing experience whenever you visit.`
        ]
    };
}

/**
 * Generate contextual FAQ items for Category Hub Rich Results & Long-Tail US/EU Queries
 * @param {string} slug
 * @param {string} title
 */
function getCategoryFaq(slug, title) {
    const cleanTitle = title || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return [
        {
            question: `Are ${cleanTitle} free to stream in 1080p Full HD in the USA and Europe?`,
            answer: `Yes. Every release in our ${cleanTitle} hub streams 100% free in adaptive Full HD (up to 1080p 60FPS) across the United States, United Kingdom, Germany, France, Spain, Italy, and worldwide with zero registration.`
        },
        {
            question: `How often is the ${cleanTitle} collection updated?`,
            answer: `Our ${cleanTitle} hub is refreshed automatically every day with trending international releases, viewer-rated favorites, and verified high-definition uploads.`
        },
        {
            question: `Can I watch ${cleanTitle} on iPhone, Android, or Smart TV without an app?`,
            answer: `Yes. All streams use native HTML5 video playback optimized for Safari on iOS, Chrome on Android, desktop browsers, and tablets with low-latency US and European CDN delivery.`
        }
    ];
}

const RELATED_CATEGORY_CLUSTERS = {
    'american': ['european', 'british', 'amateur', 'milf', 'blonde', 'pov', 'hd-porn-1080p'],
    'european': ['british', 'german', 'french', 'spanish', 'italian', 'czech', 'american'],
    'british': ['european', 'american', 'amateur', 'milf', 'blonde', 'redhead', 'pov'],
    'german': ['european', 'czech', 'french', 'italian', 'amateur', 'milf', 'hd-porn-1080p'],
    'french': ['european', 'italian', 'spanish', 'romantic', 'amateur', 'lingerie', 'hd-porn-1080p'],
    'spanish': ['european', 'latina', 'italian', 'french', 'amateur', 'couple', 'hd-porn-1080p'],
    'italian': ['european', 'french', 'spanish', 'romantic', 'milf', 'brunette', 'hd-porn-1080p'],
    'czech': ['european', 'german', 'russian', 'casting', 'amateur', 'public', 'hd-porn-1080p'],
    'amateur': ['homemade', 'couple', 'american', 'european', 'pov', 'milf', 'hd-porn-1080p'],
    'milf': ['mature', 'hotwife', 'housewives', 'american', 'european', 'blonde', 'big-tits'],
    'pov': ['amateur', 'american', 'european', 'babe', 'blonde', 'latina', '60-fps'],
    'hd-porn-1080p': ['60-fps', 'hq-porn', 'american', 'european', 'amateur', 'milf', 'pov'],
    '60-fps': ['hd-porn-1080p', 'hq-porn', 'american', 'european', 'pov', 'babe', 'vr-porn']
};

function getRelatedCategories(slug) {
    return RELATED_CATEGORY_CLUSTERS[slug] || ['american', 'european', 'british', 'german', 'french', 'amateur', 'milf', 'pov', 'hd-porn-1080p'];
}

module.exports = {
    EDITORIAL_INTROS,
    getCategoryEditorial,
    getCategoryFaq,
    getRelatedCategories
};
