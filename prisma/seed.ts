import { db } from "@/lib/db";

// KaSiHUB Seed Data
// South African names and context per the spec

const FIRST_NAMES = [
  "Thabo", "Lerato", "Sipho", "Nomsa", "Mandla", "Zanele", "Bongani", "Precious",
  "Sizwe", "Nokuthula", "Themba", "Busisiwe", "Mlungisi", "Ayanda", "Kagiso", "Refilwe",
  "Tshepo", "Mosa", "Katlego", "Boitumelo", "Lebohang", "Karabo", "Mpho", "Naledi",
  "Ofentse", "Palesa", "Tumelo", "Basetsana", "Bafana", "Dineo", "Lwazi", "Ntombi",
];

const LAST_NAMES = [
  "Mthembu", "Dlamini", "Khumalo", "Nkosi", "Zulu", "Mahlangu", "Mokoena", "Sithole",
  "Ndlovu", "Mthethwa", "Maseko", "Hlophe", "Zondi", "Khoza", "Mhlongo", "Ngcobo",
  "Shabalala", "Mdluli", "Mthethwa", "Naidoo", "Pillay", "Govender", "Botha", "Naidoo",
];

const COUNTRIES = ["South Africa", "Lesotho", "Eswatini", "Botswana", "Zimbabwe"];
const CITIES = ["Johannesburg", "Soweto", "Pretoria", "Durban", "Cape Town", "Port Elizabeth", "Bloemfontein", "Polokwane"];

const MARKETPLACE_PRODUCTS = [
  { name: "Prepaid Electricity", description: "Buy electricity tokens for your home prepaid meter", category: "UTILITIES", provider: "Eskom Direct", price: 200, commissionPct: 3, imageColor: "amber", rating: 4.6, popular: true },
  { name: "Airtime Bundle - Vodacom", description: "R50 airtime + 1GB data bundle for Vodacom users", category: "AIRTIME", provider: "Vodacom", price: 50, commissionPct: 5, imageColor: "rose", rating: 4.8, popular: true },
  { name: "Airtime Bundle - MTN", description: "R50 airtime + 1GB data bundle for MTN users", category: "AIRTIME", provider: "MTN", price: 50, commissionPct: 5, imageColor: "yellow", rating: 4.7, popular: true },
  { name: "Monthly Groceries Pack", description: "Essential staples - maize meal, rice, oil, sugar, bread", category: "GROCERIES", provider: "Kasi Suppliers", price: 650, commissionPct: 4, imageColor: "emerald", rating: 4.5, popular: true },
  { name: "Funeral Cover - Family", description: "Comprehensive funeral cover for the whole family up to R50,000", category: "INSURANCE", provider: "African Unity", price: 180, commissionPct: 8, imageColor: "slate", rating: 4.4 },
  { name: "Taxi Pass - Monthly", description: "Unlimited taxi rides within your zone for 30 days", category: "TRANSPORT", provider: "Kasi Transit", price: 450, commissionPct: 6, imageColor: "cyan", rating: 4.3 },
  { name: "Clinic Visit Voucher", description: "General practitioner consultation at participating clinics", category: "HEALTH", provider: "MediKasi", price: 250, commissionPct: 7, imageColor: "teal", rating: 4.6 },
  { name: "Data Bundle 5GB", description: "5GB mobile data valid for 30 days - all networks", category: "AIRTIME", provider: "Kasi Connect", price: 99, commissionPct: 4, imageColor: "violet", rating: 4.7 },
  { name: "School Uniform Pack", description: "Complete school uniform set for primary scholars", category: "GROCERIES", provider: "SchoolMart", price: 520, commissionPct: 5, imageColor: "orange", rating: 4.5 },
  { name: "Bread & Milk Weekly", description: "Fresh bread and milk delivered weekly for a month", category: "GROCERIES", provider: "Kasi Fresh", price: 320, commissionPct: 4, imageColor: "lime", rating: 4.6 },
  { name: "DSTV Compact Recharge", description: "Monthly DSTV Compact subscription recharge", category: "UTILITIES", provider: "MultiChoice", price: 129, commissionPct: 3, imageColor: "blue", rating: 4.4 },
  { name: "Pharmacy Voucher", description: "R200 voucher redeemable at participating pharmacies", category: "HEALTH", provider: "Kasi Pharmacy", price: 200, commissionPct: 6, imageColor: "pink", rating: 4.5 },
];

const SHARE_PHASES = [
  { phase: 1, pricePerShare: 25, totalShares: 50000, soldShares: 18420, status: "OPEN", bonusBuyOneGet: true },
  { phase: 2, pricePerShare: 35, totalShares: 40000, soldShares: 0, status: "UPCOMING", bonusBuyOneGet: false },
  { phase: 3, pricePerShare: 50, totalShares: 30000, soldShares: 0, status: "UPCOMING", bonusBuyOneGet: false },
  { phase: 4, pricePerShare: 75, totalShares: 20000, soldShares: 0, status: "UPCOMING", bonusBuyOneGet: false },
  { phase: 5, pricePerShare: 100, totalShares: 10000, soldShares: 0, status: "UPCOMING", bonusBuyOneGet: false },
];

const MALL_STORES = [
  "KasiGrocer", "KasiBakery", "KasiButchery", "KasiFresh Produce",
  "KasiPharmacy", "KasiFashion", "KasiElectronics", "KasiCafe",
];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randFloat(min: number, max: number, dp = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dp));
}

async function main() {
  console.log("🌱 Seeding KaSiHUB database...");

  // Clear existing data
  await db.transaction.deleteMany();
  await db.mallTransaction.deleteMany();
  await db.marketplaceOrder.deleteMany();
  await db.marketplaceProduct.deleteMany();
  await db.kasiPoolDistribution.deleteMany();
  await db.rootsBankShare.deleteMany();
  await db.share.deleteMany();
  await db.sharePhase.deleteMany();
  await db.matrixNode.deleteMany();
  await db.subscription.deleteMany();
  await db.member.deleteMany();
  await db.siloConfig.deleteMany();
  await db.setting.deleteMany();
  await db.dividendDeclaration.deleteMany();

  // 0a. Silo Config (Exco-editable mall payment splits)
  const SILOS = [
    { name: "Cost of Sale (Suppliers)", percentage: 65, description: "Paid to suppliers for goods sold at KasiMall stores", color: "oklch(0.55 0.08 50)", sortOrder: 1 },
    { name: "VAT", percentage: 15, description: "Value Added Tax remitted to SARS", color: "oklch(0.65 0.18 145)", sortOrder: 2 },
    { name: "KasiShare Pool", percentage: 10, description: "Distributed daily to KasiShare holders", color: "oklch(0.75 0.15 80)", sortOrder: 3 },
    { name: "KasiPool", percentage: 10, description: "Shared equally among eligible Hub members, paid nightly", color: "oklch(0.52 0.13 158)", sortOrder: 4 },
  ];
  for (const s of SILOS) {
    await db.siloConfig.create({ data: s });
  }

  // 0b. Settings (commission rates, thresholds, etc.)
  await db.setting.create({ data: { key: "commission_per_level", value: JSON.stringify([20, 10, 8, 5, 3, 1]), category: "matrix" } });
  await db.setting.create({ data: { key: "subscription_amount_individual", value: "140", category: "subscription" } });
  await db.setting.create({ data: { key: "subscription_amount_company", value: "300", category: "subscription" } });
  await db.setting.create({ data: { key: "subscription_amount_intl_individual", value: "20", category: "subscription" } });
  await db.setting.create({ data: { key: "subscription_amount_intl_company", value: "50", category: "subscription" } });
  await db.setting.create({ data: { key: "tax_threshold_monthly", value: "7000", category: "tax" } });
  await db.setting.create({ data: { key: "tax_rate", value: "25", category: "tax" } });
  await db.setting.create({ data: { key: "pioneer_pool_pct", value: "1", category: "rootsbank" } });
  await db.setting.create({ data: { key: "pioneer_pool_target", value: "200", category: "rootsbank" } });
  await db.setting.create({ data: { key: "mall_member_threshold", value: "5000", category: "mall" } });
  await db.setting.create({ data: { key: "daily_profit_pool_usd", value: "2000", category: "shares" } });
  await db.setting.create({ data: { key: "payout_time_sast", value: "12:00", category: "pool" } });

  // 1. Share Phases
  for (const sp of SHARE_PHASES) {
    await db.sharePhase.create({ data: sp });
  }

  // 2. Marketplace Products
  for (const p of MARKETPLACE_PRODUCTS) {
    await db.marketplaceProduct.create({
      data: { ...p, currency: "ZAR" },
    });
  }

  // 3. Create the current demo member (the "logged in" user) - placed first in matrix
  const demoMember = await db.member.create({
    data: {
      profileNumber: "KSH-000001",
      membershipType: "INDIVIDUAL_ADULT",
      firstName: "Thabo",
      lastName: "Mokoena",
      idPassport: "8501015800087",
      sarsNumber: "9123456789",
      email: "thabo.mokoena@kasihub.co.za",
      country: "South Africa",
      mobile: "+27 82 123 4567",
      addressLine: "1234 Pela Street",
      city: "Soweto",
      postalCode: "1804",
      beneficiaryName: "Nomsa Mokoena",
      beneficiaryId: "8902150120089",
      kycStatus: "VERIFIED",
      kycVerifiedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      subscriptionStatus: "ACTIVE",
      subscriptionAmount: 140,
      subscriptionCurrency: "ZAR",
      paymentMethod: "BANK",
      monthlyEarnings: 3450,
      nfcTagId: "NFC-KSH-000001",
      visaCardLast4: "4821",
      rootsBankAccount: "63212306319",
    },
  });

  // Place demo member at root of matrix (nodeIndex 0, level 0)
  const demoNode = await db.matrixNode.create({
    data: {
      memberId: demoMember.id,
      parentId: null,
      level: 0,
      position: 0,
      nodeIndex: 0,
      sponsorId: null,
    },
  });

  // 4. Build out the 5x6 matrix with demo members using a PROPER forced-matrix fill:
  //    Each node gets exactly 5 children (left-to-right), then is dequeued.
  //    This fills top-left to bottom-right exactly as the spec describes.
  const allMembers = [demoMember];
  const allNodes = [demoNode]; // queue of nodes that still have open child slots
  const TOTAL_DEMO_MEMBERS = 118;
  let nodeIndex = 1;
  let createdCount = 0;

  while (createdCount < TOTAL_DEMO_MEMBERS && allNodes.length > 0) {
    // The front of the queue is the next parent to fill
    const parentNode = allNodes[0];
    const parentLevel = parentNode.level;

    // Create up to 5 children for this parent (or until we hit the cap or level 6)
    if (parentLevel >= 6) {
      allNodes.shift();
      continue;
    }

    for (let pos = 0; pos < 5 && createdCount < TOTAL_DEMO_MEMBERS; pos++) {
      // Sponsor: cycle through existing members to simulate direct recruitment + spillover
      const sponsor = allMembers[(createdCount * 7) % allMembers.length];

      const fn = rand(FIRST_NAMES);
      const ln = rand(LAST_NAMES);
      const membershipType = Math.random() > 0.85 ? "COMPANY" : Math.random() > 0.9 ? "INDIVIDUAL_KIDS" : "INDIVIDUAL_ADULT";

      const newMember = await db.member.create({
        data: {
          profileNumber: `KSH-${String(createdCount + 2).padStart(6, "0")}`,
          membershipType,
          firstName: membershipType === "COMPANY" ? null : fn,
          lastName: membershipType === "COMPANY" ? null : ln,
          companyName: membershipType === "COMPANY" ? `${ln} Trading Enterprises` : null,
          companyRegNo: membershipType === "COMPANY" ? `2018/${Math.floor(Math.random() * 900000 + 100000)}/07` : null,
          idPassport: membershipType === "COMPANY" ? null : `${String(Math.floor(Math.random() * 9000000000000 + 1000000000000))}`,
          sarsNumber: membershipType === "COMPANY" ? null : `${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
          email: `${fn.toLowerCase()}.${ln.toLowerCase()}${createdCount}@kasihub.co.za`,
          country: rand(COUNTRIES),
          mobile: `+27 ${Math.floor(Math.random() * 80 + 70)} ${Math.floor(Math.random() * 900 + 100)} ${Math.floor(Math.random() * 9000 + 1000)}`,
          addressLine: `${Math.floor(Math.random() * 9000 + 100)} ${rand(["Pela", "Mahlangu", "Dlamini", "Khumalo"])} Street`,
          city: rand(CITIES),
          postalCode: String(Math.floor(Math.random() * 9000 + 1000)),
          beneficiaryName: `${rand(FIRST_NAMES)} ${ln}`,
          beneficiaryId: String(Math.floor(Math.random() * 9000000000000 + 1000000000000)),
          guardianName: membershipType === "INDIVIDUAL_KIDS" ? `${rand(FIRST_NAMES)} ${ln}` : null,
          kycStatus: Math.random() > 0.2 ? "VERIFIED" : "PENDING",
          kycVerifiedAt: Math.random() > 0.2 ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) : null,
          subscriptionStatus: Math.random() > 0.1 ? "ACTIVE" : "LAPSED",
          subscriptionAmount: membershipType === "COMPANY" ? 300 : 140,
          subscriptionCurrency: "ZAR",
          paymentMethod: rand(["BANK", "CARD", "EFT"]),
          monthlyEarnings: randFloat(0, 6500),
        },
      });

      allMembers.push(newMember);

      const newNode = await db.matrixNode.create({
        data: {
          memberId: newMember.id,
          parentId: parentNode.id, // <-- node ID, not member ID
          level: parentLevel + 1,
          position: pos,
          nodeIndex: nodeIndex++,
          sponsorId: sponsor.id,
        },
      });
      allNodes.push(newNode);
      createdCount++;
    }

    // This parent is now full (5 children) — dequeue it
    allNodes.shift();
  }

  console.log(`  ✓ Created ${allMembers.length} members with matrix nodes (proper forced 5×6 fill)`);

  // 5. Shares for demo member + some others
  // Demo member has 20 shares from phase 1
  await db.share.create({
    data: {
      memberId: demoMember.id,
      phase: 1,
      pricePerShare: 25,
      quantity: 20,
      totalAmount: 500,
      certificateNo: "KSH-CERT-2025-000001",
    },
  });

  // Random shares for other members
  for (let i = 0; i < 40; i++) {
    const m = rand(allMembers.slice(1));
    const qty = Math.floor(Math.random() * 50 + 5);
    await db.share.create({
      data: {
        memberId: m.id,
        phase: 1,
        pricePerShare: 25,
        quantity: qty,
        totalAmount: qty * 25,
        certificateNo: `KSH-CERT-2025-${String(i + 2).padStart(6, "0")}`,
      },
    });
  }

  // 6. Roots Bank pioneer shares - demo member + 47 others (out of 200)
  await db.rootsBankShare.create({
    data: {
      memberId: demoMember.id,
      category: "ADULT",
      sharePrice: 500,
      membershipFee: 200,
      totalAmount: 700,
      paymentRef: "RBS-2025-0001",
      pioneerPool: true,
      status: "REGISTERED",
    },
  });

  for (let i = 0; i < 46; i++) {
    const m = rand(allMembers.slice(1));
    const cat = rand(["KIDS_STUDENT", "ADULT", "PENSIONER"]);
    const fee = cat === "ADULT" ? 200 : 50;
    await db.rootsBankShare.create({
      data: {
        memberId: m.id,
        category: cat,
        sharePrice: 500,
        membershipFee: fee,
        totalAmount: 500 + fee,
        paymentRef: `RBS-2025-${String(i + 2).padStart(4, "0")}`,
        pioneerPool: true,
        status: "REGISTERED",
      },
    });
  }
  console.log(`  ✓ Created Roots Bank pioneer shares (47 of 200)`);

  // 7. Subscriptions - last 3 months for demo member
  const months = ["2025-04", "2025-05", "2025-06"];
  for (const period of months) {
    await db.subscription.create({
      data: {
        memberId: demoMember.id,
        amount: 140,
        currency: "ZAR",
        method: "BANK",
        status: "PAID",
        period,
      },
    });
  }

  // 8. KasiPool distributions for demo member (last 14 days)
  for (let i = 0; i < 14; i++) {
    const amount = randFloat(20, 95);
    await db.kasiPoolDistribution.create({
      data: {
        memberId: demoMember.id,
        amount,
        source: rand(["MARKETPLACE", "MALL", "SUBSCRIPTION_DIFF"]),
        payoutDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        status: "PAID",
      },
    });
  }

  // 9. Transactions for demo member
  const txTypes = [
    { type: "SUBSCRIPTION", amount: -140, description: "Monthly subscription - June 2025" },
    { type: "MATRIX_PAYOUT", amount: 47, description: "Level 1 matrix commission (5 directs)" },
    { type: "MATRIX_PAYOUT", amount: 235, description: "Level 2 matrix commission (25 members)" },
    { type: "POOL_PAYOUT", amount: 67.5, description: "KasiPool nightly payout" },
    { type: "POOL_PAYOUT", amount: 82.3, description: "KasiPool nightly payout" },
    { type: "DAILY_SHARE", amount: 38.2, description: "Daily share - KasiMall profits" },
    { type: "DAILY_SHARE", amount: 41.7, description: "Daily share - KasiMall profits" },
    { type: "SHARE_PURCHASE", amount: -500, description: "20 x KasiShares Phase 1 ($25 each)" },
    { type: "PIONEER", amount: 125.4, description: "1% PioneerPool distribution" },
    { type: "MARKETPLACE", amount: -50, description: "Airtime Bundle - MTN" },
    { type: "MARKETPLACE", amount: -200, description: "Prepaid Electricity" },
  ];
  for (const tx of txTypes) {
    await db.transaction.create({
      data: {
        memberId: demoMember.id,
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        status: "COMPLETED",
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // 10. Mall transactions (recent, linked to demo NFC tag)
  for (let i = 0; i < 8; i++) {
    const amount = randFloat(45, 380);
    const costOfSale = amount * 0.65;
    const vat = amount * 0.15;
    const sharePool = amount * 0.10;
    const kasiPool = amount * 0.10;
    await db.mallTransaction.create({
      data: {
        nfcTagId: "NFC-KSH-000001",
        storeName: rand(MALL_STORES),
        amount,
        costOfSale,
        vat,
        sharePool,
        kasiPool,
        status: "COMPLETED",
        createdAt: new Date(Date.now() - i * 18 * 60 * 60 * 1000),
      },
    });
  }

  // 11. Marketplace orders for demo member
  for (let i = 0; i < 5; i++) {
    const p = rand(MARKETPLACE_PRODUCTS);
    await db.marketplaceOrder.create({
      data: {
        memberId: demoMember.id,
        productId: `seed-${i}`,
        productName: p.name,
        amount: p.price,
        commission: p.price * p.commissionPct / 100,
        status: "COMPLETED",
        createdAt: new Date(Date.now() - i * 3 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // 12. Admin member (JP - Exco / platform administrator)
  const adminMember = await db.member.create({
    data: {
      profileNumber: "KSH-ADMIN-001",
      membershipType: "INDIVIDUAL_ADULT",
      firstName: "JP",
      lastName: "Administrator",
      idPassport: "7001015000091",
      sarsNumber: "1234567890",
      email: "admin@kasihub.co.za",
      country: "South Africa",
      mobile: "+27 83 000 0000",
      addressLine: "1 Solidus Way",
      city: "Johannesburg",
      postalCode: "2000",
      beneficiaryName: "Admin Beneficiary",
      beneficiaryId: "8001010000001",
      kycStatus: "VERIFIED",
      kycVerifiedAt: new Date(),
      subscriptionStatus: "ACTIVE",
      subscriptionAmount: 140,
      subscriptionCurrency: "ZAR",
      paymentMethod: "BANK",
      monthlyEarnings: 0,
      isAdmin: true,
    },
  });
  // Place admin in matrix too (nodeIndex after all demo members)
  await db.matrixNode.create({
    data: {
      memberId: adminMember.id,
      parentId: null,
      level: 0,
      position: 1,
      nodeIndex: 999,
      sponsorId: null,
    },
  });

  // 13. Dividend declarations (past 3 months)
  for (let i = 0; i < 3; i++) {
    const totalShares = 18420 + i * 200;
    const amount = 50000 + i * 12000;
    await db.dividendDeclaration.create({
      data: {
        amount,
        totalShares,
        perShareAmount: parseFloat((amount / totalShares).toFixed(4)),
        status: "PAID",
        declaredAt: new Date(Date.now() - (3 - i) * 30 * 24 * 60 * 60 * 1000),
        paidAt: new Date(Date.now() - (3 - i) * 30 * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log(`  ✓ Created admin member (JP), silo config, settings, dividend declarations`);
  console.log(`  ✓ Created shares, subscriptions, transactions, mall transactions, marketplace orders`);
  console.log(`\n✅ Seed complete!`);
  console.log(`   Demo member: ${demoMember.email} (Profile: ${demoMember.profileNumber})`);
  console.log(`   Admin member: ${adminMember.email} (Profile: ${adminMember.profileNumber})`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
