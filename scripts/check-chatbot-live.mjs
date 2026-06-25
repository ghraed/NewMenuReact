import { chromium } from '@playwright/test';

const url = 'https://rozer.pro/menu/table/2';
const unlockPin = '8309';
const prompts = [
  'what pizza do you have?',
  'tell me about margherita pizza',
];

const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/bin/google-chrome',
});
const page = await browser.newPage();

const assistantMessages = () => page.locator('.justify-start .rounded-bl-md');

const waitForAssistantReply = async (previousCount) => {
  await page.waitForFunction((count) => {
    const nodes = document.querySelectorAll('.justify-start .rounded-bl-md');
    return nodes.length > count;
  }, previousCount, { timeout: 30000 });
  await page.waitForTimeout(1200);
};

const openChat = async () => {
  const input = page.getByPlaceholder('Type your message...');
  if (await input.count()) {
    return;
  }

  const quickActionsButton = page.getByLabel('Open quick actions');
  if (await quickActionsButton.count()) {
    await quickActionsButton.first().click({ force: true });
    await page.waitForTimeout(600);
  }

  const guestChatButton = page.getByLabel('Open BootChat');
  if (await guestChatButton.count()) {
    await guestChatButton.first().click({ force: true });
  } else {
    await page.evaluate(() => {
      window.dispatchEvent(new Event('guest-chatbot:open'));
    });
  }

  await input.waitFor({ state: 'visible', timeout: 30000 });
};

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});

  const pinInput = page.locator('input[inputmode="numeric"]').first();
  if (await pinInput.count()) {
    await pinInput.fill(unlockPin);
    await page.locator('form button[type="submit"]').first().click();
  }

  await page.waitForFunction(() => {
    return Boolean(document.querySelector('[aria-label="Open BootChat"]'))
      || Boolean(document.querySelector('input[placeholder="Type your message..."]'));
  }, { timeout: 30000 });

  await openChat();

  for (const prompt of prompts) {
    const previousCount = await assistantMessages().count();
    await page.getByPlaceholder('Type your message...').fill(prompt);
    await page.getByRole('button', { name: 'Send' }).click();
    await waitForAssistantReply(previousCount);
  }

  const messages = await assistantMessages().evaluateAll((nodes) => (
    nodes.map((node) => node.textContent?.trim()).filter(Boolean)
  ));

  console.log(JSON.stringify({ url, prompts, assistant_messages: messages }, null, 2));
} finally {
  await browser.close();
}
