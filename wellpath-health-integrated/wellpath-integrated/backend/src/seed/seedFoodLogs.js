// Seeds distinct, realistic meal histories for patients 2-6 so each demo profile
// has an "eating personality" that produces interesting nutrition insights.
// Patient 1 (Alex) already has a full year of balanced data and is left untouched.
//
// Run with:  node src/seed/seedFoodLogs.js
import { pool } from '../config/db.js';

// Each food: [name, kcal, protein, carbs, sugar, fibre, fat, satfat, sodium]
const P = (name, kcal, protein, carbs, sugar, fibre, fat, satfat, sodium) =>
  ({ name, kcal, protein, carbs, sugar, fibre, fat, satfat, sodium });

// ---- Persona food pools (breakfast / lunch / dinner / snack) ----
const PERSONAS = {
  // Maria (2) — Weight Management: big portions, sugary, frequent snacking.
  2: {
    label: 'high-calorie / sugary / large portions',
    breakfast: [
      P('Stack of pancakes with syrup & butter', 720, 12, 110, 45, 3, 26, 12, 780),
      P('Sugary cereal with whole milk', 480, 11, 82, 38, 2, 12, 6, 420),
      P('Bagel with cream cheese & orange juice', 560, 14, 88, 24, 3, 17, 9, 720),
    ],
    lunch: [
      P('Cheeseburger with large fries', 1020, 34, 108, 12, 6, 48, 18, 1360),
      P('Creamy alfredo pasta, big portion', 940, 28, 118, 9, 5, 38, 20, 1180),
      P('Loaded burrito with sour cream', 860, 32, 96, 8, 12, 36, 14, 1420),
    ],
    dinner: [
      P('Half a large pepperoni pizza', 1080, 44, 116, 14, 6, 46, 22, 2100),
      P('Fried chicken with mash & gravy', 980, 52, 78, 8, 5, 46, 14, 1580),
      P('Sweet & sour pork with fried rice', 1120, 34, 140, 42, 6, 44, 12, 1680),
    ],
    snack: [
      P('Chocolate bar & soda', 420, 5, 68, 58, 2, 16, 10, 90),
      P('Two scoops of ice cream', 380, 6, 44, 38, 1, 20, 12, 120),
      P('Bag of potato chips', 320, 4, 34, 1, 3, 20, 4, 480),
    ],
    snackChance: 0.85,
  },

  // James (3) — Blood Pressure: sodium bomb, fast food, processed.
  3: {
    label: 'very high sodium / processed / fast food',
    breakfast: [
      P('Bacon, sausage & hash brown platter', 720, 26, 42, 4, 3, 48, 16, 1580),
      P('Instant ramen with an egg', 480, 14, 62, 4, 3, 18, 8, 1720),
      P('Deli ham & cheese croissant', 520, 20, 40, 6, 2, 30, 15, 1180),
    ],
    lunch: [
      P('Fast-food double cheeseburger meal', 1150, 46, 112, 14, 5, 54, 22, 1980),
      P('Canned soup with saltine crackers', 420, 14, 58, 8, 5, 14, 5, 2200),
      P('Deli sub with chips & a pickle', 880, 34, 92, 10, 5, 38, 12, 2400),
    ],
    dinner: [
      P('Chinese takeout salt & pepper chicken', 960, 42, 88, 12, 4, 46, 12, 2600),
      P('Frozen lasagna, whole tray', 820, 34, 78, 12, 6, 38, 18, 1920),
      P('Pizza with extra pepperoni & olives', 1040, 44, 104, 12, 6, 46, 20, 2350),
    ],
    snack: [
      P('Salted pretzels', 280, 7, 54, 2, 2, 4, 1, 1210),
      P('Beef jerky & a soda', 300, 22, 32, 26, 1, 8, 3, 1400),
      P('Nachos with cheese sauce', 520, 12, 52, 4, 5, 30, 10, 1180),
    ],
    snackChance: 0.6,
  },

  // Sophie (4) — Fitness: very healthy, high protein & fibre, low sodium/satfat.
  4: {
    label: 'very healthy / high protein & fibre / lean',
    breakfast: [
      P('Overnight oats with berries & chia', 360, 14, 54, 12, 11, 10, 2, 60),
      P('Veggie egg-white omelette with spinach', 280, 26, 10, 4, 4, 14, 3, 340),
      P('Greek yogurt with almonds & blueberries', 300, 24, 28, 16, 6, 11, 2, 90),
    ],
    lunch: [
      P('Grilled chicken quinoa salad bowl', 480, 42, 46, 8, 12, 14, 2, 420),
      P('Salmon poke bowl with edamame', 520, 38, 54, 9, 10, 16, 3, 560),
      P('Lentil & kale soup with wholegrain roll', 420, 22, 62, 10, 16, 8, 1, 480),
    ],
    dinner: [
      P('Baked salmon, brown rice & broccoli', 540, 40, 52, 6, 9, 18, 3, 380),
      P('Grilled tofu stir-fry with vegetables', 430, 26, 48, 12, 11, 15, 2, 520),
      P('Turkey chilli with beans & avocado', 510, 42, 46, 10, 15, 16, 3, 560),
    ],
    snack: [
      P('Apple with peanut butter', 210, 7, 26, 18, 5, 10, 2, 65),
      P('Protein shake with banana', 250, 30, 28, 18, 4, 4, 1, 180),
      P('Carrot sticks with hummus', 170, 6, 22, 8, 7, 7, 1, 260),
    ],
    snackChance: 0.75,
  },

  // Daniel (5) — Stress Management: comfort food, sugar, caffeine, late-night.
  5: {
    label: 'stress/comfort eating / sugar & caffeine / irregular late nights',
    breakfast: [
      P('Large caramel latte & a muffin', 620, 10, 86, 52, 2, 24, 12, 380),
      P('Energy drink & granola bar', 330, 5, 62, 44, 2, 8, 4, 220),
      P('Double espresso, skipped food', 10, 0, 2, 0, 0, 0, 0, 15),
    ],
    lunch: [
      P('Grabbed a meatball sub', 780, 32, 82, 12, 5, 34, 12, 1520),
      P('Mac and cheese, comfort portion', 720, 24, 84, 10, 4, 30, 16, 1140),
      P('Leftover pizza slices', 680, 28, 72, 8, 4, 30, 13, 1360),
    ],
    dinner: [
      P('Late-night burger & fries', 980, 38, 96, 12, 6, 46, 16, 1420),
      P('Ramen with extra noodles', 620, 18, 88, 6, 4, 22, 9, 1980),
      P('Delivery butter chicken with naan', 1050, 40, 104, 18, 7, 48, 22, 1580),
    ],
    snack: [
      P('Cookies and milk', 380, 8, 52, 34, 2, 16, 9, 260),
      P('Tub of ice cream, late night', 520, 8, 60, 50, 1, 28, 18, 160),
      P('Chips and an energy drink', 450, 5, 62, 40, 3, 20, 5, 620),
    ],
    snackChance: 0.9,
  },

  // Robert (6, age 62) — Diabetes Prevention: refined carbs + sugar + satfat.
  6: {
    label: 'high refined carbs & sugar + high saturated fat',
    breakfast: [
      P('White toast with jam & fried eggs', 520, 16, 58, 22, 2, 24, 8, 780),
      P('Sugary cereal with 2% milk', 440, 10, 78, 34, 3, 10, 5, 380),
      P('Donut and a sweet coffee', 480, 6, 62, 42, 1, 22, 11, 350),
    ],
    lunch: [
      P('Ham sandwich on white with chips', 760, 26, 78, 10, 4, 34, 12, 1420),
      P('Fried fish and chips', 980, 32, 96, 8, 6, 48, 12, 1180),
      P('Sausage roll and a cola', 640, 16, 74, 40, 3, 30, 14, 980),
    ],
    dinner: [
      P('Steak pie with mashed potato', 880, 34, 82, 10, 6, 44, 20, 1320),
      P('Fried rice with sweet & sour', 920, 24, 128, 46, 5, 32, 8, 1450),
      P('Roast pork with roast potatoes & gravy', 940, 46, 76, 9, 7, 46, 18, 1380),
    ],
    snack: [
      P('Two chocolate digestives & tea', 240, 3, 34, 18, 1, 11, 6, 180),
      P('Slice of cake', 400, 5, 56, 44, 1, 18, 10, 320),
      P('Handful of toffees', 260, 1, 52, 46, 0, 6, 4, 90),
    ],
    snackChance: 0.8,
  },
};

const DAYS = 75; // ~2.5 months of history
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const jitter = (v) => Math.max(0, Math.round(v * (0.92 + Math.random() * 0.16) * 100) / 100); // ±8%

function mealAt(baseDate, dayOffset, hour, minute) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() - dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;

async function seed() {
  const base = new Date();
  for (const [pid, persona] of Object.entries(PERSONAS)) {
    await pool.query('DELETE FROM patient_food_log WHERE patient_id = ?', [pid]);
    const rows = [];
    for (let day = 0; day < DAYS; day += 1) {
      const plan = [
        { pool: persona.breakfast, h: 7 + Math.floor(Math.random() * 2), m: [0, 15, 30, 45][Math.floor(Math.random() * 4)] },
        { pool: persona.lunch, h: 12 + Math.floor(Math.random() * 2), m: [0, 15, 30][Math.floor(Math.random() * 3)] },
        { pool: persona.dinner, h: 18 + Math.floor(Math.random() * 3), m: [0, 15, 30][Math.floor(Math.random() * 3)] },
      ];
      if (Math.random() < persona.snackChance) {
        // Daniel snacks late; others mid-afternoon/evening.
        const lateNight = pid === '5';
        plan.push({ pool: persona.snack, h: lateNight ? 22 + Math.floor(Math.random() * 2) : 15 + Math.floor(Math.random() * 4), m: [0, 20, 40][Math.floor(Math.random() * 3)] });
      }
      for (const slot of plan) {
        const f = pick(slot.pool);
        const when = mealAt(base, day, slot.h, slot.m);
        rows.push([
          pid, fmt(when), f.name,
          jitter(f.kcal), jitter(f.protein), jitter(f.carbs), jitter(f.sugar),
          jitter(f.fibre), jitter(f.fat), jitter(f.satfat), jitter(f.sodium),
          0,
        ]);
      }
    }
    await pool.query(
      `INSERT INTO patient_food_log
        (patient_id, logged_at, food_name, kcal, protein_g, carbs_g, sugar_g, fibre_g, fat_g, satfat_g, sodium_mg, ai_estimated)
       VALUES ?`,
      [rows]
    );
    console.log(`Patient ${pid} (${persona.label}): seeded ${rows.length} meals over ${DAYS} days.`);
  }
}

seed()
  .then(() => { console.log('Food-log seeding complete.'); process.exit(0); })
  .catch((e) => { console.error('Seeding failed:', e.message); process.exit(1); });
