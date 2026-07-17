export const FORMAT_INSTRUCTION = `

Format your response using XML section tags exactly as shown:
<subjective>patient complaints and history in their own words</subjective>
<objective>vital signs, examination findings, diagnostics</objective>
<assessment>{"text":"clinical assessment narrative","icd10":[{"code":"X00.0","description":"Condition description"}]}</assessment>
<plan>treatment plan, follow-up, prescriptions</plan>

The assessment tag must contain ONLY valid JSON with the exact shape shown.
Never output anything outside these four tags.`;
