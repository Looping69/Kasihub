// ( |╲ ) — Author: Klaasvaakie
export const kasipayPages = {
  gini: {
    eyebrow: "KasiPay Gini",
    title: "Pay. Send. Save. Earn.",
    intro:
      "A free financial interface for everyday payments, contributions, disbursements and savings administration—built on InstaPay’s public platform information.",
    image: "/kasipay-assets/images/customer-app-landing-new.png",
    cards: [
      ["Digital onboarding", "Open and manage your profile through a simple digital process.", "/kasipay-assets/customer/digital-onboarding.svg"],
      ["Free application", "Use the application without a monthly app fee.", "/kasipay-assets/customer/free-application.svg"],
      ["High interest", "Eligible balances may earn returns through the underlying custodian or investment arrangement.", "/kasipay-assets/customer/high-interest.svg"],
      ["Simple terms", "Clear transaction records, contribution instructions and disbursement choices.", "/kasipay-assets/customer/simple-terms.svg"],
    ],
    sections: [
      {
        title: "Do more with your money",
        body: "Pay participating merchants, buy airtime and data, settle supported bills, purchase gift cards, transfer money and view transaction analytics from one interface.",
        bullets: ["Airtime and data", "Bill payments", "Gift cards", "Money transfers", "Cashback offers", "Transaction analytics"],
      },
      {
        title: "Save more, worry less",
        body: "Contributions are routed into an account held with a licensed custodian or nominee institution. KasiPay and InstaPay provide the interface; they do not hold or custody customer funds.",
        bullets: ["Your funds remain with the appointed custodian", "Settlement follows custodian rules and timelines", "You retain ownership of your underlying funds"],
      },
    ],
  },
  merchant: {
    eyebrow: "KasiPay Merchant",
    title: "Power up your business",
    intro:
      "Accept payments, manage sales, track inventory, sell value-added services and understand your cash flow from one merchant platform.",
    image: "/kasipay-assets/images/merchant_app_landing-new.png",
    cards: [
      ["Mobile application", "Manage your business and payments from the merchant app.", "/kasipay-assets/images/merchant-app-pop.png"],
      ["QR codes and links", "Request payment through shareable links and reusable QR codes.", "/kasipay-assets/images/merchant-portal-insights.png"],
      ["Online payments", "Use gateway, shopping-cart and API integration options.", "/kasipay-assets/images/plotform-images.png"],
      ["Card machines", "Choose device and point-of-sale options suited to your business.", "/kasipay-assets/merchant-accordion/merchant-image.png"],
    ],
    sections: [
      {
        title: "Run, grow and scale",
        body: "The merchant platform combines transaction history, business controls, payment requests, analytics, VAS sales, customer engagement and payout preferences.",
        bullets: ["In-store and online sales", "Single and bulk payment requests", "Transaction exports", "Internal authorisation controls", "Business analytics", "Value-added services"],
      },
      {
        title: "Ways to accept payment",
        body: "Supported public options include cards, Instant EFT, QR codes, payment links, Tap on Glass/NFC, integrated point of sale and e-commerce gateway connections.",
        bullets: ["Payment links", "Dynamic QR codes", "Tap to Pay", "Payment gateway", "WooCommerce integration", "API payment requests"],
      },
    ],
  },
  pricing: {
    eyebrow: "Transparent pricing",
    title: "Low fees. High value.",
    intro:
      "KasiPay follows InstaPay’s pay-as-you-use principle: no platform fantasy, just clear costs tied to the services and transactions you actually use.",
    image: "/kasipay-assets/images/merchant-portal-insights.png",
    cards: [
      ["Instant access", "Funds and transaction status are reflected through the platform subject to settlement rules.", "/kasipay-assets/pricing/instant-access.svg"],
      ["All-in-one account", "Manage payment methods and merchant tools in one place.", "/kasipay-assets/pricing/all-in-one-account.svg"],
      ["Track with ease", "Use a clear dashboard to inspect and export transactions.", "/kasipay-assets/pricing/Track-with-Ease.svg"],
      ["Flexible payouts", "Choose supported payout frequencies and destinations.", "/kasipay-assets/pricing/flexible-payouts.svg"],
    ],
    sections: [
      {
        title: "Pay only when you transact",
        body: "Public InstaPay material separates receiving-payment fees from making-payment fees and notes that quoted fees exclude VAT and may change. Final KasiPay fees will be published only after the commercial schedule is approved.",
        bullets: ["No invented fee figures", "VAT treatment shown where applicable", "Full schedule supplied before activation", "Provider changes reflected transparently"],
      },
      {
        title: "Merchant plans",
        body: "InstaPay publicly advertises merchant solutions from R299 monthly, alongside no-additional-cost QR acceptance and optional devices. KasiPay plan names, inclusions and exact fees remain subject to the signed custodian and merchant agreement.",
        bullets: ["QR payment acceptance", "Payment links", "Android Tap to Pay", "Optional payment devices"],
      },
    ],
  },
} as const;

export const giniJourney = [
  {
    eyebrow: "How Gini works",
    title: "An investment administration account—not a stored-value wallet",
    body: "Gini is described as a wallet for simplicity, but the public material defines it as an investment administration account managed through a licensed Category III Financial Services Provider. Funds are held in the customer’s name in segregated nominee accounts with South African banks.",
    image: "/kasipay-assets/customer/gini_mockup.png",
    bullets: ["Create an account in under five minutes", "Zero monthly application fee", "Eligible interest of up to 6%*", "Simple, transparent terms"],
  },
  {
    eyebrow: "Grow your money",
    title: "Save more. Worry less.",
    body: "The public Gini proposition offers interest designed to beat inflation on eligible positive balances. Returns, availability and settlement remain subject to the underlying product terms and custodian rules.",
    image: "/kasipay-assets/customer/blend.png",
    bullets: ["Positive-balance growth potential", "Funds remain with the appointed custodian", "No claim of guaranteed returns", "Product terms apply"],
  },
  {
    eyebrow: "Everyday rewards",
    title: "Get rewarded when you spend",
    body: "Use participating offers and merchant cashback programmes through the app. The available retailer list and qualifying rules are shown in the live Gini experience.",
    image: "/kasipay-assets/customer/spend-get-reward.png",
    bullets: ["Participating retailer cashback", "Exclusive merchant offers", "Personal offer discovery", "Transaction history and analytics"],
  },
  {
    eyebrow: "Lifestyle services",
    title: "Do more with your money",
    body: "The public service catalogue supports the daily essentials customers expect from a practical financial companion.",
    image: "/kasipay-assets/customer/key-future.png",
    bullets: ["Airtime and data from major networks", "Electricity and supported municipal bills", "Gift cards and digital vouchers", "Transfers to friends and family"],
  },
] as const;

export const merchantJourney = [
  {
    eyebrow: "Free merchant account",
    title: "Sign up in under five minutes",
    body: "Create the merchant iAccount, complete the required business and compliance checks, then use the app and portal to manage supported services.",
    image: "/kasipay-assets/merchant-accordion/merchant-image.png",
    bullets: ["Business onboarding", "KYC and account approval", "Mobile app and web portal", "Real-time transaction visibility"],
  },
  {
    eyebrow: "Mobile application",
    title: "Accept payments wherever business happens",
    body: "The merchant app turns an Android device into an operational payment tool with sales visibility, offers and secure transaction management.",
    image: "/kasipay-assets/merchant-accordion/play-free.png",
    bullets: ["Accept payments anywhere", "Track transactions", "Create instant offers", "Manage secure payment activity"],
  },
  {
    eyebrow: "Tap to Pay",
    title: "Turn an Android phone into a contactless card machine",
    body: "Accept supported contactless card payments from a compatible Android smartphone without a separate card machine or setup fee.",
    image: "/kasipay-assets/merchant-accordion/tap-to-pay.png",
    bullets: ["No extra payment hardware", "Contactless card acceptance", "Fast checkout", "Encrypted transaction processing"],
  },
  {
    eyebrow: "QR codes and payment links",
    title: "Get paid without hardware",
    body: "Create QR codes and share payment links from the merchant experience, giving customers a direct path to pay in person or remotely.",
    image: "/kasipay-assets/merchant-accordion/setup-qr.png",
    bullets: ["Reusable QR codes", "Shareable payment links", "Remote payment requests", "No card machine required"],
  },
  {
    eyebrow: "Online payments",
    title: "Accept payments on your website",
    body: "The InstaPay gateway supports online acceptance through WordPress and other integration paths. Availability and certification depend on the approved merchant configuration.",
    image: "/kasipay-assets/merchant-accordion/online-payment.png",
    bullets: ["WordPress/WooCommerce path", "Hosted or integrated checkout", "Multiple payment methods", "Merchant transaction reporting"],
  },
  {
    eyebrow: "Payment devices",
    title: "Choose the card machine that fits the floor",
    body: "InstaPay Plus is positioned as a portable device for smaller and mobile businesses. InstaPay Pro is aimed at higher-volume retail and restaurant environments with advanced point-of-sale capability.",
    image: "/kasipay-assets/merchant-accordion/get-card-machine.png",
    bullets: ["Dip, tap and swipe", "Portable Plus option", "High-volume Pro option", "Barcode and receipt capability on supported devices"],
  },
] as const;

export const faqGroups = [
  {
    title: "Gini and customer funds",
    items: [
      ["Does KasiPay hold my money?", "No. KasiPay/InstaPay is an interface. Customer funds are held by licensed custodians or nominee institutions under the applicable account arrangement."],
      ["How do I add funds?", "Supported contribution methods may include bank transfer, card and other approved methods. Funds are routed to the custodial account, not held by KasiPay."],
      ["Are transfers instant?", "The interface may update quickly, but actual movement and availability remain subject to the custodian’s rules, settlement times and third-party rails."],
      ["What can I buy?", "Publicly described services include merchant payments, airtime, data, electricity, supported bills, gift cards and transfers."],
    ],
  },
  {
    title: "Merchant services",
    items: [
      ["What is the merchant platform?", "A business-management and payment interface with transaction analytics, payment requests, internal controls, value-added services and customer engagement tools."],
      ["Which payment methods are supported?", "Public material describes EFT, QR codes, payment links, cards, Tap on Glass/NFC, cash-in/out partners and online gateway options. Availability depends on approval and configuration."],
      ["Can I export transactions?", "Yes. The public portal guidance describes Excel, CSV and PDF exports from transaction history."],
      ["Where do I get support?", "Use the contact page or email support@instapay.co.za for current InstaPay platform support while KasiPay support channels are being commissioned."],
    ],
  },
] as const;
