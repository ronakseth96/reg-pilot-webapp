import {test, expect, chromium} from '@playwright/test';
import data from "./SignData.json";

const path = require('path');

const { credWithInvalidRole, credWithInvalidSchema, cryptInvalidCred, credWithDifOrg, validCred } = data;
const credential = validCred.credential.raw.sad.a.i;
const lei = validCred.credential.raw.sad.a.LEI;

async function mockAuthCred(page: Page, credential) {
  await page.evaluate((data) => {
                      window.signifyClient.authorizeCred = async () => {
                        return data;
                      };
                    }, credential);
}

test.describe('Tests Extension installation', () => {
    //test.describe.configure({ mode: 'serial' })
    test('displays a message when the extension is not installed', async ({page}) => {
        await page.goto('/');

         // Locate the element with the data-testid attribute
        const titleElement = page.locator('[data-testid="webapp--title"]');
        await expect(page).toHaveTitle(await titleElement.textContent());

        // Check if the message "Extension is not installed" is visible
        await page.getByTestId("extension--not-installed-message").waitFor();

        // Check if the reload button is present and click it
        const reloadBtn = await page.getByTestId("webapp--reload");
        await expect(reloadBtn).toBeVisible();
        await reloadBtn.click;

        // ensuring the page is reloaded and the message still appears
        await page.waitForLoadState('load');
        await expect(page.getByTestId("extension--not-installed-message")).toBeVisible();
    });
});

test.describe('Customer portal', () => {
    test.describe.configure({ mode: 'serial' })
    let page: Page
    let context: BrowserContext
    test.beforeAll(async () => {
        const extensionPath = path.resolve('extension/chrome/');
        const userDataDir = path.resolve('user-data');

        // Launch the browser with the extension
        context = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            args: [
                `--disable-extensions-except=${extensionPath}`,
                `--load-extension=${extensionPath}`
            ]
        });
        page = await context.newPage();
    });

    test.afterAll(async () => {
        console.log('Tests have finished, cleaning up...');
        await context.close();
    })

test('Display customer portal when extension is installed', async ({}) => {

        await page.goto('/');
        await expect(page.getByTestId("webapp--header")).toBeVisible();

        await expect(page.getByTestId('login--configure--extn')).toBeVisible();
        await expect(page.getByTestId('login--select--cred')).toBeVisible();

     });

    test('User comes that does not have a valid wallet url/secret combination', async ({}) => {
        await page.goto('/');

        const selectCred = await page.getByTestId('login--select--cred');
        await selectCred.waitFor();
        await selectCred.click();

        // Selector for the loading spinner within the button
        const spinnerSelector = '[data-testid="login--progressbar"]';

        // Wait for the spinner to appear
        await page.waitForSelector(spinnerSelector, { state: 'visible' });

        // Check if the spinner is still present after some time
        await page.waitForSelector(spinnerSelector, { state: 'visible', timeout: 5000 }).catch(() => false);

        const menuBtn = await page.getByTestId("webapp--menu");
        await menuBtn.click()

        const liElement = await page.getByTestId("webapp--menu--Status");
        await liElement.click()

        await expect(page).toHaveURL(/.*\?from=status/);
    });

    test('User has a valid wallet url but does not have the "EBA Submitter" role', async ({}) => {
        await page.goto('/');

       // Expose the mocked function to the page context
       await mockAuthCred(page,credWithInvalidRole);

        const selectCred = await page.getByTestId('login--select--cred');
        await selectCred.waitFor();
        await selectCred.click();

        const alert = page.locator('[role="alert"]');
        await alert.waitFor();

        // Assert that the alert contains the error message
        await expect(alert).toContainText('status Credential unauthorized, info: Incorrect Role is not a valid submitter role');
    });

    test('User logins in with credential with Invalid schema', async ({}) => {
        await page.goto('/');
        const identifier = credWithInvalidSchema.credential.raw.sad.a.i;
        const cred = credWithInvalidSchema.credential.raw.sad.d;

       // Expose the mocked function to the page context
       await mockAuthCred(page,credWithInvalidSchema);

        const selectCred = await page.getByTestId('login--select--cred')
        await selectCred.waitFor();
        await selectCred.click();

        const alert = page.locator('[role="alert"]');
        await alert.waitFor();

        // Assert that the alert contains the error message
        await expect(alert).toContainText(`identifier ${identifier} presented credentials ${cred}, w/ status Credential unauthorized, info: Can't authorize cred with OOR schema`);
    });

    test('User logins in with cryptographically invalid credential', async ({}) => {
        await page.goto('/');
        const credential = cryptInvalidCred.credential.raw.sad.d;
        const cred = credWithInvalidSchema.credential.raw.sad.d;

       // Expose the mocked function to the page context
       await mockAuthCred(page,cryptInvalidCred);

        const selectCred = await page.getByTestId('login--select--cred')
        await selectCred.waitFor();
        await selectCred.click();

        const alert = page.locator('[role="alert"]');
        await alert.waitFor();

        // Assert that the alert contains the error message
        await expect(alert).toContainText(`credential ${credential} from body of request did not cryptographically verify`);
    });

    test('User has a valid wallet url, role and is from expected organization', async ({}) => {
        await page.goto('/');

        await mockAuthCred(page,validCred);

        const selectCred = await page.getByTestId('login--select--cred')
        await selectCred.waitFor();
        await selectCred.click();

        await page.locator(`text=AID ${credential} w/ lei ${lei} has valid login account`).waitFor();
        });
});
