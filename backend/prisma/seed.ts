import { PrismaClient, VoucherStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database…");

  // ─── Cards ─────────────────────────────────────────────
  const cards = await prisma.card.createMany({
    data: [
      { accountOwner: "Rushabh Shah", cardName: "HDFC Millennia",       bank: "HDFC Bank",     lastFourDigits: "4532", email: "rushabh@example.com", mobileNumber: "9876543210" },
      { accountOwner: "Rushabh Shah", cardName: "ICICI Amazon Pay",      bank: "ICICI Bank",    lastFourDigits: "7891", email: "rushabh@example.com", mobileNumber: "9876543210" },
      { accountOwner: "Rushabh Shah", cardName: "Axis Flipkart",         bank: "Axis Bank",     lastFourDigits: "2345", email: "rushabh@example.com", mobileNumber: "9876543210" },
      { accountOwner: "Rushabh Shah", cardName: "RuPay Select Debit",    bank: "SBI",           lastFourDigits: "6789", email: "rushabh@example.com", mobileNumber: "9876543210" },
      { accountOwner: "Rushabh Shah", cardName: "IndusInd Platinum",     bank: "IndusInd Bank", lastFourDigits: "1234", email: "rushabh@example.com", mobileNumber: "9876543210" },
    ],
  });
  console.log(`  ✅ Created ${cards.count} cards`);

  // ─── Vouchers ──────────────────────────────────────────
  const now = new Date();
  const dAgo = (n: number) => new Date(+now - n * 86400000);
  const dFwd = (n: number) => new Date(+now + n * 86400000);

  const vouchers: Array<{
    title: string; voucherCode: string; brand: string;
    sourceProgramOrCard: string; description: string; voucherType: string;
    value?: number; expiryDate?: Date; issueDate: Date; dateAdded: Date;
    status: VoucherStatus; redeemedAt?: Date; emailId: string;
  }> = [
    { title:"Amazon Gift Voucher",       voucherCode:"AMZN-HDFC-Q1-2025",    brand:"Amazon",      sourceProgramOrCard:"HDFC Millennia",    description:"Q1 2025 RuPay quarterly benefit",            voucherType:"Gift Card",       value:500,  expiryDate:dFwd(90),  issueDate:dAgo(120), dateAdded:dAgo(120), status:"UNREDEEMED", emailId:"rushabh@example.com" },
    { title:"Swiggy Food Credit",        voucherCode:"SWGY-INDUS-JAN25",      brand:"Swiggy",      sourceProgramOrCard:"IndusInd Platinum",  description:"Food delivery credit — Q4 offer",            voucherType:"Discount Code",   value:200,  expiryDate:dFwd(60),  issueDate:dAgo(110), dateAdded:dAgo(110), status:"UNREDEEMED", emailId:"rushabh@example.com" },
    { title:"BookMyShow Movie Ticket",   voucherCode:"BMS-RUPAY-Q4-2024",     brand:"BookMyShow",  sourceProgramOrCard:"RuPay Select",       description:"Q4 2024 RuPay movie voucher",                voucherType:"Movie Voucher",   value:150,  expiryDate:dFwd(30),  issueDate:dAgo(200), dateAdded:dAgo(200), status:"REDEEMED",   redeemedAt:dAgo(50), emailId:"rushabh@example.com" },
    { title:"Myntra Fashion Voucher",    voucherCode:"MNTR-AXIS-FEB25",       brand:"Myntra",      sourceProgramOrCard:"Axis Flipkart",      description:"Fashion shopping credit",                    voucherType:"Shopping Voucher",value:300,  expiryDate:dFwd(45),  issueDate:dAgo(95),  dateAdded:dAgo(95),  status:"UNREDEEMED", emailId:"rushabh@example.com" },
    { title:"Zomato Dining Offer",       voucherCode:"ZMT-SBI-Q1-25",         brand:"Zomato",      sourceProgramOrCard:"SBI SimplyCLICK",    description:"Q1 2025 dining benefit — expired",           voucherType:"Dining Voucher",  value:100,  expiryDate:dAgo(10),  issueDate:dAgo(180), dateAdded:dAgo(180), status:"UNREDEEMED", emailId:"rushabh@example.com" },
    { title:"Nykaa Beauty Voucher",      voucherCode:"NYK-ICICI-Q1-25",       brand:"Nykaa",       sourceProgramOrCard:"ICICI Amazon Pay",   description:"Beauty credit — ICICI offer",                voucherType:"Shopping Voucher",value:250,  expiryDate:dFwd(75),  issueDate:dAgo(80),  dateAdded:dAgo(80),  status:"UNREDEEMED", emailId:"rushabh@example.com" },
    { title:"Flipkart SuperCoins",       voucherCode:"FK-KOTAK-MAR25",        brand:"Flipkart",    sourceProgramOrCard:"Kotak 811",          description:"Kotak milestone reward",                     voucherType:"Gift Card",       value:400,  expiryDate:dFwd(120), issueDate:dAgo(60),  dateAdded:dAgo(60),  status:"UNREDEEMED", emailId:"rushabh@example.com" },
    { title:"MakeMyTrip Travel Credit",  voucherCode:"MMT-HDFC-PREMIUM-2025", brand:"MakeMyTrip",  sourceProgramOrCard:"HDFC Diners Black",  description:"Annual card travel benefit",                 voucherType:"Travel Voucher",  value:1000, expiryDate:dFwd(180), issueDate:dAgo(45),  dateAdded:dAgo(45),  status:"UNREDEEMED", emailId:"rushabh@example.com" },
    { title:"Amazon Q2 Voucher",         voucherCode:"AMZN-HDFC-Q2-2025",     brand:"Amazon",      sourceProgramOrCard:"HDFC Millennia",    description:"Q2 2025 RuPay quarterly benefit",            voucherType:"Gift Card",       value:500,  expiryDate:dFwd(75),  issueDate:dAgo(30),  dateAdded:dAgo(30),  status:"UNREDEEMED", emailId:"rushabh@example.com" },
    { title:"Swiggy One Subscription",   voucherCode:"SWGY-AXIS-SUB-25",      brand:"Swiggy",      sourceProgramOrCard:"Axis Flipkart",      description:"3-month Swiggy One subscription",            voucherType:"Subscription",    value:299,  expiryDate:dFwd(20),  issueDate:dAgo(15),  dateAdded:dAgo(15),  status:"UNREDEEMED", emailId:"rushabh@example.com" },
    { title:"BookMyShow Voucher Q1",     voucherCode:"BMS-ICICI-Q1-25",       brand:"BookMyShow",  sourceProgramOrCard:"ICICI Amazon Pay",   description:"ICICI Q1 movie benefit",                     voucherType:"Movie Voucher",   value:200,  expiryDate:dFwd(10),  issueDate:dAgo(25),  dateAdded:dAgo(25),  status:"REDEEMED",   redeemedAt:dAgo(5), emailId:"rushabh@example.com" },
    { title:"Tata Neu Reward",           voucherCode:"TATA-HDFC-JAN25",       brand:"Tata Neu",    sourceProgramOrCard:"HDFC Millennia",    description:"NeuCoins cashback redemption",               voucherType:"Cashback",        value:150,  expiryDate:dFwd(50),  issueDate:dAgo(55),  dateAdded:dAgo(55),  status:"UNREDEEMED", emailId:"rushabh@example.com" },
  ];

  for (const v of vouchers) {
    await prisma.voucher.create({ data: v });
  }
  console.log(`  ✅ Created ${vouchers.length} vouchers`);

  // ─── Autocomplete entries ──────────────────────────────
  const autoEntries = [
    // banks
    ...["HDFC Bank","ICICI Bank","Axis Bank","SBI","IndusInd Bank","Kotak Mahindra Bank","Yes Bank","IDFC First Bank","AU Small Finance Bank","Federal Bank"].map(v => ({ field:"bank", value:v })),
    // accountOwners
    ...["Rushabh Shah"].map(v => ({ field:"accountOwner", value:v })),
    // emails
    ...["rushabh@example.com"].map(v => ({ field:"email", value:v })),
    // brands
    ...["Amazon","Myntra","Swiggy","Zomato","BookMyShow","Nykaa","Flipkart","BigBasket","Ola","Uber","MakeMyTrip","Yatra","AJIO","Tata Neu","Blinkit","Zepto","Lenskart","Pepperfry","Croma"].map(v => ({ field:"brand", value:v })),
    // sources
    ...["RuPay Select","RuPay Platinum","HDFC Millennia","HDFC Diners Black","HDFC Regalia","IndusInd Platinum","SBI SimplyCLICK","ICICI Amazon Pay","Axis Flipkart","Axis Magnus","Kotak 811","Yes Bank First Exclusive","IDFC First Select"].map(v => ({ field:"sourceProgramOrCard", value:v })),
    // voucherTypes
    ...["Gift Card","Discount Code","Cashback","Dining Voucher","Movie Voucher","Shopping Voucher","Travel Voucher","Subscription"].map(v => ({ field:"voucherType", value:v })),
  ];

  for (const e of autoEntries) {
    await prisma.autocompleteEntry.upsert({
      where: { field_value: { field: e.field, value: e.value } },
      update: { count: { increment: 1 } },
      create: { field: e.field, value: e.value },
    });
  }
  console.log(`  ✅ Created ${autoEntries.length} autocomplete entries`);

  console.log("\n🎉 Database seeded successfully!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
