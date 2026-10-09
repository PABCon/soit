import type { EmailMessage } from "../types";

export function savedSearchDigestEmail(params: {
  to: string;
  searchLabel: string;
  jobs: { title: string; companyName: string; url: string }[];
  searchUrl: string;
}): EmailMessage {
  const { to, searchLabel, jobs, searchUrl } = params;
  const jobWord = jobs.length === 1 ? "new job matches" : "new jobs match";

  const text = `${jobs.length} ${jobWord} your saved search "${searchLabel}":

${jobs.map((j) => `- ${j.title} at ${j.companyName}: ${j.url}`).join("\n")}

See the full search: ${searchUrl}

— Just IT`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #0C6B58;">${jobs.length} ${jobWord} "${searchLabel}"</h1>
      <ul style="padding-left: 20px;">
        ${jobs
          .map(
            (j) =>
              `<li style="margin-bottom: 8px;"><a href="${j.url}" style="color: #0C6B58;">${j.title}</a> at ${j.companyName}</li>`,
          )
          .join("")}
      </ul>
      <p><a href="${searchUrl}" style="color: #0C6B58;">See the full search</a></p>
      <p style="color: #5b6b66; font-size: 12px;">— Just IT</p>
    </div>
  `.trim();

  return { to, subject: `${jobs.length} ${jobWord} "${searchLabel}"`, html, text };
}
