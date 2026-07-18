**Subject:** AI Clinical Scribe — Take-Home Submission (Kyron Medical)

Hi [Hiring Manager Name],

Thank you for the opportunity. My take-home submission for the AI Clinical Scribe challenge is ready for review.

**Live demo:** https://test.nimat.dev
**Repository:** https://github.com/nimatrazmjo/ai-clinical-scribe
**Documentation (README):** https://github.com/nimatrazmjo/ai-clinical-scribe/blob/main/README.md

The README is the best starting point — it covers the architecture, AI/LLM design, data model, how each rubric criterion is addressed, and an honest account of the current limitations and what I'd build next.

**Demo credentials**

- Provider — dr.alice@demo.clinic / DemoPass1!
- Admin — admin@demo.clinic / AdminPass1!

(Two additional provider logins — dr.bob@ / dr.carol@demo.clinic — are listed in the README if useful.)

A quick tour of the core workflow: sign in as a provider, open a patient encounter, paste a visit transcript, and watch the SOAP note stream in section-by-section with suggested ICD-10 codes. Two things worth trying — submitting empty or non-clinical input (the system refuses gracefully rather than fabricating a note), and generating for a returning patient (the model pulls prior history through a server-side tool call).

One note: the demo domain is temporary and will be taken down roughly one week from now. All data is clearly fictional — no real patient information is used anywhere.

Happy to walk through any architectural decision in a live session. Looking forward to your feedback.

Best regards,
[Your Name]
[Phone / LinkedIn]
