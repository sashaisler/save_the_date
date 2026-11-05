# Sasha & Eytan — save the date

The website lives in `dist/`. It is a static page with no install or build step. All personal settings are in `dist/config.js`.

## Layout and motion

The invitation is one normal-flow view containing Save the date, Sasha & Eytan, the watercolor portrait, Sunday June 20, 2027 at 4:30 PM, Woodbury Jewish Center, and the calendar and directions links. It is followed by one complete guest form. There is no pinned scrolling sequence, chapter switching, progress bar, or Next/Back navigation.

The background is `dist/assets/woodland-invitation.webp`, with no table or furniture. Butterfly and petal SVGs, paths, timings, and phone/reduced-motion behavior are preserved from the checkpoint. Four butterflies and three petals appear on phones; desktop has five butterflies and six petals. Their areas stay separate and petals fall downward, restarting offscreen. Two lightweight botanical sprigs in `dist/assets/hanging-vine.svg` sway slowly around their stems. Reduce Motion stops the vine sway while preserving the expressly requested butterfly and petal movement.

`dist/story.js` only pauses decoration while the invitation is offscreen or the tab is hidden. It never changes page content in response to scrolling. `dist/app.js` handles the calendar, optional title field, and existing response delivery.

All three form groups—name, mailing address, and attendance—are visible together. Desktop uses two columns for name and address, with attendance underneath; phones use one column. Native form validation checks every required field. Labels are 14px, inputs 17px, and answer choices/submit text 15px. Title choices remain Mr., Mrs., Ms., Rabbi, Dr., and Other; Other reveals a required custom title. Existing submission names and the Google Sheet contract are unchanged, including title in column M and email in column N.

## Photos and event details

The invitation uses `dist/assets/sasha-eytan-waterfront.webp`, the transparent watercolor portrait based on the nighttime waterfront photo. Its image and alt text are in `dist/index.html`. Names, venue, time, calendar start, registry URL and response endpoint are in `dist/config.js`. The old optional chapter photo slots are unused by the combined layout.

The calendar starts at 4:30 PM New York time on June 20, 2027; `calendarStart` includes the UTC offset. Set `registryUrl` when available; it must start with `https://`.

The earlier scrolling version is preserved by the Git tag `checkpoint-2026-11-05` on GitHub.

## Response connection

Configured response sheet: [Save The Date Responses](https://docs.google.com/spreadsheets/d/1vFlW31srW1Y-NUID5nPAWbvNnkK2LUttqqhWI_r7h5g/edit).

The [Apps Script project](https://script.google.com/u/0/home/projects/1s5fZiPWO6Rsj7uxHRRLB6IegDscR3fqCi42ZNXReSsQU8vd7rKYQmWeV/edit) contains the response handler. Its active deployment is version 9, executed as `eytan.sasha.abramowitz@gmail.com`; the endpoint is set in `dist/config.js`. The earlier endpoint uses version 8 and queues responses for the wedding account rather than sending from the previous account. The sheet ID and website origin are already configured in `google-sheets/Code.gs`; Script Properties are optional overrides. The wedding email account has Editor access so its deployment can save responses. General sheet access is Restricted to named collaborators.

Keep the spreadsheet private. The endpoint only accepts submissions; it does not expose guest rows. To disable collection, remove the Apps Script deployment and clear `sheetsEndpoint` in the website configuration.

## Guest confirmation emails

New saved responses receive a confirmation at their submitted Email Address, with all answers and the wedding date/location. The template uses Columbia blue and has both HTML and plain-text versions. Sending uses `eytan.sasha.abramowitz@gmail.com` via MailApp; no paid service is required. `confirmationSenderAllowed_` checks the effective execution account before sending, so old-account deployments can save and queue responses without sending from the previous address.

After saving this script, sign in as **eytan.sasha.abramowitz@gmail.com**, select **enableConfirmationEmails**, and click **Run**. Authorize Google's email-sending and trigger permissions. This enables immediate sending and one hourly retry trigger. Then update the existing web-app deployment to a new version. This owner setup is required once, not for each guest.

The script appends **Confirmation email**, **Email sent at**, and **Email attempts** in columns O–Q. Existing responses keep blank tracking fields and are not emailed automatically. A saved response remains successful if email fails. Queued messages wait for quota; transient failures retry up to three times. A **Sending** status left after an interrupted execution requires owner review before retrying, to avoid duplicate emails. A **Sent** status means Google accepted the message for sending, not proof of inbox delivery. Guests may need to check spam.

Consumer Google accounts currently allow 100 email recipients per day through Apps Script; queued responses are checked hourly when quota is available. See [Google's quotas](https://developers.google.com/apps-script/guides/services/quotas) and [MailApp documentation](https://developers.google.com/apps-script/reference/mail/mail-app). To pause outgoing email without stopping response collection, set the Script Property `CONFIRMATION_EMAILS_ENABLED` to `false`. To change the authorized sender later, set `CONFIRMATION_SENDER_EMAIL` to the intended account, deploy while signed in to that account, and recreate its retry trigger. Remove the previous account's retry trigger after the handover.

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

Open `http://localhost:4173`. Reduced Motion keeps page movement still while the requested gentle butterfly and petal animations continue. The calendar download starts at 4:30 PM in New York on June 20, 2027 (20:30 UTC). No end time is specified because it has not been supplied.

## Hosting

The public GitHub Pages address is https://sashaisler.github.io/save_the_date/. The `Deploy wedding website` GitHub Actions workflow publishes only `dist/` when website files change on `main`. In repository Settings → Pages, the publishing source must be **GitHub Actions**. Publishing the repository root directly will fail because the entry page is `dist/index.html`.

The original Sites deployment is private to you. Google Sheets acknowledgements support both the Sites origin and `https://sashaisler.github.io`; each form includes its current origin and the script validates it against these configured addresses. When adding another host, configure its exact HTTPS origin in the script. Your own domain is optional.
