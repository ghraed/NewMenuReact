import { chromium } from '@playwright/test';

const url = 'https://rozer.pro/menu/table/2';
const unlockPin = '8309';
const prompt = 'what pizza do you have?';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/bin/google-chrome',
});
const page = await browser.newPage();

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);

  const pinInput = page.getByPlaceholder(/pin/i);
  if (await pinInput.count()) {
    await pinInput.fill(unlockPin);
    await page.getByRole('button', { name: /unlock|verify|continue|submit/i }).click();
    await page.waitForTimeout(3000);
  }

  await page.evaluate(() => {
    window.dispatchEvent(new Event('guest-chatbot:open'));
  });
  await page.waitForTimeout(1000);

  const chatInput = page.getByPlaceholder(/type your message/i);
  await chatInput.fill(prompt);
  await page.getByRole('button', { name: /^send$/i }).click();

  await page.waitForTimeout(4000);

  const messages = await page.locator('.rounded-2xl').evaluateAll((nodes) =>
    nodes.map((node) => node.textContent?.trim()).filter(Boolean)
  );

  console.log(JSON.stringify(messages, null, 2));
} finally {
  await browser.close();
}
