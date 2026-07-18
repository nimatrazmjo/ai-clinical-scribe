# Demo Transcripts

Fictional transcripts and templates for testing the scribe pipeline. No PHI — all names and content are clearly fabricated.

---

## Demo Templates

Use these when seeding or manually creating templates via the admin UI.

### 1. Acute Urgent Care Visit

| Field           | Value                                              |
| --------------- | -------------------------------------------------- |
| `name`          | Acute Urgent Care Visit                            |
| `encounterType` | urgent_care                                        |

**`promptBody`:**

```
You are a clinical documentation assistant. Generate a structured SOAP note from the transcript below.

Context: This is an urgent care encounter. The patient presented with an acute complaint. Focus on:
- Subjective: chief complaint, onset, duration, severity (0–10), associated symptoms, medications, allergies
- Objective: vitals, relevant physical exam findings
- Assessment: primary diagnosis with ICD-10 code, differential if warranted
- Plan: medications prescribed (drug, dose, frequency), follow-up instructions, return precautions

Be concise and clinically precise. Do not fabricate findings not mentioned in the transcript.
```

### 2. Annual Wellness Visit

| Field           | Value                  |
| --------------- | ---------------------- |
| `name`          | Annual Wellness Visit  |
| `encounterType` | annual_wellness        |

**`promptBody`:**

```text
You are a clinical documentation assistant. Generate a structured SOAP note from the transcript below.

Context: This is an annual wellness visit. The patient has no acute complaint. Focus on:
- Subjective: interval history since last visit, current medications, allergies, social history (smoking, alcohol, activity level), family history updates, review of systems
- Objective: vitals, BMI, age-appropriate physical exam findings
- Assessment: chronic condition status (with ICD-10 codes), new findings, preventive care gaps
- Plan: labs ordered, screenings due (mammogram, colonoscopy, etc.), immunizations administered or recommended, lifestyle counseling, follow-up interval

Be concise and clinically precise. Do not fabricate findings not mentioned in the transcript.
```

---

## Demo Transcripts

### 1. Migraine with Aura

**Expected ICD-10:** G43.109 — Migraine with aura, not intractable, without status migranosus

```
Doctor: Good morning, how are you feeling today?

Patient: Not great, honestly. I've had this really bad headache for the past three days and it's not going away.

Doctor: I'm sorry to hear that. Can you describe the headache — where is the pain, and what does it feel like?

Patient: It's mostly on the right side of my head, kind of throbbing. I'd say the pain is about a seven out of ten. It gets worse when I'm in bright light or around loud noises.

Doctor: Are you experiencing any nausea or vomiting?

Patient: Yes, some nausea. I threw up once yesterday morning.

Doctor: Any vision changes? Aura before the headache starts?

Patient: Actually yes — about twenty minutes before it really hits, I see these zigzag lines in my vision for a bit, then they go away and the headache starts.

Doctor: How long do these headaches typically last?

Patient: Usually four to six hours. I've had similar ones before but not this frequently. This is my third one in the past two weeks.

Doctor: Any fever, neck stiffness, or sensitivity to touch on your scalp?

Patient: No fever that I know of. No neck stiffness. My scalp does feel a little tender on the right side.

Doctor: Are you on any medications currently?

Patient: Just ibuprofen when the headaches hit. I take 400 milligrams. It helps a little but not much. I also take a daily vitamin D supplement.

Doctor: Any known allergies?

Patient: Penicillin — I get hives.

Doctor: Any family history of migraines?

Patient: Yes, my mother has migraines.

Doctor: Okay. On exam today your vitals are normal — blood pressure 118 over 76, heart rate 72, afebrile. Neurological exam is grossly intact. No papilledema on fundoscopic exam.

Based on the pattern — unilateral throbbing pain, photophobia, phonophobia, nausea, visual aura, and family history — this looks consistent with migraine with aura.

I'd like to start you on sumatriptan 50 milligrams to take at onset. Avoid your known triggers — keep a headache diary so we can identify them. If the headaches increase in frequency we can discuss a preventive agent. Any questions?

Patient: No, that makes sense. Thank you.
```

### 2. Urgent Care — Acute Sinusitis

**Expected ICD-10:** J01.90 — Acute sinusitis, unspecified

```text
Doctor: Hi there, what brings you in today?

Patient: I've had this really bad facial pressure and congestion for about ten days now. It started as a regular cold but it keeps getting worse instead of better.

Doctor: Where exactly is the pressure — forehead, cheeks, around your eyes?

Patient: Mostly my cheeks and under my eyes. And my teeth on the upper left have been aching too, which is weird.

Doctor: Any fever?

Patient: I had a low-grade fever — around 99.8 — for the first few days. It broke about three days ago.

Doctor: Any nasal discharge? What color?

Patient: Yes, it's thick and yellow-green. Pretty constant.

Doctor: Any headache, vision changes, or neck stiffness?

Patient: Headache yes, but no vision changes or neck stiffness.

Doctor: Any history of sinus infections before?

Patient: Yeah, I get them maybe once a year, usually after a cold.

Doctor: Current medications or allergies?

Patient: No regular medications. I'm allergic to sulfa drugs — I got a rash the last time I took them.

Doctor: On exam today blood pressure is 124 over 80, heart rate 78, temperature 98.6, oxygen saturation 98% on room air. Facial tenderness to palpation over bilateral maxillary sinuses, left greater than right. Nasal mucosa is erythematous with purulent discharge. Oropharynx is clear. No lymphadenopathy.

Given the duration over ten days, purulent discharge, and maxillary tenderness, this is consistent with acute bacterial sinusitis. I'm going to prescribe amoxicillin-clavulanate 875/125 milligrams twice daily for ten days. Use saline nasal rinse twice a day. Ibuprofen or acetaminophen for pain as needed. If you're not improving in 48 to 72 hours or you develop high fever, severe headache, or vision changes, come back or go to the ER.

Patient: Okay, sounds good. Thank you.
```

### 3. Annual Wellness — Routine Adult Preventive Visit

**Expected ICD-10:** Z00.00 — Encounter for general adult medical examination without abnormal findings

```text
Doctor: Good afternoon. This is your annual wellness visit — no acute issues today, right?

Patient: That's right, I'm feeling pretty well overall. Just here for my yearly checkup.

Doctor: Great. Let's go through a few things. Any changes to your medical history since we last met? Any new diagnoses, hospitalizations, or surgeries?

Patient: No hospitalizations or surgeries. My doctor back home did diagnose me with pre-diabetes about six months ago. I've been trying to watch my diet since then.

Doctor: Good to know, we'll track that. Any changes to your medications?

Patient: I started taking metformin 500 milligrams once daily about four months ago for the pre-diabetes. Still taking lisinopril 10 milligrams daily for blood pressure. That's it.

Doctor: Allergies still the same — just seasonal pollen?

Patient: Yes, just seasonal allergies. No medication allergies.

Doctor: How about smoking, alcohol, exercise?

Patient: I quit smoking about two years ago, used to be half a pack a day. I drink maybe one or two glasses of wine on weekends. I walk about 30 minutes most days.

Doctor: Any family history updates?

Patient: My dad was recently diagnosed with colon cancer at age 68.

Doctor: That's important — we'll need to discuss colonoscopy timing given that. Any review of systems concerns? Sleep, mood, urinary symptoms, vision?

Patient: Sleep is okay. Mood is good. No urinary issues. I got new glasses last year, vision seems stable.

Doctor: On exam today: blood pressure 128 over 78, heart rate 66, weight 182 pounds, height 5 foot 9, BMI 26.9, temperature 98.4, oxygen saturation 99%. General appearance well-nourished, no acute distress. Cardiovascular regular rate and rhythm, no murmurs. Lungs clear to auscultation bilaterally. Abdomen soft, non-tender, no organomegaly. No lymphadenopathy. Skin without concerning lesions.

Labs I want to order today: HbA1c given the metformin, fasting lipid panel, comprehensive metabolic panel, and a CBC. You're due for a tetanus booster — we'll give that today. Given your father's colon cancer diagnosis at 68, I'd recommend starting colonoscopy screening now at age 48 rather than waiting until 50. I'll put in a referral. Any questions?

Patient: No, that all makes sense. I appreciate the thorough check.

Doctor: Great. We'll call you with the lab results in about three to five business days. See you next year.
```
