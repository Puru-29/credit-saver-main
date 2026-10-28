const defaultTemplate = `{{receivingOfficeBlock}}{{authorityBlock}}Subject: Request for information

{{description}}

Applicant name and contact details: [Complete before use]

---
Draft prepared from user-provided text. This has not been submitted. Verify the receiving authority, applicable requirements, fees, and any response deadline independently.`;

export function getRtiApplicationTemplate() {
  const configured = process.env.RTI_APPLICATION_TEMPLATE?.replaceAll("\\n", "\n").trim();
  return configured || defaultTemplate;
}
