import {createRequire} from "module";
import {fileURLToPath} from 'url';

const require = createRequire(import.meta.url);

const puppeteer = require('puppeteer');
const fs = require("fs");
const os = require('os');
const path = require('path');
const open = require('open');
import clipboardy from 'clipboardy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
require('dotenv').config({path: path.join(__dirname, '.env')});

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

    try {
        await page.goto(process.env.URL);

        await page.waitForSelector("#username-input", {timeout: 5000});
        await page.keyboard.type(process.env.USERNAME);
        await page.click("#username-submit-button");

        await page.waitForSelector("#password-input", {timeout: 5000});
        await page.keyboard.type(process.env.PASSWORD);
        await page.click("#password-submit-button");

        const captcha_or_mfa = await page.waitForSelector("#captcha-input, div[data-testid='vmfa-authentication']", {timeout: 5000});

        // Need to check here for id="captcha-input" because if it exists,
        // we need to display the image at div with data-testid="test-captcha" (get the src attribute)
        // allow for user input of the captcha

        await page.waitForSelector("div[data-testid='vmfa-authentication']");
        await page.keyboard.type(mfa);
        await page.click("button[type='submit']");

        await page.waitForNavigation({timeout: 3000}); // Wait MFA navigation

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
    } catch (e) {
        console.error(e);
        console.log('\nUnrecoverable Error. Displaying screenshot...')
        await page.screenshot({path: "./error_screenshot.png"});
        await open('error_screenshot.png');
        process.exit(1);
    }

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
