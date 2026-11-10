# Business listing kit

Prepared 10 November 2026. One master record for every directory, map and profile, so the name, address and phone are **identical everywhere** (the single biggest rule for local listings). Copy from here; never retype. Where a field is marked **Needs you**, the repository does not have the information and nothing should be guessed.

## 1. Master record

| Field | Value | Status |
|---|---|---|
| Business name | Gradmire Education Pvt. Ltd. (brand: Gradmire) | Ready. Use exactly this. Do not add keywords such as "best" or "consultants" to the name |
| Website | https://www.gradmire.com | Ready |
| Email | info@gradmire.com | Ready |
| Phone | The Contact page shows +91 11 4567 8900, which looks like a placeholder. Do not use it | **Needs you** |
| WhatsApp | +91 85779 09702 (the number on the Contact page) | Ready |
| Office 1 | Kanpur: Near Halim College, Prem Nagar, Kanpur, Uttar Pradesh | **Needs you:** postcode, floor or unit, nearest landmark |
| Office 2 | Greater Noida: N2 Tower, Supertech Ecovillage 1, Greater Noida, Uttar Pradesh | **Needs you:** postcode, floor or unit, nearest landmark |
| Hours | Monday to Saturday, 9 AM to 7 PM IST (as on the Contact page) | Confirm per office. Only list hours when the office is staffed |
| Founded | 2026, in Noida | Ready |
| Founder | Aquib Jamal | Ready |
| Languages | English, Hindi | Ready |
| Services | Free counselling; course selection guidance; application assistance; scholarship guidance; student visa assistance; test preparation (IELTS, TOEFL, GRE, GMAT); MBBS abroad guidance | Ready |
| Areas served | India (online); in person at the two offices | Ready |
| Category | Look for "Educational consultant" or "Study abroad consultant" in the platform's own list and pick the closest. I could not confirm the exact names Google offers | Check on the platform |

## 2. Descriptions (character counts checked)

**Short (133 characters, limit 160):**
Free study-abroad counselling for students in India. Fee-only, no commissions from universities. Offices in Kanpur and Greater Noida.

**Medium (323 characters, limit 350):**
Gradmire is a study-abroad counselling company for students in India. We offer a free first consultation, fee-only counselling with no commissions from universities, and free planning tools. Our guides cover nine study destinations and nine MBBS countries. Offices in Kanpur and Greater Noida, and online anywhere in India.

**Long (721 characters, limit 750):**
Gradmire is a study-abroad counselling company for students in India, founded in 2026 in Noida by Aquib Jamal. The first consultation is free, with no obligation. Counselling is fee-only, with no commissions from universities, so the advice is built around the student. We help with course selection, university applications, scholarships, student visas, test preparation (IELTS, TOEFL, GRE, GMAT) and MBBS abroad. Our guides cover nine study destinations and nine MBBS countries and link to official sources. We also publish four free tools: a study cost calculator, a course comparator, a deadline tracker and a GPA, CGPA and SGPA converter. Offices in Kanpur and Greater Noida; consultations are also available online.

Every claim above is already stated on the site (About, Contact, the guides). Do not add rankings, "number one", student counts, university partnerships or awards unless they are true and can be shown.

## 3. Files to upload

| Use | File in the repository |
|---|---|
| Logo, light backgrounds | `frontend/assets/gradmire-logo.png` |
| Logo, dark backgrounds | `frontend/assets/gradmire-logo-white.png` |
| Logo, vector | `frontend/assets/gradmire_logo.svg` |
| Cover or share image (1200 × 630) | `frontend/assets/og-cover.jpg` |
| Founder portrait | `frontend/assets/team/aquib-jamal.webp` |
| **Office photos** | **Needs you.** Google asks for real photos of each office (outside and inside). None exist in the repository |

## 4. Platform notes

| Platform | Notes |
|---|---|
| [Google Business Profile](https://business.google.com/) | One profile per office, and only for an office that is staffed and can receive visitors during the listed hours. The address must be precise (no P.O. boxes or mail-forwarding addresses). Read [Google's guidelines](https://support.google.com/business/answer/3038177) first. Verification is done by Google (postcard, phone, video or e-mail) and cannot be done for you |
| [Bing Places](https://www.bingplaces.com/) | Import from Google once it is verified, then check every field matches this kit |
| [Apple Business Connect](https://businessconnect.apple.com/) | Same record |
| [Justdial free listing](https://www.justdial.com/Free-Listing) and Sulekha | Use the free tier only. Never pay for a ranking package. Expect a verification call, so use the real phone number |
| [LinkedIn company page](https://www.linkedin.com/company/setup/new/) | Use the Medium description. Add the page address to `scripts/social.mjs` afterwards |
| Instagram, Facebook, YouTube, X | Try to get the same handle on each, if it is free. Add each address to `scripts/social.mjs` once the account is live |
| [Indiastudychannel](https://www.indiastudychannel.com/business/category-1-study-abroad-consultants) and [Ternrise](https://ternrise.com/) | Use the master record and the Medium description. Check after listing whether the link is followed |
| [ICEF Agent Training Course](https://icef.com/agent-training/icef-agent-training-course-iatc) | Registration is free. It certifies an individual counsellor, so it works best once real counsellors are named on the site |

## 5. After a profile is live

1. Paste its address into `scripts/social.mjs` (the `url` of that network).
2. Run `node scripts/sync-footer.mjs`. That adds the icon to every footer and the phone menu, **and** adds the address to `sameAs` in the homepage structured data.
3. Tick it off in `docs/backlink-tracker.csv`.

For Search Console and Bing Webmaster Tools, paste each verification token into `scripts/site-verification.json` and run the same command, then press Verify in the tool.

## 6. Do not

- Do not list a branch that does not exist, or a virtual office.
- Do not use a different phone number, spelling or abbreviation on any listing.
- Do not post links in comments, buy listings or reviews, or write reviews of yourselves.
- Do not claim accreditation, membership or partnerships until they are earned and checkable.
