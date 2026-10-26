# Sasha & Eytan — save the date

The website lives in `dist/`. It is a static page with no install or build step. All personal settings are in `dist/config.js`.

## Add your photos

1. Put your photos in `dist/assets/` (for example `hero.jpg`, `together.jpg`, and `little-moment.jpg`).
2. Set the three paths in `config.js`:

   ```js
   photos: {
     hero: 'assets/hero.jpg',
     together: 'assets/together.jpg',
     littleMoment: 'assets/little-moment.jpg'
   },
   ```

The tall hero photo uses an arch crop. Portrait photos work best there; the other spaces accept portrait or square photos. A missing image leaves the designed placeholder in place. You can also set `time` and `registryUrl` when they are available. Registry URLs must start with `https://`.

## Response connection

Configured response sheet: [Save The Date Responses](https://docs.google.com/spreadsheets/d/1vFlW31srW1Y-NUID5nPAWbvNnkK2LUttqqhWI_r7h5g/edit).

The [Apps Script project](https://script.google.com/u/0/home/projects/1s5fZiPWO6Rsj7uxHRRLB6IegDscR3fqCi42ZNXReSsQU8vd7rKYQmWeV/edit) contains the response handler. Its deployed endpoint is set in `dist/config.js`. The sheet ID and website origin are already configured in `google-sheets/Code.gs`; Script Properties are optional overrides.

Keep the spreadsheet private. The endpoint only accepts submissions; it does not expose guest rows. To disable collection, remove the Apps Script deployment and clear `sheetsEndpoint` in the website configuration.

## Connect a different Google Sheet

This setup uses a Google Apps Script web app attached to your own spreadsheet. No paid database service or API key is required. Your Google account's Apps Script limits apply. Until this setup is complete, the page clearly identifies itself as a preview and does not collect or save submissions.

1. Create a blank Google Sheet. Keep the spreadsheet private.
2. In the sheet, choose **Extensions → Apps Script**.
3. Replace the editor's contents with `google-sheets/Code.gs` from this project and save it.
4. In **Project Settings → Script Properties**, add:

   | Property | Value |
   | --- | --- |
   | `SPREADSHEET_ID` | The ID between `/d/` and `/edit` in your spreadsheet URL |
   | `SITE_ORIGIN` | `https://june-twenty-save-the-date-2027.islerd.chatgpt.site` |

   The origin has no trailing slash. If the page moves to a different host, change this property to its exact HTTPS origin.

5. Choose **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Authorize the script for your spreadsheet when Google asks. If your Google Workspace account does not offer “Anyone,” its administrator may restrict public Apps Script deployments; use an eligible personal account or ask the administrator.
6. Copy the deployed URL ending in `/exec`. Paste it into `sheetsEndpoint` in `dist/config.js`.
7. Republish the website. Preview mode will disappear when the endpoint is configured correctly.
8. Send one test response. Confirm that the page acknowledges it and a row appears in the sheet's **Guest responses** tab before sharing with guests. Delete your test row afterward if desired.

The sheet collects timestamp, response ID, names, partner name (if supplied), mailing address, and likely attendance. A partner's inclusion is for address collection and does not establish a plus-one invitation. The attendance question is an early indication; the page explains that an official RSVP follows later.

Successful delivery is confirmed by the script only after a row is saved. A failed request shows an error, and retrying the same request avoids duplicate rows. Guest addresses are never written to browser storage or displayed publicly. A honeypot reduces basic bot submissions, but a public form is not a spam-proof service.

After editing Apps Script, use **Deploy → Manage deployments → Edit → New version** to update the existing `/exec` URL.

Google's deployment reference: [Apps Script web apps](https://developers.google.com/apps-script/guides/web).

## Preview locally

From this directory:

```sh
python3 -m http.server 4173 --directory dist
```

Open `http://localhost:4173`. All motion respects the visitor's reduced-motion setting. The calendar download is an all-day hold on June 20, 2027 because the wedding time has not yet been supplied.

## Hosting

The public GitHub Pages address is https://sashaisler.github.io/save_the_date/. The `Deploy wedding website` GitHub Actions workflow publishes only `dist/` when website files change on `main`. In repository Settings → Pages, the publishing source must be **GitHub Actions**. Publishing the repository root directly will fail because the entry page is `dist/index.html`.

The original Sites deployment is private to you. Google Sheets acknowledgements support both the Sites origin and `https://sashaisler.github.io`; each form includes its current origin and the script validates it against these configured addresses. When adding another host, configure its exact HTTPS origin in the script. Your own domain is optional.
