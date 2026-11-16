import { describe, it, expect } from 'vitest';
import { ground, headlineOf, parseByRules, parseEducation, parseExperience, segmentRoles } from '@/lib/career/parse';
import { locationFromText } from '@/lib/career/suggest';

/** The text of three real-looking CVs as a PDF/Word extractor gives it: one entry per line and NO blank lines between jobs. */
const ADA = `Ada Obi
Frontend Developer
ada.obi@example.com | +234 801 234 5678 | Lagos, Nigeria
linkedin.com/in/ada-obi | github.com/adaobi
Professional Summary
Frontend developer with five years building React and TypeScript applications for fintech and e-commerce teams. Comfortable owning features end to end.
Experience
Senior Frontend Developer | Bright Labs
Jan 2022 - Present | Lagos, Nigeria
- Built a React dashboard used by 300 customers
- Cut page load time by 40% by code-splitting and caching
- Mentored 3 junior developers
Frontend Developer | Pixel House
Mar 2019 - Dec 2021
- Delivered 12 marketing sites in Next.js
- Introduced a shared component library
Education
BSc Computer Science
University of Lagos, 2018
Skills
React, TypeScript, Next.js, Node.js, CSS, Jest, Git
Certifications
- AWS Cloud Practitioner`;

const WANJIRU = `Wanjiru Kamau
Senior Accountant
wanjiru.kamau@example.com  •  +254 712 345 678  •  Nairobi, Kenya
PROFILE
ACCA-qualified accountant with eight years of experience in financial reporting, audit and budgeting for manufacturing and NGO clients.
WORK EXPERIENCE
Senior Accountant, Savannah Foods Ltd
April 2020 – Present
• Prepared monthly IFRS financial statements for a business with KES 2 billion revenue
• Reduced month-end close from 10 days to 5 days
• Led the annual external audit with zero material findings
Accountant, Green Hope Foundation
June 2016 – March 2020
• Managed donor reporting for 6 grants
• Implemented QuickBooks across 4 offices
EDUCATION
ACCA, Association of Chartered Certified Accountants, 2019
BCom Accounting, University of Nairobi, 2015
SKILLS
IFRS, Financial reporting, Audit, Budgeting, QuickBooks, SAP, Excel`;

const KWAME = `KWAME MENSAH
Registered Nurse (ICU)
Mobile: 0244 123 456   Email: kwame.mensah@example.com   Accra, Ghana
About Me
Compassionate ICU nurse with four years caring for critically ill adults. Calm under pressure and committed to patient safety.
Career History
Staff Nurse - Intensive Care Unit
Korle Bu Teaching Hospital  (2021 to date)
* Cared for ventilated patients in a 12-bed ICU
* Trained 5 new nurses on infusion pump safety
Staff Nurse - Medical Ward
Ridge Hospital  (2019 to 2021)
* Administered medication and monitored vital signs for 30 patients per shift
Qualifications
BSc Nursing - University of Ghana (2018)
Registered Nurse licence - Nursing and Midwifery Council of Ghana
Key Skills
Critical care, Patient assessment, Ventilator management, BLS, ACLS`;

describe('CV reader on text with NO blank lines between jobs', () => {
  it('Ada: both jobs, with title, company, dates, place and their own bullets', () => {
    const p = parseByRules(ADA);
    expect(p.experience.map((r) => [r.title, r.company, r.start, r.end])).toEqual([['Senior Frontend Developer', 'Bright Labs', 'Jan 2022', 'Present'], ['Frontend Developer', 'Pixel House', 'Mar 2019', 'Dec 2021']]);
    expect(p.experience[0].location).toBe('Lagos, Nigeria');
    expect(p.experience[0].bullets).toEqual(['Built a React dashboard used by 300 customers', 'Cut page load time by 40% by code-splitting and caching', 'Mentored 3 junior developers']);
    expect(p.experience[1].bullets).toEqual(['Delivered 12 marketing sites in Next.js', 'Introduced a shared component library']);          // not mixed into the first job
    expect(p.headline).toBe('Frontend Developer'); expect(p.location).toBe('Lagos, Nigeria'); expect(p.education).toEqual([{ qualification: 'BSc Computer Science', institution: 'University of Lagos', start: '', end: '2018' }]);
    expect(p.skills).toEqual(['React', 'TypeScript', 'Next.js', 'Node.js', 'CSS', 'Jest', 'Git']); expect(p.certifications).toEqual(['AWS Cloud Practitioner']);
  });
  it('Wanjiru: "Title, Company" jobs and two education entries on single lines', () => {
    const p = parseByRules(WANJIRU);
    expect(p.experience.map((r) => [r.title, r.company, r.start, r.end])).toEqual([['Senior Accountant', 'Savannah Foods Ltd', 'April 2020', 'Present'], ['Accountant', 'Green Hope Foundation', 'June 2016', 'March 2020']]);
    expect(p.experience.map((r) => r.bullets.length)).toEqual([3, 2]);
    expect(p.education).toEqual([{ qualification: 'ACCA', institution: 'Association of Chartered Certified Accountants', start: '', end: '2019' }, { qualification: 'BCom Accounting', institution: 'University of Nairobi', start: '', end: '2015' }]);
    expect(p.headline).toBe('Senior Accountant'); expect(p.location).toBe('Nairobi, Kenya');
  });
  it('Kwame: title on one line, hospital + "(2021 to date)" on the next; location with no separators; ALL CAPS name', () => {
    const p = parseByRules(KWAME);
    expect(p.name).toBe('Kwame Mensah'); expect(p.headline).toBe('Registered Nurse (ICU)'); expect(p.location).toBe('Accra, Ghana');
    expect(p.experience.map((r) => [r.title, r.company, r.start, r.end])).toEqual([['Staff Nurse - Intensive Care Unit', 'Korle Bu Teaching Hospital', '2021', 'Present'], ['Staff Nurse - Medical Ward', 'Ridge Hospital', '2019', '2021']]);
    expect(p.education.map((e) => [e.qualification, e.institution, e.end])).toEqual([['BSc Nursing', 'University of Ghana', '2018'], ['Registered Nurse licence', 'Nursing and Midwifery Council of Ghana', '']]);
  });
  it('everything the reader produced is still backed by the CV text (nothing invented)', () => { for (const cv of [ADA, WANJIRU, KWAME]) expect(ground(parseByRules(cv), cv).removed).toEqual([]); });
  it('still works when blank lines DO separate the jobs (Word documents)', () => {
    expect(parseExperience(['Senior Accountant, Savannah Foods Ltd', 'April 2020 – Present', '• a thing done well', '', 'Accountant, Green Hope Foundation', 'June 2016 – March 2020', '• another thing done'])).toHaveLength(2);
  });
  it('a long bullet that wraps onto the next line stays one bullet', () => {
    const r = parseExperience(['Dev | Acme', '2020 - 2022', '- Built a very long description of something that', 'wrapped onto a second line in the PDF', '- A second bullet here']);
    expect(r[0].bullets).toEqual(['Built a very long description of something that wrapped onto a second line in the PDF', 'A second bullet here']);
  });
  it('dates inside a bullet do not start a new job', () => { expect(segmentRoles(['Dev | Acme', '2020 - 2022', '- Led a project from Jan 2021 - Mar 2021', '- Shipped it'])).toHaveLength(1); });
  it('headline and location helpers do not guess', () => {
    expect(headlineOf(['Ada Obi', 'ada@x.com | Lagos, Nigeria', 'Summary'], 'Ada Obi')).toBe(''); expect(locationFromText('Skills: React, Node')).toBe(''); expect(locationFromText('Ada\nLagos, Nigeria')).toBe('Lagos, Nigeria');
    expect(parseEducation(['MBA, Lagos Business School, 2020'])[0]).toMatchObject({ qualification: 'MBA', end: '2020' });
  });
});
