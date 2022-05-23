import { createRequire } from "module";
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);

const puppeteer = require('puppeteer');
const fs = require("fs");
const os = require('os');
const path = require('path');
import clipboardy from 'clipboardy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
require('dotenv').config({ path: path.join(__dirname, '.env') });

if (!process.env.URL || !process.env.USERNAME || !process.env.PASSWORD) {
    console.error('Fill in the .env file with your AWS Landing zone URL, USERNAME, and PASSWORD')
    process.exit(1);
}

let mfa;
const args = process.argv.slice(2);

if (args.length === 1) {
    mfa = args[0];
} else {
    mfa = clipboardy.readSync();
    if (mfa && mfa.length === 6 && mfa.match('[0-9]{6}')) {
        console.log('MFA acquired from clipboard: ' + mfa);
    } else {
        console.error("Requires one argument of the MFA code or MFA saved to clipboard.");
        process.exit(1);
    }
}

console.log('Setting AWS Credentials...');

(async () => {
    const browser = await puppeteer.launch();
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(process.env.URL.origin, ['clipboard-read'])

    const page = await browser.newPage();
    await page.goto(process.env.URL);

    await page.waitForSelector("#username-input");
    await page.keyboard.type(process.env.USERNAME);
    await page.click("#username-submit-button");

    await page.waitForSelector("#password-input");
    await page.keyboard.type(process.env.PASSWORD);
    await page.click("#password-submit-button");

    await page.waitForSelector("div[data-testid='vmfa-authentication']");
    await page.keyboard.type(mfa);
    await page.click("button[type='submit']");

    try {
        await page.waitForNavigation({timeout: 3000}); // Wait MFA navigation
    } catch (e) {
        console.error(e);
        console.error('\nError: Page failed to navigate after MFA input. Likely MFA code timed-out.')
        process.exit(1);
    }

    console.log('MFA Accepted')

    await page.waitForSelector("portal-application");
    await page.click("portal-application");

    await page.waitForSelector(".instance-block");
    await page.click(".instance-block");

    await page.waitForTimeout(2000);

    await page.waitForSelector("#temp-credentials-button");
    await page.click("#temp-credentials-button");

    await page.waitForTimeout(2000);

    await page.waitForSelector("#cli-cred-file-code");
    await page.click("#cli-cred-file-code"); // Copy creds to clipboard

    const rawCredsText = await page.evaluate(() => navigator.clipboard.readText());

    await browser.close();

    const credsLines = rawCredsText.split('\n')
    const accountName = credsLines[0].match(/\[(.*)]/)[1] // AWS-Account-Engineer

    // Replace the account name with default
    const credsText = ['[default]', ...credsLines.slice(1)].join('\n')

    fs.writeFileSync(path.join(os.homedir(), '.aws/credentials'), credsText, {flag: 'w'})
    console.log('Credentials file updated for account: ' + accountName)

    clipboardy.writeSync(''); // Clear clipboard
})();
