import { sendEmail } from "@/lib/email/send";
import { jobAdsSubscribedEmail } from "@/lib/email/templates/job-ads-subscribed";

// One-off: Riadh's original confirmation email incorrectly said "Top
// Employer" (the subscription's Price wasn't tagged with job_ad_slots yet
// at the time it was created — fixed 2026-10-25, see that day's commits).
// Sends the correct one now that the underlying data is fixed.
async function main() {
  await sendEmail(
    jobAdsSubscribedEmail({
      to: "riadh.chaabouni@itdsportugal.com",
      companyName: "ITDS PORTUGAL",
      slotCap: 200,
      billingInterval: "month",
      renewalDate: new Date("2026-11-25T20:18:57+00:00").toLocaleDateString("en-IE", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    }),
  );
  console.log("Sent.");
}

main();
