const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const OUTPUT_DIR = path.join(__dirname, '..', 'app-store-assets');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Read icon as base64
const iconPath = path.join(ASSETS_DIR, 'icon.png');
const iconBase64 = fs.readFileSync(iconPath).toString('base64');

console.log('Icon loaded, length:', iconBase64.length);

// ─────────────────────────────────────────────────────────────────────────────
// 1. GENERATE 5244 x 2950 px SVG (Featuring / Promotional Graphic)
// ─────────────────────────────────────────────────────────────────────────────
function generateHeroSvg() {
  const width = 5244;
  const height = 2950;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050811" />
      <stop offset="35%" stop-color="#070b14" />
      <stop offset="70%" stop-color="#0a1224" />
      <stop offset="100%" stop-color="#050811" />
    </linearGradient>

    <!-- Pantro Signature Blue Gradient -->
    <linearGradient id="pantroBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#204ca1" />
      <stop offset="50%" stop-color="#316ec7" />
      <stop offset="100%" stop-color="#4289c9" />
    </linearGradient>

    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d172e" stop-opacity="0.85" />
      <stop offset="100%" stop-color="#09101f" stop-opacity="0.95" />
    </linearGradient>

    <linearGradient id="cardGradHover" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#142347" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#0e182f" stop-opacity="0.95" />
    </linearGradient>

    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>

    <linearGradient id="phoneBorder" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#4289c9" stop-opacity="0.8" />
      <stop offset="50%" stop-color="#204ca1" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#4289c9" stop-opacity="0.6" />
    </linearGradient>

    <!-- Glowing filters -->
    <filter id="glowHuge" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="140" result="blur" />
    </filter>
    <filter id="glowMedium" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="40" result="blur" />
    </filter>
    <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="25" stdDeviation="35" flood-color="#000000" flood-opacity="0.6" />
    </filter>
  </defs>

  <!-- Deep Background -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

  <!-- Ambient Light Orbs matching Pantro Blue (#204ca1 & #4289c9) -->
  <circle cx="2622" cy="700" r="900" fill="#204ca1" opacity="0.45" filter="url(#glowHuge)" />
  <circle cx="1000" cy="1800" r="800" fill="#204ca1" opacity="0.3" filter="url(#glowHuge)" />
  <circle cx="4200" cy="1800" r="800" fill="#4289c9" opacity="0.25" filter="url(#glowHuge)" />
  <circle cx="2622" cy="2400" r="1000" fill="#0c1d42" opacity="0.4" filter="url(#glowHuge)" />

  <!-- Tech Grid Background Pattern -->
  <g opacity="0.04" stroke="#ffffff" stroke-width="1.5">
    ${Array.from({ length: 27 }, (_, i) => `<line x1="0" y1="${i * 110}" x2="${width}" y2="${i * 110}" />`).join('\n    ')}
    ${Array.from({ length: 48 }, (_, i) => `<line x1="${i * 110}" y1="0" x2="${i * 110}" y2="${height}" />`).join('\n    ')}
  </g>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!-- TOP HEADER / BRAND IDENTITY                                           -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <g transform="translate(2622, 180)" text-anchor="middle">
    <!-- Category Pill Badge -->
    <rect x="-350" y="0" width="700" height="76" rx="38" fill="rgba(32, 76, 161, 0.25)" stroke="#316ec7" stroke-width="2.5" />
    <circle cx="-290" cy="38" r="12" fill="#2dd4bf" />
    <text x="20" y="49" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif" font-size="32" font-weight="700" fill="#38bdf8" letter-spacing="4">ALL-IN-ONE SMART TENANT PORTAL</text>

    <!-- Logo Squircle (Crisp white tile with Pantro Logo inside) -->
    <g transform="translate(-140, 110)">
      <rect x="0" y="0" width="280" height="280" rx="64" fill="#ffffff" stroke="rgba(255,255,255,0.4)" stroke-width="4" filter="url(#cardShadow)" />
      <image href="data:image/png;base64,${iconBase64}" x="25" y="25" width="230" height="230" preserveAspectRatio="xMidYMid meet" />
    </g>

    <!-- Main Title -->
    <text x="0" y="475" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif" font-size="124" font-weight="800" fill="#ffffff" letter-spacing="-1">PANTRO TENANT</text>
    <text x="0" y="545" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif" font-size="46" font-weight="500" fill="#94a3b8" letter-spacing="0.5">Effortless Rent Payments • Seamless Stay Management • Instant Digital Support</text>
  </g>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!-- LEFT COLUMN: 2 INFORMATIVE FEATURE CARDS                               -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <g transform="translate(360, 880)">
    <!-- Card 1: Rent & Dues Payment -->
    <g filter="url(#cardShadow)">
      <rect width="1380" height="820" rx="44" fill="url(#cardGrad)" stroke="#2b5ba8" stroke-width="3" />
      <!-- Top Accent Line -->
      <rect x="60" y="0" width="280" height="6" rx="3" fill="url(#pantroBlue)" />

      <!-- Icon Orb -->
      <rect x="60" y="70" width="130" height="130" rx="36" fill="url(#pantroBlue)" />
      <text x="125" y="152" font-size="64" text-anchor="middle" fill="#ffffff">💳</text>

      <text x="220" y="130" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" font-size="56" font-weight="700" fill="#ffffff">Instant Rent &amp; Dues via UPI</text>
      <text x="220" y="180" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" font-size="34" font-weight="500" fill="#38bdf8">1-Click Fast Settlement • Automated Receipts</text>

      <!-- Bullet points -->
      <g transform="translate(60, 260)">
        <!-- Bullet 1 -->
        <circle cx="20" cy="25" r="12" fill="#10b981" />
        <text x="55" y="34" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" font-size="34" font-weight="600" fill="#f1f5f9">Pay rent, electricity, maintenance with zero convenience hassle</text>

        <!-- Bullet 2 -->
        <circle cx="20" cy="95" r="12" fill="#10b981" />
        <text x="55" y="104" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" font-size="34" font-weight="600" fill="#f1f5f9">Auto-generated tax compliant PDF rent receipts downloaded instantly</text>

        <!-- Bullet 3 -->
        <circle cx="20" cy="165" r="12" fill="#10b981" />
        <text x="55" y="174" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" font-size="34" font-weight="600" fill="#f1f5f9">Timely smart reminders before due date to avoid late fees</text>
      </g>

      <!-- Mock Payment Status Banner Inside Card -->
      <g transform="translate(60, 500)">
        <rect width="1260" height="240" rx="28" fill="#070d1a" stroke="rgba(66, 137, 201, 0.4)" stroke-width="2" />
        <text x="50" y="80" font-family="-apple-system, sans-serif" font-size="28" font-weight="700" fill="#94a3b8" letter-spacing="2">NOVEMBER RENT STATUS</text>
        <text x="50" y="165" font-family="-apple-system, sans-serif" font-size="64" font-weight="800" fill="#ffffff">₹ 22,000</text>
        
        <rect x="960" y="65" width="250" height="90" rx="20" fill="url(#emeraldGrad)" />
        <text x="1085" y="125" font-family="-apple-system, sans-serif" font-size="34" font-weight="800" fill="#ffffff" text-anchor="middle">PAID ✓</text>
        <text x="50" y="210" font-family="-apple-system, sans-serif" font-size="26" font-weight="500" fill="#10b981">● Transaction Ref: UPI/20261104/PANTRO • Verified</text>
      </g>
    </g>

    <!-- Card 2: Room & Stay Management -->
    <g transform="translate(0, 890)" filter="url(#cardShadow)">
      <rect width="1380" height="820" rx="44" fill="url(#cardGrad)" stroke="#2b5ba8" stroke-width="3" />
      <rect x="60" y="0" width="280" height="6" rx="3" fill="url(#pantroBlue)" />

      <rect x="60" y="70" width="130" height="130" rx="36" fill="url(#pantroBlue)" />
      <text x="125" y="152" font-size="64" text-anchor="middle" fill="#ffffff">🏠</text>

      <text x="220" y="130" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" font-size="56" font-weight="700" fill="#ffffff">Stay &amp; Room Directory</text>
      <text x="220" y="180" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" font-size="34" font-weight="500" fill="#38bdf8">Property Amenities • Roommate Profiles • Move-in Pass</text>

      <g transform="translate(60, 260)">
        <circle cx="20" cy="25" r="12" fill="#10b981" />
        <text x="55" y="34" font-family="-apple-system, sans-serif" font-size="34" font-weight="600" fill="#f1f5f9">View allocated room, bed number, sharing type &amp; facilities</text>
        <circle cx="20" cy="95" r="12" fill="#10b981" />
        <text x="55" y="104" font-family="-apple-system, sans-serif" font-size="34" font-weight="600" fill="#f1f5f9">Direct connection with verified roommates and emergency contacts</text>
        <circle cx="20" cy="165" r="12" fill="#10b981" />
        <text x="55" y="174" font-family="-apple-system, sans-serif" font-size="34" font-weight="600" fill="#f1f5f9">Instant property guidelines, gate curfew &amp; visitor rules</text>
      </g>

      <!-- Stay Info Pill Tiles -->
      <g transform="translate(60, 500)">
        <rect x="0" y="0" width="390" height="230" rx="24" fill="#070d1a" stroke="rgba(255,255,255,0.1)" stroke-width="2" />
        <text x="35" y="65" font-family="-apple-system, sans-serif" font-size="26" font-weight="600" fill="#94a3b8">ALLOCATED ROOM</text>
        <text x="35" y="135" font-family="-apple-system, sans-serif" font-size="52" font-weight="800" fill="#ffffff">Room 304</text>
        <text x="35" y="185" font-family="-apple-system, sans-serif" font-size="28" font-weight="600" fill="#38bdf8">2-Sharing Deluxe</text>

        <rect x="430" y="0" width="390" height="230" rx="24" fill="#070d1a" stroke="rgba(255,255,255,0.1)" stroke-width="2" />
        <text x="465" y="65" font-family="-apple-system, sans-serif" font-size="26" font-weight="600" fill="#94a3b8">ACTIVE STAY</text>
        <text x="465" y="135" font-family="-apple-system, sans-serif" font-size="52" font-weight="800" fill="#ffffff">11 Months</text>
        <text x="465" y="185" font-family="-apple-system, sans-serif" font-size="28" font-weight="600" fill="#10b981">Valid Lease</text>

        <rect x="860" y="0" width="400" height="230" rx="24" fill="#070d1a" stroke="rgba(255,255,255,0.1)" stroke-width="2" />
        <text x="895" y="65" font-family="-apple-system, sans-serif" font-size="26" font-weight="600" fill="#94a3b8">KYC STATUS</text>
        <text x="895" y="135" font-family="-apple-system, sans-serif" font-size="52" font-weight="800" fill="#10b981">Verified ✓</text>
        <text x="895" y="185" font-family="-apple-system, sans-serif" font-size="28" font-weight="600" fill="#94a3b8">Police Verification OK</text>
      </g>
    </g>
  </g>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!-- CENTER COLUMN: SLEEK FLOATING SMARTPHONE MOCKUP                       -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <g transform="translate(2172, 840)" filter="url(#cardShadow)">
    <!-- Device Outer Chassis (iPhone 16 Pro Max styling) -->
    <rect width="900" height="1820" rx="90" fill="#070c17" stroke="url(#phoneBorder)" stroke-width="12" />
    <rect x="18" y="18" width="864" height="1784" rx="76" fill="#0a101f" />

    <!-- Dynamic Island / Speaker Notch -->
    <rect x="330" y="38" width="240" height="60" rx="30" fill="#000000" />
    <circle cx="530" cy="68" r="14" fill="#111827" />

    <!-- Screen Status Bar -->
    <text x="75" y="78" font-family="-apple-system, sans-serif" font-size="30" font-weight="700" fill="#ffffff">9:41</text>
    <text x="795" y="78" font-family="-apple-system, sans-serif" font-size="28" font-weight="600" fill="#ffffff" text-anchor="end">5G  100%</text>

    <!-- App Screen Header Inside Phone -->
    <g transform="translate(50, 150)">
      <!-- Mini Brand Logo -->
      <rect x="0" y="0" width="80" height="80" rx="20" fill="#ffffff" />
      <image href="data:image/png;base64,${iconBase64}" x="8" y="8" width="64" height="64" />

      <text x="105" y="40" font-family="-apple-system, sans-serif" font-size="34" font-weight="800" fill="#ffffff">Pantro Tenant</text>
      <text x="105" y="72" font-family="-apple-system, sans-serif" font-size="24" font-weight="500" fill="#94a3b8">Welcome back, Sahil</text>
      
      <circle cx="760" cy="40" r="32" fill="#1e293b" />
      <text x="760" y="50" font-size="28" text-anchor="middle" fill="#ffffff">🔔</text>
    </g>

    <!-- Screen: Primary Rent Status Card -->
    <g transform="translate(50, 280)">
      <rect width="764" height="420" rx="36" fill="url(#pantroBlue)" />
      <!-- Subtle internal pattern -->
      <circle cx="680" cy="80" r="160" fill="#ffffff" opacity="0.08" />

      <text x="45" y="65" font-family="-apple-system, sans-serif" font-size="24" font-weight="700" fill="rgba(255,255,255,0.8)" letter-spacing="2">UPCOMING MONTHLY RENT</text>
      <text x="45" y="150" font-family="-apple-system, sans-serif" font-size="76" font-weight="800" fill="#ffffff">₹ 18,500</text>
      <text x="45" y="200" font-family="-apple-system, sans-serif" font-size="26" font-weight="500" fill="rgba(255,255,255,0.9)">Due Date: 5th November 2026</text>

      <!-- Pay Button Inside App -->
      <rect x="45" y="270" width="674" height="100" rx="24" fill="#ffffff" />
      <text x="382" y="334" font-family="-apple-system, sans-serif" font-size="36" font-weight="800" fill="#204ca1" text-anchor="middle">PAY NOW WITH UPI ⚡</text>
    </g>

    <!-- Quick Navigation Tiles in Screen -->
    <g transform="translate(50, 750)">
      <text x="10" y="25" font-family="-apple-system, sans-serif" font-size="26" font-weight="700" fill="#94a3b8" letter-spacing="1">QUICK ACTIONS</text>
      
      <!-- Action 1 -->
      <rect x="0" y="55" width="235" height="190" rx="24" fill="#131d36" stroke="rgba(255,255,255,0.08)" stroke-width="2" />
      <text x="117" y="125" font-size="44" text-anchor="middle">🛠️</text>
      <text x="117" y="175" font-family="-apple-system, sans-serif" font-size="24" font-weight="700" fill="#ffffff" text-anchor="middle">Complaints</text>
      <text x="117" y="205" font-family="-apple-system, sans-serif" font-size="18" fill="#10b981" text-anchor="middle">0 Pending</text>

      <!-- Action 2 -->
      <rect x="264" y="55" width="235" height="190" rx="24" fill="#131d36" stroke="rgba(255,255,255,0.08)" stroke-width="2" />
      <text x="381" y="125" font-size="44" text-anchor="middle">📄</text>
      <text x="381" y="175" font-family="-apple-system, sans-serif" font-size="24" font-weight="700" fill="#ffffff" text-anchor="middle">Agreement</text>
      <text x="381" y="205" font-family="-apple-system, sans-serif" font-size="18" fill="#38bdf8" text-anchor="middle">Verified ✓</text>

      <!-- Action 3 -->
      <rect x="528" y="55" width="235" height="190" rx="24" fill="#131d36" stroke="rgba(255,255,255,0.08)" stroke-width="2" />
      <text x="645" y="125" font-size="44" text-anchor="middle">🧾</text>
      <text x="645" y="175" font-family="-apple-system, sans-serif" font-size="24" font-weight="700" fill="#ffffff" text-anchor="middle">Receipts</text>
      <text x="645" y="205" font-family="-apple-system, sans-serif" font-size="18" fill="#94a3b8" text-anchor="middle">12 Records</text>
    </g>

    <!-- Recent Maintenance Card Inside Screen -->
    <g transform="translate(50, 1070)">
      <text x="10" y="25" font-family="-apple-system, sans-serif" font-size="26" font-weight="700" fill="#94a3b8" letter-spacing="1">RECENT TICKETS &amp; NOTICES</text>

      <rect x="0" y="55" width="764" height="180" rx="24" fill="#131d36" stroke="rgba(255,255,255,0.08)" stroke-width="2" />
      <circle cx="70" cy="145" r="32" fill="#047857" />
      <text x="70" y="157" font-size="32" text-anchor="middle" fill="#ffffff">✓</text>
      <text x="130" y="125" font-family="-apple-system, sans-serif" font-size="28" font-weight="700" fill="#ffffff">AC Servicing Completed</text>
      <text x="130" y="165" font-family="-apple-system, sans-serif" font-size="22" font-weight="500" fill="#94a3b8">Assigned technician closed ticket #894</text>
      <rect x="620" y="115" width="110" height="50" rx="12" fill="rgba(16, 185, 129, 0.2)" />
      <text x="675" y="148" font-family="-apple-system, sans-serif" font-size="20" font-weight="700" fill="#10b981" text-anchor="middle">RESOLVED</text>

      <rect x="0" y="260" width="764" height="180" rx="24" fill="#131d36" stroke="rgba(255,255,255,0.08)" stroke-width="2" />
      <circle cx="70" cy="350" r="32" fill="#1d4ed8" />
      <text x="70" y="362" font-size="32" text-anchor="middle" fill="#ffffff">📢</text>
      <text x="130" y="330" font-family="-apple-system, sans-serif" font-size="28" font-weight="700" fill="#ffffff">Diwali Community Dinner</text>
      <text x="130" y="370" font-family="-apple-system, sans-serif" font-size="22" font-weight="500" fill="#94a3b8">Clubhouse, Tonight 8:00 PM • Owner Notice</text>
      <rect x="620" y="320" width="110" height="50" rx="12" fill="rgba(56, 189, 248, 0.2)" />
      <text x="675" y="353" font-family="-apple-system, sans-serif" font-size="20" font-weight="700" fill="#38bdf8" text-anchor="middle">NOTICE</text>
    </g>

    <!-- Bottom Tab Bar Mock Inside Phone -->
    <g transform="translate(0, 1630)">
      <rect width="864" height="154" fill="#080e1c" />
      <text x="144" y="65" font-size="38" text-anchor="middle">🏠</text>
      <text x="144" y="105" font-family="-apple-system, sans-serif" font-size="20" font-weight="700" fill="#38bdf8" text-anchor="middle">Home</text>

      <text x="336" y="65" font-size="38" text-anchor="middle">💳</text>
      <text x="336" y="105" font-family="-apple-system, sans-serif" font-size="20" font-weight="500" fill="#64748b" text-anchor="middle">Rent</text>

      <text x="528" y="65" font-size="38" text-anchor="middle">🛠️</text>
      <text x="528" y="105" font-family="-apple-system, sans-serif" font-size="20" font-weight="500" fill="#64748b" text-anchor="middle">Service</text>

      <text x="720" y="65" font-size="38" text-anchor="middle">👤</text>
      <text x="720" y="105" font-family="-apple-system, sans-serif" font-size="20" font-weight="500" fill="#64748b" text-anchor="middle">Profile</text>

      <!-- Home bar -->
      <rect x="292" y="125" width="280" height="8" rx="4" fill="#ffffff" opacity="0.6" />
    </g>
  </g>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!-- RIGHT COLUMN: 2 INFORMATIVE FEATURE CARDS                              -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <g transform="translate(3504, 880)">
    <!-- Card 3: Maintenance & Complaints -->
    <g filter="url(#cardShadow)">
      <rect width="1380" height="820" rx="44" fill="url(#cardGrad)" stroke="#2b5ba8" stroke-width="3" />
      <rect x="60" y="0" width="280" height="6" rx="3" fill="url(#pantroBlue)" />

      <rect x="60" y="70" width="130" height="130" rx="36" fill="url(#pantroBlue)" />
      <text x="125" y="152" font-size="64" text-anchor="middle" fill="#ffffff">🛠️</text>

      <text x="220" y="130" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" font-size="56" font-weight="700" fill="#ffffff">Fast Maintenance Helpdesk</text>
      <text x="220" y="180" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" font-size="34" font-weight="500" fill="#38bdf8">Photo Uploads • Real-Time Tracking • SLA Timelines</text>

      <g transform="translate(60, 260)">
        <circle cx="20" cy="25" r="12" fill="#10b981" />
        <text x="55" y="34" font-family="-apple-system, sans-serif" font-size="34" font-weight="600" fill="#f1f5f9">Raise plumbing, electrical, WiFi or appliance issues in seconds</text>
        <circle cx="20" cy="95" r="12" fill="#10b981" />
        <text x="55" y="104" font-family="-apple-system, sans-serif" font-size="34" font-weight="600" fill="#f1f5f9">Attach photos &amp; voice notes for quick fault diagnosis</text>
        <circle cx="20" cy="165" r="12" fill="#10b981" />
        <text x="55" y="174" font-family="-apple-system, sans-serif" font-size="34" font-weight="600" fill="#f1f5f9">Transparent timeline: Raised → Technician Assigned → Resolved</text>
      </g>

      <!-- Ticket Resolution Visual Step Tracker -->
      <g transform="translate(60, 500)">
        <rect width="1260" height="240" rx="28" fill="#070d1a" stroke="rgba(66, 137, 201, 0.4)" stroke-width="2" />
        <text x="50" y="65" font-family="-apple-system, sans-serif" font-size="26" font-weight="700" fill="#94a3b8" letter-spacing="1">LIVE TICKET TIMELINE: #1084 (AC REPAIR)</text>

        <!-- Stepper -->
        <g transform="translate(50, 110)">
          <!-- Line -->
          <line x1="60" y1="40" x2="1100" y2="40" stroke="#10b981" stroke-width="6" />

          <!-- Step 1 -->
          <circle cx="60" cy="40" r="28" fill="#10b981" />
          <text x="60" y="48" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="middle">✓</text>
          <text x="60" y="95" font-family="-apple-system, sans-serif" font-size="24" font-weight="700" fill="#ffffff" text-anchor="middle">Raised</text>

          <!-- Step 2 -->
          <circle cx="410" cy="40" r="28" fill="#10b981" />
          <text x="410" y="48" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="middle">✓</text>
          <text x="410" y="95" font-family="-apple-system, sans-serif" font-size="24" font-weight="700" fill="#ffffff" text-anchor="middle">Assigned</text>

          <!-- Step 3 -->
          <circle cx="760" cy="40" r="28" fill="#10b981" />
          <text x="760" y="48" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="middle">✓</text>
          <text x="760" y="95" font-family="-apple-system, sans-serif" font-size="24" font-weight="700" fill="#ffffff" text-anchor="middle">In Progress</text>

          <!-- Step 4 -->
          <circle cx="1100" cy="40" r="28" fill="#10b981" />
          <text x="1100" y="48" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="middle">✓</text>
          <text x="1100" y="95" font-family="-apple-system, sans-serif" font-size="24" font-weight="700" fill="#10b981" text-anchor="middle">Resolved</text>
        </g>
      </g>
    </g>

    <!-- Card 4: Documents & Agreements -->
    <g transform="translate(0, 890)" filter="url(#cardShadow)">
      <rect width="1380" height="820" rx="44" fill="url(#cardGrad)" stroke="#2b5ba8" stroke-width="3" />
      <rect x="60" y="0" width="280" height="6" rx="3" fill="url(#pantroBlue)" />

      <rect x="60" y="70" width="130" height="130" rx="36" fill="url(#pantroBlue)" />
      <text x="125" y="152" font-size="64" text-anchor="middle" fill="#ffffff">📑</text>

      <text x="220" y="130" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" font-size="56" font-weight="700" fill="#ffffff">Digital Documents &amp; KYC</text>
      <text x="220" y="180" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" font-size="34" font-weight="500" fill="#38bdf8">100% Cloud-Stored • Legally Binding • HRA Invoices</text>

      <g transform="translate(60, 260)">
        <circle cx="20" cy="25" r="12" fill="#10b981" />
        <text x="55" y="34" font-family="-apple-system, sans-serif" font-size="34" font-weight="600" fill="#f1f5f9">Signed rental agreement accessible 24/7 with zero paper storage</text>
        <circle cx="20" cy="95" r="12" fill="#10b981" />
        <text x="55" y="104" font-family="-apple-system, sans-serif" font-size="34" font-weight="600" fill="#f1f5f9">Download consolidated monthly invoices for corporate HRA claims</text>
        <circle cx="20" cy="165" r="12" fill="#10b981" />
        <text x="55" y="174" font-family="-apple-system, sans-serif" font-size="34" font-weight="600" fill="#f1f5f9">Instant ID verification, police NOC &amp; move-in document vault</text>
      </g>

      <!-- Document Vault Cards -->
      <g transform="translate(60, 500)">
        <rect x="0" y="0" width="610" height="230" rx="24" fill="#070d1a" stroke="rgba(255,255,255,0.1)" stroke-width="2" />
        <text x="40" y="65" font-family="-apple-system, sans-serif" font-size="26" font-weight="600" fill="#94a3b8">RENT AGREEMENT (PDF)</text>
        <text x="40" y="130" font-family="-apple-system, sans-serif" font-size="44" font-weight="800" fill="#ffffff">11-Month Lease.pdf</text>
        <text x="40" y="185" font-family="-apple-system, sans-serif" font-size="28" font-weight="600" fill="#10b981">✓ Digitally Signed &amp; Stamped</text>

        <rect x="650" y="0" width="610" height="230" rx="24" fill="#070d1a" stroke="rgba(255,255,255,0.1)" stroke-width="2" />
        <text x="690" y="65" font-family="-apple-system, sans-serif" font-size="26" font-weight="600" fill="#94a3b8">HRA RENT RECEIPTS</text>
        <text x="690" y="130" font-family="-apple-system, sans-serif" font-size="44" font-weight="800" fill="#ffffff">FY 2026-27 Invoices</text>
        <text x="690" y="185" font-family="-apple-system, sans-serif" font-size="28" font-weight="600" fill="#38bdf8">↓ Download All Receipts</text>
      </g>
    </g>
  </g>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!-- BOTTOM TRUST & APP STORE COMPLIANCE BAR                               -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <g transform="translate(460, 2720)">
    <rect width="4324" height="150" rx="40" fill="#0d172e" stroke="rgba(66, 137, 201, 0.4)" stroke-width="2.5" />
    
    <g transform="translate(180, 95)">
      <text x="0" y="0" font-family="-apple-system, sans-serif" font-size="34" font-weight="700" fill="#ffffff">🔒  256-Bit Bank Grade Encryption</text>
      <text x="950" y="0" font-family="-apple-system, sans-serif" font-size="34" font-weight="700" fill="#ffffff">⚡  Instant UPI &amp; NetBanking Settlement</text>
      <text x="2100" y="0" font-family="-apple-system, sans-serif" font-size="34" font-weight="700" fill="#ffffff">📑  Paperless Digital Rental Agreements</text>
      <text x="3250" y="0" font-family="-apple-system, sans-serif" font-size="34" font-weight="700" fill="#38bdf8">📱  Apple App Store Ready</text>
    </g>
  </g>
</svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. GENERATE 3840 x 1646 px SVG (In-App Event / Editorial Banner)
// ─────────────────────────────────────────────────────────────────────────────
function generateBannerSvg() {
  const width = 3840;
  const height = 1646;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050811" />
      <stop offset="40%" stop-color="#070b14" />
      <stop offset="80%" stop-color="#0c152a" />
      <stop offset="100%" stop-color="#050811" />
    </linearGradient>

    <linearGradient id="bPantroBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#204ca1" />
      <stop offset="50%" stop-color="#316ec7" />
      <stop offset="100%" stop-color="#4289c9" />
    </linearGradient>

    <linearGradient id="bCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d172e" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#09101f" stop-opacity="0.95" />
    </linearGradient>

    <linearGradient id="bEmeraldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>

    <filter id="bGlowHuge" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="120" result="blur" />
    </filter>
    <filter id="bCardShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="30" flood-color="#000000" flood-opacity="0.65" />
    </filter>
  </defs>

  <!-- Deep Background -->
  <rect width="${width}" height="${height}" fill="url(#bBgGrad)" />

  <!-- Ambient Blue Lighting -->
  <circle cx="700" cy="500" r="700" fill="#204ca1" opacity="0.4" filter="url(#bGlowHuge)" />
  <circle cx="2800" cy="800" r="900" fill="#316ec7" opacity="0.35" filter="url(#bGlowHuge)" />

  <!-- Tech Grid Background -->
  <g opacity="0.04" stroke="#ffffff" stroke-width="1.5">
    ${Array.from({ length: 16 }, (_, i) => `<line x1="0" y1="${i * 110}" x2="${width}" y2="${i * 110}" />`).join('\n    ')}
    ${Array.from({ length: 36 }, (_, i) => `<line x1="${i * 110}" y1="0" x2="${i * 110}" y2="${height}" />`).join('\n    ')}
  </g>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!-- LEFT HALF: BRAND IDENTITY & KEY INFORMATION                            -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <g transform="translate(180, 140)">
    <!-- Header Row: Logo + Category Pill -->
    <g>
      <!-- Logo Squircle -->
      <rect x="0" y="0" width="160" height="160" rx="38" fill="#ffffff" stroke="rgba(255,255,255,0.4)" stroke-width="3" filter="url(#bCardShadow)" />
      <image href="data:image/png;base64,${iconBase64}" x="16" y="16" width="128" height="128" preserveAspectRatio="xMidYMid meet" />

      <!-- Category Pill -->
      <rect x="190" y="45" width="560" height="70" rx="35" fill="rgba(32, 76, 161, 0.25)" stroke="#316ec7" stroke-width="2" />
      <circle cx="230" cy="80" r="10" fill="#2dd4bf" />
      <text x="460" y="90" font-family="-apple-system, sans-serif" font-size="26" font-weight="700" fill="#38bdf8" text-anchor="middle" letter-spacing="3">OFFICIAL TENANT PORTAL APP</text>
    </g>

    <!-- Main Title -->
    <text x="0" y="270" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" font-size="94" font-weight="800" fill="#ffffff" letter-spacing="-1">Pantro Tenant</text>
    <text x="0" y="335" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" font-size="38" font-weight="500" fill="#94a3b8">The Smart Way to Pay Rent, Track Dues &amp; Manage Your Stay</text>

    <!-- 4 Informative Feature Rows -->
    <g transform="translate(0, 410)">
      <!-- Feature 1: Rent Payment -->
      <g transform="translate(0, 0)">
        <rect width="1860" height="140" rx="28" fill="url(#bCardGrad)" stroke="#204ca1" stroke-width="2" />
        <rect x="30" y="25" width="90" height="90" rx="22" fill="url(#bPantroBlue)" />
        <text x="75" y="82" font-size="44" text-anchor="middle" fill="#ffffff">💳</text>
        <text x="150" y="65" font-family="-apple-system, sans-serif" font-size="34" font-weight="700" fill="#ffffff">Instant UPI Rent &amp; Dues Settlement</text>
        <text x="150" y="105" font-family="-apple-system, sans-serif" font-size="26" font-weight="500" fill="#38bdf8">1-click UPI payments • Automated HRA-compliant rent receipts • Due reminders</text>
        <text x="1800" y="82" font-size="28" text-anchor="end" fill="#10b981">● Live UPI</text>
      </g>

      <!-- Feature 2: Stay & Room -->
      <g transform="translate(0, 170)">
        <rect width="1860" height="140" rx="28" fill="url(#bCardGrad)" stroke="#204ca1" stroke-width="2" />
        <rect x="30" y="25" width="90" height="90" rx="22" fill="url(#bPantroBlue)" />
        <text x="75" y="82" font-size="44" text-anchor="middle" fill="#ffffff">🏠</text>
        <text x="150" y="65" font-family="-apple-system, sans-serif" font-size="34" font-weight="700" fill="#ffffff">Complete Stay &amp; Roommate Directory</text>
        <text x="150" y="105" font-family="-apple-system, sans-serif" font-size="26" font-weight="500" fill="#94a3b8">Allocated room details, bed sharing, amenities &amp; direct property guidelines</text>
        <text x="1800" y="82" font-size="28" text-anchor="end" fill="#38bdf8">Room 304 ✓</text>
      </g>

      <!-- Feature 3: Maintenance -->
      <g transform="translate(0, 340)">
        <rect width="1860" height="140" rx="28" fill="url(#bCardGrad)" stroke="#204ca1" stroke-width="2" />
        <rect x="30" y="25" width="90" height="90" rx="22" fill="url(#bPantroBlue)" />
        <text x="75" y="82" font-size="44" text-anchor="middle" fill="#ffffff">🛠️</text>
        <text x="150" y="65" font-family="-apple-system, sans-serif" font-size="34" font-weight="700" fill="#ffffff">Real-Time Maintenance &amp; Complaint Desk</text>
        <text x="150" y="105" font-family="-apple-system, sans-serif" font-size="26" font-weight="500" fill="#94a3b8">Photo uploads, direct technician allocation &amp; fast SLA resolution tracking</text>
        <text x="1800" y="82" font-size="28" text-anchor="end" fill="#10b981">Resolved ✓</text>
      </g>

      <!-- Feature 4: Documents -->
      <g transform="translate(0, 510)">
        <rect width="1860" height="140" rx="28" fill="url(#bCardGrad)" stroke="#204ca1" stroke-width="2" />
        <rect x="30" y="25" width="90" height="90" rx="22" fill="url(#bPantroBlue)" />
        <text x="75" y="82" font-size="44" text-anchor="middle" fill="#ffffff">📑</text>
        <text x="150" y="65" font-family="-apple-system, sans-serif" font-size="34" font-weight="700" fill="#ffffff">100% Digital Agreements &amp; KYC Vault</text>
        <text x="150" y="105" font-family="-apple-system, sans-serif" font-size="26" font-weight="500" fill="#94a3b8">Cloud-stored signed lease agreements, police verification &amp; payment archives</text>
        <text x="1800" y="82" font-size="28" text-anchor="end" fill="#38bdf8">Encrypted 🔒</text>
      </g>
    </g>

    <!-- Bottom Trust Line -->
    <g transform="translate(0, 1150)">
      <text x="0" y="0" font-family="-apple-system, sans-serif" font-size="28" font-weight="600" fill="#64748b">🔒 256-Bit Bank Grade Security  •  ⚡ Instant UPI Payments  •  📱 Official Apple App Store Release</text>
    </g>
  </g>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!-- RIGHT HALF: FLOATING LIVE DEVICE PREVIEW & STAT CARDS                  -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <g transform="translate(2420, 140)">
    <!-- Main Device Chassis -->
    <g filter="url(#bCardShadow)">
      <rect width="680" height="1360" rx="70" fill="#070c17" stroke="url(#bPantroBlue)" stroke-width="8" />
      <rect x="14" y="14" width="652" height="1332" rx="60" fill="#0a101f" />

      <!-- Dynamic Island -->
      <rect x="250" y="30" width="180" height="46" rx="23" fill="#000000" />
      <text x="60" y="62" font-family="-apple-system, sans-serif" font-size="24" font-weight="700" fill="#ffffff">9:41</text>
      <text x="600" y="62" font-family="-apple-system, sans-serif" font-size="22" font-weight="600" fill="#ffffff" text-anchor="end">5G 100%</text>

      <!-- Inside Phone App Header -->
      <g transform="translate(40, 110)">
        <rect x="0" y="0" width="60" height="60" rx="16" fill="#ffffff" />
        <image href="data:image/png;base64,${iconBase64}" x="6" y="6" width="48" height="48" />
        <text x="75" y="32" font-family="-apple-system, sans-serif" font-size="26" font-weight="800" fill="#ffffff">Pantro Tenant</text>
        <text x="75" y="54" font-family="-apple-system, sans-serif" font-size="18" fill="#94a3b8">Tenant Dashboard</text>
      </g>

      <!-- Active Rent Due Card inside Phone -->
      <g transform="translate(40, 200)">
        <rect width="572" height="320" rx="28" fill="url(#bPantroBlue)" />
        <text x="35" y="50" font-family="-apple-system, sans-serif" font-size="18" font-weight="700" fill="rgba(255,255,255,0.8)" letter-spacing="2">ACTIVE RENT DUE</text>
        <text x="35" y="125" font-family="-apple-system, sans-serif" font-size="56" font-weight="800" fill="#ffffff">₹ 18,500</text>
        <text x="35" y="165" font-family="-apple-system, sans-serif" font-size="20" fill="rgba(255,255,255,0.9)">Room 304 • Due in 3 Days</text>

        <rect x="35" y="205" width="502" height="80" rx="20" fill="#ffffff" />
        <text x="286" y="255" font-family="-apple-system, sans-serif" font-size="26" font-weight="800" fill="#204ca1" text-anchor="middle">PAY VIA UPI ⚡</text>
      </g>

      <!-- Feature Grid inside Phone -->
      <g transform="translate(40, 560)">
        <rect x="0" y="0" width="270" height="150" rx="20" fill="#131d36" stroke="rgba(255,255,255,0.08)" stroke-width="2" />
        <text x="30" y="55" font-size="34">🛠️</text>
        <text x="30" y="100" font-family="-apple-system, sans-serif" font-size="22" font-weight="700" fill="#ffffff">Maintenance</text>
        <text x="30" y="128" font-family="-apple-system, sans-serif" font-size="16" fill="#10b981">0 Active Issues</text>

        <rect x="302" y="0" width="270" height="150" rx="20" fill="#131d36" stroke="rgba(255,255,255,0.08)" stroke-width="2" />
        <text x="332" y="55" font-size="34">📄</text>
        <text x="332" y="100" font-family="-apple-system, sans-serif" font-size="22" font-weight="700" fill="#ffffff">Agreement</text>
        <text x="332" y="128" font-family="-apple-system, sans-serif" font-size="16" fill="#38bdf8">Verified Lease</text>
      </g>

      <!-- Recent Transactions List inside Phone -->
      <g transform="translate(40, 750)">
        <text x="5" y="20" font-family="-apple-system, sans-serif" font-size="20" font-weight="700" fill="#94a3b8" letter-spacing="1">RECENT ACTIVITY</text>

        <rect x="0" y="40" width="572" height="110" rx="20" fill="#131d36" stroke="rgba(255,255,255,0.08)" stroke-width="2" />
        <circle cx="50" cy="95" r="24" fill="#059669" />
        <text x="50" y="104" font-size="24" text-anchor="middle" fill="#ffffff">✓</text>
        <text x="95" y="80" font-family="-apple-system, sans-serif" font-size="22" font-weight="700" fill="#ffffff">October Rent Paid</text>
        <text x="95" y="112" font-family="-apple-system, sans-serif" font-size="16" fill="#94a3b8">₹18,500 • Instant Receipt</text>

        <rect x="0" y="170" width="572" height="110" rx="20" fill="#131d36" stroke="rgba(255,255,255,0.08)" stroke-width="2" />
        <circle cx="50" cy="225" r="24" fill="#2563eb" />
        <text x="50" y="234" font-size="24" text-anchor="middle" fill="#ffffff">✓</text>
        <text x="95" y="210" font-family="-apple-system, sans-serif" font-size="22" font-weight="700" fill="#ffffff">Electricity Bill Settled</text>
        <text x="95" y="242" font-family="-apple-system, sans-serif" font-size="16" fill="#94a3b8">₹1,240 • Auto-Receipt</text>
      </g>
    </g>

    <!-- Floating Live Stat Badges on Right -->
    <g transform="translate(730, 200)" filter="url(#bCardShadow)">
      <!-- Floating Badge 1: Verified Rent -->
      <rect width="470" height="180" rx="30" fill="#0d172e" stroke="#10b981" stroke-width="3" />
      <circle cx="65" cy="90" r="34" fill="#10b981" />
      <text x="65" y="102" font-size="34" text-anchor="middle" fill="#ffffff">✓</text>
      <text x="125" y="75" font-family="-apple-system, sans-serif" font-size="26" font-weight="700" fill="#ffffff">Rent Payment Verified</text>
      <text x="125" y="112" font-family="-apple-system, sans-serif" font-size="20" font-weight="500" fill="#10b981">Direct Bank Settlement</text>
      <text x="125" y="142" font-family="-apple-system, sans-serif" font-size="18" fill="#94a3b8">Receipt #PNT-99824</text>

      <!-- Floating Badge 2: Fast Maintenance -->
      <g transform="translate(0, 240)">
        <rect width="470" height="180" rx="30" fill="#0d172e" stroke="#316ec7" stroke-width="3" />
        <circle cx="65" cy="90" r="34" fill="#204ca1" />
        <text x="65" y="102" font-size="34" text-anchor="middle" fill="#ffffff">⚡</text>
        <text x="125" y="75" font-family="-apple-system, sans-serif" font-size="26" font-weight="700" fill="#ffffff">24/7 Service Desk</text>
        <text x="125" y="112" font-family="-apple-system, sans-serif" font-size="20" font-weight="500" fill="#38bdf8">Avg. SLA: &lt; 2 Hours</text>
        <text x="125" y="142" font-family="-apple-system, sans-serif" font-size="18" fill="#94a3b8">Photo &amp; Voice Tickets</text>
      </g>

      <!-- Floating Badge 3: Digital Vault -->
      <g transform="translate(0, 480)">
        <rect width="470" height="180" rx="30" fill="#0d172e" stroke="rgba(255,255,255,0.2)" stroke-width="3" />
        <circle cx="65" cy="90" r="34" fill="#1e293b" />
        <text x="65" y="102" font-size="34" text-anchor="middle" fill="#ffffff">📑</text>
        <text x="125" y="75" font-family="-apple-system, sans-serif" font-size="26" font-weight="700" fill="#ffffff">Digital Agreement</text>
        <text x="125" y="112" font-family="-apple-system, sans-serif" font-size="20" font-weight="500" fill="#ffffff">100% Paperless KYC</text>
        <text x="125" y="142" font-family="-apple-system, sans-serif" font-size="18" fill="#10b981">Verified &amp; Stamped ✓</text>
      </g>
    </g>
  </g>
</svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTE GENERATION & RENDERING
// ─────────────────────────────────────────────────────────────────────────────
console.log('Writing SVGs...');
const heroSvgPath = path.join(OUTPUT_DIR, 'pantro_app_store_hero_5244x2950.svg');
const bannerSvgPath = path.join(OUTPUT_DIR, 'pantro_app_store_banner_3840x1646.svg');

fs.writeFileSync(heroSvgPath, generateHeroSvg());
fs.writeFileSync(bannerSvgPath, generateBannerSvg());

console.log('SVGs written successfully!');
console.log('Rendering to high-res PNG and JPEG using macOS sips...');

const heroPngPath = path.join(OUTPUT_DIR, 'pantro_app_store_hero_5244x2950.png');
const heroJpgPath = path.join(OUTPUT_DIR, 'pantro_app_store_hero_5244x2950.jpg');

const bannerPngPath = path.join(OUTPUT_DIR, 'pantro_app_store_banner_3840x1646.png');
const bannerJpgPath = path.join(OUTPUT_DIR, 'pantro_app_store_banner_3840x1646.jpg');

// Render Hero
execSync(`sips -s format png "${heroSvgPath}" --out "${heroPngPath}"`);
execSync(`sips -s format jpeg "${heroPngPath}" --out "${heroJpgPath}"`);

// Render Banner
execSync(`sips -s format png "${bannerSvgPath}" --out "${bannerPngPath}"`);
execSync(`sips -s format jpeg "${bannerPngPath}" --out "${bannerJpgPath}"`);

console.log('Rendering complete!');
