# Sasha & Eytan — save the date

The website lives in `dist/`. It is a static page with no install or build step. All personal settings are in `dist/config.js`.

## The scrolling story

The invitation uses a single pinned watercolor woodland scene, with no banquet table or furniture. The background asset is `dist/assets/woodland-invitation.webp`. Scrolling moves through four chapters: opening, names, date, and venue. Butterflies and petals use self-contained inline SVGs in a separate overlay so they stay visible on Safari. Four butterflies and three petals remain visible on phones, with five butterflies on desktop. Each butterfly stays within a separate area: upper left, upper right, lower left and lower right on phones, plus the outer left side on desktop. Their bounded paths keep them scattered throughout the animation. Butterflies take 34–44 seconds to follow wider rising and falling paths within their separate areas, clear of the central information. Their illustrations do not rotate or deform. The third original butterfly remains desktop-only near the left outer edge. Petals always fall downward from above the viewport to below it, with a sideways sway; they restart offscreen. Reduce Motion keeps slower flight paths and a slower downward petal fall. The progress indicator is an unframed 4px blue line split into four sections with a small dot that follows the scroll position; no pill, border, numbers or chevron. Three small gaps separate the sections, and a fine pale edge keeps it legible over the woodland. Both decorations animate with Reduce Motion on or off.

`dist/story.js` switches the active chapter using cached scene geometry. Each change runs an independent 850 ms CSS crossfade, so fast swipes and sparse scroll events cannot turn it into a hard cut. Reduced-motion preferences keep a shorter 450 ms opacity fade without movement. The opening has a noninteractive “Scroll down to continue” text hint. A single gently bobbing arrow stays below it and remains visible through all four story chapters, and a slim vertical progress line with a small moving dot stays along the right edge of the story. Phone/touch layouts keep the forest still and reduce decorative layers; animations pause when the story is offscreen. The form logic remains in `dist/app.js`.

The questions use 14 px labels, 17 px inputs, 15 px answer choices and submit text, and larger helper text for readability. The questions follow the story in three steps: optional title, names, the optional “Spouse or Fiance's Name (if applicable)” field, and required Email Address; mailing address; and likely attendance. Title choices are Mr., Mrs., Ms., Rabbi, Dr., and Other. Other reveals a required custom-title field. Next validates the current step; Back retains all values. The response script stores the selected or custom title in column M, headed “Title,” and the email in column N, headed “Email Address,” without shifting existing columns or guest responses. Spouse/fiance names continue to use the existing name column and submission fields; no checkbox is shown.

Original generated artwork and its prompt are documented in `design/ARTWORK.md`. Copy and Columbia-inspired styling preferences are documented in `design/STYLE.md`.

## Add your photos

The names chapter features `dist/assets/sasha-eytan-waterfront.webp`, a transparent watercolor portrait based on the couple's nighttime waterfront photo. Its image and descriptive alt text are set directly in `dist/index.html`.

1. Put any extra photos in `dist/assets/` (for example `together.jpg` and `little-moment.jpg`).
2. Set the two optional paths in `config.js`:

   ```js
   photos: {
     together: 'assets/together.jpg',
     littleMoment: 'assets/little-moment.jpg'
   },
   ```

The two optional photo slots are faded into the venue and opening chapters. Their paths are blank placeholders in the configuration; leaving them blank keeps the illustrated scene. Portrait or square photos work best. A missing image leaves the illustrated background in place. The wedding time is 4:30 PM New York time, shown in the date and venue chapters. `calendarStart` includes the New York UTC offset for the calendar download. Set `registryUrl` when it is available. Registry URLs must start with `https://`.

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
