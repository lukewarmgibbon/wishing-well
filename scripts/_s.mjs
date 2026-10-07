import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, channel: "chromium", executablePath: process.env.CHROME_BIN });
const p = await b.newPage({ viewport: { width: 1100, height: 860 }, locale: "en-GB", timezoneId: "America/New_York" });
await p.goto("http://localhost:3000/demo/gifts", { waitUntil: "networkidle" });
await p.waitForTimeout(700);
await p.screenshot({ path: "/tmp/family-gifts.png" });
console.log("ok");
await b.close();
