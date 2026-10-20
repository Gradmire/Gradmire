/* Country content for the MBBS Abroad pages (built by build-mbbs-pages.mjs).
   Fees, living costs and durations are indicative planning ranges, not quotes:
   confirm each one with the university and update REVIEWED when you re-check them. */

export const REVIEWED = 'October 2026';

export const countries = [
    {
        slug: 'russia',
        name: 'Russia',
        headline: 'A long-established route into medicine at a moderate cost.',
        intro: 'Russia has trained international doctors for decades. Large state medical universities run English-taught General Medicine programmes with their own teaching hospitals, and annual fees stay well below private medical schools in many countries.',
        facts: {
            duration: '6 years, incl. internship',
            medium: 'English (Russian for patient contact)',
            tuition: '≈ RUB 2.5–5 lakh / year',
            living: '≈ RUB 20,000–35,000 / month',
            intake: 'September'
        },
        why: [
            ['Established universities', 'State medical universities with large affiliated hospitals and long experience teaching international cohorts.'],
            ['Lower annual fees', 'Tuition is typically well below private medical schools in many countries, and hostel costs are modest outside Moscow and St Petersburg.'],
            ['Large international community', 'Most big medical cities have established international student groups, familiar food options and seniors who help newcomers settle in.']
        ],
        caution: 'Patients speak Russian. Universities teach the language from year one, and you will need working Russian before clinical rotations, so treat it as part of the course, not an extra.',
        universities: [
            ['First Moscow State Medical University (Sechenov)', 'Moscow', 'One of the oldest medical schools in Russia, with a large clinical network.'],
            ['Kazan Federal University', 'Kazan', 'Research-led federal university with a dedicated medical institute.'],
            ['RUDN University', 'Moscow', 'A very international campus, with students from well over 100 countries.'],
            ['Bashkir State Medical University', 'Ufa', 'Moderate fees and its own clinic for hands-on training.'],
            ['Kuban State Medical University', 'Krasnodar', 'Southern city with a milder climate and an established international department.'],
            ['Crimean Federal University', 'Simferopol', 'Popular with international students for its English-taught General Medicine.']
        ],
        visa: {
            summary: 'International students need a Russian study visa. The university applies for your official invitation; you then file the visa application with that invitation.',
            items: ['Official invitation from the university (issued through Russia’s migration authorities)', 'Passport valid at least 18 months beyond entry', 'Visa application form and recent photographs', 'HIV-negative test certificate', 'Admission letter and proof of fee payment'],
            after: 'The first visa is usually short. The university extends it after you arrive, then renews it every year of the course. You must register your address after you arrive.'
        },
        life: [
            ['Climate', 'Long, cold winters, often well below zero in central and Siberian cities, so budget for proper winter clothing in year one.'],
            ['Food', 'Hostel kitchens are standard, and cities with large international cohorts have South Asian and halal food options.'],
            ['Getting around', 'Metro, tram and bus networks are extensive and student passes keep travel affordable.']
        ],
        faq: [
            ['Do I have to learn Russian if the course is in English?', 'Yes. Lectures are in English, but you will speak with patients in Russian during clinical years. Universities include Russian classes, and students who take them seriously from year one find rotations far easier.'],
            ['Is there an entrance exam?', 'Most universities admit on school-leaving marks in biology and chemistry. Some run a short interview or test, so check the university’s own admission rules. Indian applicants also need a qualifying NEET score.']
        ]
    },
    {
        slug: 'china',
        name: 'China',
        headline: 'Modern hospitals and large universities, if you choose the programme carefully.',
        intro: 'China’s top medical universities have modern teaching hospitals and strong research. For international students, what matters most is whether the English-taught programme and its internship meet the licensing rules of the country where you plan to practise.',
        facts: {
            duration: '6 years (5 + 1-year internship)',
            medium: 'English (Mandarin for patient contact)',
            tuition: '≈ USD 3,000–6,000 / year',
            living: '≈ USD 150–250 / month',
            intake: 'September'
        },
        why: [
            ['Modern infrastructure', 'Large teaching hospitals, simulation labs and well-funded research departments at leading universities.'],
            ['Predictable costs', 'Tuition and campus housing are usually priced clearly up front, which makes it easier to plan a six-year budget.'],
            ['Close to home', 'Short flights from much of Asia and the Middle East.']
        ],
        caution: 'China’s Ministry of Education limits which universities may teach clinical medicine in English to international students. Enrol only in an authorised programme, and make sure the internship can be done at the same university; many licensing bodies, including India’s NMC, require this.',
        universities: [
            ['Peking University Health Science Center', 'Beijing', 'One of China’s leading medical research centres.'],
            ['Shanghai Jiao Tong University School of Medicine', 'Shanghai', 'Large affiliated hospital network in a major city.'],
            ['Zhejiang University School of Medicine', 'Hangzhou', 'Strong academic reputation and research output.'],
            ['Fudan University Shanghai Medical College', 'Shanghai', 'Historic medical college with well-known affiliated hospitals.'],
            ['Jilin University School of Medicine', 'Changchun', 'Long-standing destination for international medical students.'],
            ['Nantong University School of Medicine', 'Nantong', 'Smaller city with lower living costs.']
        ],
        visa: {
            summary: 'International degree students enter China on a study (X1) visa, then convert it to a residence permit after arrival.',
            items: ['Admission notice from the university', 'Visa application form for study in China (JW201 or JW202)', 'Valid passport and photographs', 'Physical examination record for foreigners, if requested', 'Visa application and fee receipt'],
            after: 'Within 30 days of arrival, apply for a student residence permit through the local public security bureau. The university’s international office usually guides you through it.'
        },
        life: [
            ['Language', 'Daily life is easier with basic Mandarin, and many universities set a Chinese proficiency (HSK) target before clinical training.'],
            ['Food', 'Campus canteens are inexpensive, and big cities have international restaurants and grocery stores.'],
            ['Digital life', 'Payments and transport run on local apps. Set up a local bank account and phone number early.']
        ],
        faq: [
            ['Do I need to learn Chinese?', 'Yes. Clinical training means talking to patients, and many universities ask students to reach a set HSK level before clinical years. Start in year one.'],
            ['Can I do my internship in my home country instead?', 'Usually not. Many licensing bodies, including India’s NMC, require the internship to be done at the same university where you studied. Confirm the university offers it before you enrol.']
        ]
    },
    {
        slug: 'georgia',
        name: 'Georgia',
        headline: 'European-style medical education in a safe, compact country.',
        intro: 'Georgia’s medical universities follow a European-style curriculum taught in English, and Tbilisi and Batumi are welcoming, manageable cities for first-time international students.',
        facts: {
            duration: '6 years, incl. clinical training',
            medium: 'English (Georgian for patient contact)',
            tuition: '≈ USD 4,000–6,000 / year',
            living: '≈ USD 3,000–5,000 / year',
            intake: 'September (some universities also admit in spring)'
        },
        why: [
            ['European-style curriculum', 'Credit-based programmes modelled on European medical education, taught in English.'],
            ['Safe and welcoming', 'A small country with a mild climate and a growing international student community.'],
            ['Global exam focus', 'Several universities prepare students for international licensing exams alongside the core course.']
        ],
        caution: 'Clinical work involves Georgian-speaking patients. Check how each university teaches the language and arranges hospital placements before you shortlist it.',
        universities: [
            ['Tbilisi State Medical University (TSMU)', 'Tbilisi', 'Georgia’s oldest dedicated medical university.'],
            ['Batumi Shota Rustaveli State University', 'Batumi', 'State university in a coastal city with English-taught medicine.'],
            ['David Tvildiani Medical University', 'Tbilisi', 'Known for preparing students for international licensing exams.'],
            ['New Vision University', 'Tbilisi', 'Private university with a modern campus and its own hospital.'],
            ['East European University', 'Tbilisi', 'Private university with an international faculty.']
        ],
        visa: {
            summary: 'Once the university has enrolled you and the enrolment is confirmed by Georgia’s education authorities, students who need a visa apply for a long-term study visa (D3).',
            items: ['University admission letter and enrolment confirmation', 'Valid passport and photographs', 'Completed e-visa or embassy application', 'Proof of funds and accommodation', 'Health insurance'],
            after: 'After arrival, apply for a temporary residence permit for study through Georgia’s Public Service Hall, and renew it as the course continues.'
        },
        life: [
            ['Climate', 'Mild compared with Russia and Central Asia: warm summers and short winters in Tbilisi and Batumi.'],
            ['Food', 'International restaurants and grocery stores exist in both main cities; many students cook in shared flats.'],
            ['Housing', 'Most students rent shared flats near campus; university hostels are limited at some institutions.']
        ],
        faq: [
            ['Is Georgia expensive to live in?', 'Living costs are moderate. Rent in central Tbilisi is the biggest expense, and shared flats keep it manageable.'],
            ['Which intake should I choose?', 'September is the main intake. Some universities also admit in spring; choose based on when your school results and documents will be ready.']
        ]
    },
    {
        slug: 'egypt',
        name: 'Egypt',
        headline: 'Historic medical faculties with heavy hospital exposure.',
        intro: 'Egypt’s public universities have some of the oldest medical faculties in the region, with large hospitals and high patient volumes. Entry requirements are stricter than in most MBBS-abroad destinations.',
        facts: {
            duration: '7 years (5 academic + 2-year internship)',
            medium: 'English (Arabic for patient contact)',
            tuition: '≈ USD 4,000–8,000 / year',
            living: '≈ USD 1,800–3,000 / year',
            intake: 'September–October'
        },
        why: [
            ['High patient volumes', 'Large public hospitals give students broad clinical exposure.'],
            ['Long medical tradition', 'Faculties such as Cairo’s have trained doctors for more than a century.'],
            ['Low living costs', 'Day-to-day living is affordable compared with most other destinations.']
        ],
        caution: 'Egyptian universities usually ask for higher school-leaving science marks than other MBBS-abroad countries, and admissions for international students run through a central government portal, so start early.',
        universities: [
            ['Cairo University – Faculty of Medicine', 'Cairo', 'One of the oldest and largest medical faculties in Africa.'],
            ['Ain Shams University', 'Cairo', 'Large university hospital system in the capital.'],
            ['Alexandria University', 'Alexandria', 'Coastal city with strong hospital affiliations.'],
            ['Mansoura University', 'Mansoura', 'Well-known for surgery and internal medicine.'],
            ['Zagazig University', 'Zagazig', 'Lower-cost option outside the capital.']
        ],
        visa: {
            summary: 'International students are admitted through Egypt’s central admissions system for foreign students. A student residence permit follows enrolment.',
            items: ['Admission confirmation from the central portal and the university', 'Valid passport and photographs', 'Attested academic certificates', 'Medical test results, including HIV', 'Entry visa as advised by the Egyptian embassy'],
            after: 'After enrolment, the university supports your student residence permit, which is renewed each academic year.'
        },
        life: [
            ['Climate', 'Hot, dry summers and mild winters.'],
            ['Food', 'Vegetarian-friendly local food is easy to find, and international groceries are available in Cairo and Alexandria.'],
            ['Language', 'Basic Arabic helps a lot, both day to day and with patients in clinical years.']
        ],
        faq: [
            ['What marks do I need?', 'Most Egyptian medical faculties expect high school-leaving marks in physics, chemistry and biology, often 60–70% or more. Check the current threshold for the year you apply.'],
            ['Is the 2-year internship done at the university?', 'It should be, at the university’s own hospitals. Licensing bodies that require a 12-month internship at the same institution, such as India’s NMC, accept a longer one there.']
        ]
    },
    {
        slug: 'uzbekistan',
        name: 'Uzbekistan',
        headline: 'Affordable Central Asian medical universities on a fast-growing route.',
        intro: 'Uzbekistan has opened its state medical institutes to international students, with English-taught programmes, low fees and a growing international student community in Tashkent and Samarkand.',
        facts: {
            duration: '6 years, incl. internship',
            medium: 'English (Uzbek/Russian for patient contact)',
            tuition: '≈ USD 3,000–5,000 / year',
            living: '≈ USD 100–200 / month',
            intake: 'September–October'
        },
        why: [
            ['Low overall cost', 'Tuition and living costs are among the lowest of the countries we cover.'],
            ['State institutions', 'Government medical institutes with their own clinical bases.'],
            ['Good connections', 'Direct flights to South Asia, the Gulf and Europe make trips home easier.']
        ],
        caution: 'Uzbekistan’s English-taught programmes are relatively new at some institutes. Ask about the faculty, the clinical bases and how patient-language training is handled before you commit.',
        universities: [
            ['Tashkent Medical Academy', 'Tashkent', 'One of the country’s oldest and largest medical institutions.'],
            ['Samarkand State Medical University', 'Samarkand', 'Historic city with an expanding international faculty.'],
            ['Bukhara State Medical Institute', 'Bukhara', 'Popular with international students for English-taught medicine.'],
            ['Andijan State Medical Institute', 'Andijan', 'Lower-cost option in the Fergana Valley.'],
            ['Fergana Medical Institute of Public Health', 'Fergana', 'Regional institute with growing international enrolment.']
        ],
        visa: {
            summary: 'International students apply for an Uzbek study visa using the university’s invitation letter.',
            items: ['Invitation letter from the university', 'Valid passport and photographs', 'Visa application form', 'Admission letter and fee receipt', 'Medical certificate, if requested'],
            after: 'Register your address with the local authorities after arrival (the university hostel often handles this) and renew your stay permission each year.'
        },
        life: [
            ['Climate', 'Hot summers and cold, dry winters.'],
            ['Food', 'Cities with big international cohorts have South Asian food options; local cuisine is meat-heavy.'],
            ['Language', 'Russian is widely spoken in cities; basic Russian or Uzbek helps day to day.']
        ],
        faq: [
            ['Is Uzbekistan cheaper than Russia?', 'Usually, yes. Both tuition and living costs tend to be lower, especially outside Tashkent.'],
            ['Which language will patients speak?', 'Uzbek or Russian, depending on the city. Expect to learn one of them during the course.']
        ]
    },
    {
        slug: 'kazakhstan',
        name: 'Kazakhstan',
        headline: 'Well-equipped state medical universities in a stable, growing economy.',
        intro: 'Kazakhstan’s national medical universities in Almaty, Astana and Karaganda have upgraded their facilities and English-taught programmes, and they host thousands of international students.',
        facts: {
            duration: '6 years (5 + 1-year internship)',
            medium: 'English (Kazakh/Russian for patient contact)',
            tuition: '≈ USD 3,000–5,500 / year',
            living: '≈ USD 150–250 / month',
            intake: 'September'
        },
        why: [
            ['National universities', 'Leading state medical universities with modern simulation centres.'],
            ['Stable environment', 'Kazakhstan is the region’s largest economy, and its cities are well connected.'],
            ['Moderate costs', 'Fees are lower than in Europe, with affordable hostels.']
        ],
        caution: 'Kazakhstan has restructured its medical degrees in recent years. Confirm your programme includes at least 54 months of study plus a 12-month internship at the same university, which licensing bodies such as India’s NMC require.',
        universities: [
            ['Kazakh National Medical University (Asfendiyarov)', 'Almaty', 'The country’s leading medical university.'],
            ['Astana Medical University', 'Astana', 'In the capital, with modern clinical facilities.'],
            ['Karaganda Medical University', 'Karaganda', 'Established international programme.'],
            ['Semey Medical University', 'Semey', 'Long-standing medical school with lower living costs.'],
            ['West Kazakhstan Marat Ospanov Medical University', 'Aktobe', 'Popular with international students.']
        ],
        visa: {
            summary: 'International students apply for a Kazakh student visa on the strength of the university’s invitation.',
            items: ['Invitation from the university (processed through Kazakh migration services)', 'Valid passport and photographs', 'Visa application form', 'Admission letter and fee receipt', 'Medical certificate, including HIV'],
            after: 'Register with the migration police after arrival. The university usually arranges this and the annual extensions.'
        },
        life: [
            ['Climate', 'Continental: hot summers and very cold winters, especially in Astana.'],
            ['Food', 'Major universities have South Asian food options; groceries are affordable.'],
            ['Language', 'Russian is widely used in cities; Kazakh is the state language.']
        ],
        faq: [
            ['Is the course really shorter in Kazakhstan?', 'Not any more. Choose a programme of about six years in total, including a 12-month internship; shorter programmes may not be accepted by licensing bodies such as India’s NMC.'],
            ['Are winters a problem?', 'Winters are harsh in the north. Almaty is milder; factor climate into your choice of city.']
        ]
    },
    {
        slug: 'kyrgyzstan',
        name: 'Kyrgyzstan',
        headline: 'One of the lowest-cost MBBS routes, if you vet the university carefully.',
        intro: 'Kyrgyzstan attracts large numbers of international students with very low fees and simple admissions. Quality varies more between institutions here than in most countries, so careful shortlisting matters.',
        facts: {
            duration: '≈ 6 years, incl. internship',
            medium: 'English (Kyrgyz/Russian for patient contact)',
            tuition: '≈ USD 2,500–4,000 / year',
            living: '≈ USD 100–200 / month',
            intake: 'September'
        },
        why: [
            ['Very low fees', 'Among the lowest tuition and living costs for a full MBBS course.'],
            ['Simple admissions', 'Admission is usually based on school-leaving marks in biology and chemistry, without an entrance exam.'],
            ['Large international cohorts', 'Bishkek and Osh have big international student communities and familiar food options.']
        ],
        caution: 'Programmes differ widely here. Check how long the course is, where the 12-month internship takes place and how clinical training is delivered, and choose only programmes that meet your home country’s licensing rules.',
        universities: [
            ['Kyrgyz State Medical Academy (KSMA)', 'Bishkek', 'The country’s oldest state medical institution.'],
            ['Osh State University – International Medical Faculty', 'Osh', 'Large international student community.'],
            ['Jalal-Abad State University', 'Jalal-Abad', 'Lower-cost option in the south.'],
            ['International School of Medicine (ISM-IUK)', 'Bishkek', 'English-taught programme aimed at international students.'],
            ['Asian Medical Institute', 'Kant', 'Smaller institute near Bishkek.']
        ],
        visa: {
            summary: 'International students travel on a study visa supported by the university’s invitation letter.',
            items: ['Invitation letter from the university', 'Valid passport and photographs', 'Visa application form', 'Admission letter and fee receipt', 'Medical certificate, if requested'],
            after: 'Register with the local migration authorities after arrival and renew your registration each year. The university’s international office usually assists.'
        },
        life: [
            ['Climate', 'Mountainous: warm summers and cold winters, milder in the south.'],
            ['Food', 'Universities with large international cohorts have South Asian food options.'],
            ['Language', 'Russian is widely spoken in Bishkek; Kyrgyz is common elsewhere.']
        ],
        faq: [
            ['Why are fees so low?', 'Lower costs across the economy and high international enrolment. Low fees are not a quality signal on their own, so compare clinical training and the internship arrangements, not just price.'],
            ['Is the internship done in Kyrgyzstan?', 'It should be: many licensing bodies, including India’s NMC, require it. Confirm the university provides the full 12-month internship at its own clinical bases.']
        ]
    },
    {
        slug: 'bulgaria',
        name: 'Bulgaria',
        headline: 'An EU medical degree, with an EU price tag that is still within reach.',
        intro: 'Bulgaria is an EU member, so its medical universities teach to EU standards and award degrees recognised across the European Union. Fees are higher than in Central Asia, and so is the bar for admission.',
        facts: {
            duration: '6 years, incl. internship',
            medium: 'English (Bulgarian for patient contact)',
            tuition: '≈ EUR 7,000–8,000 / year',
            living: '≈ EUR 400–600 / month',
            intake: 'September–October'
        },
        why: [
            ['EU-recognised degree', 'A degree from an EU member state, with routes to practise or specialise within the European Union.'],
            ['Established universities', 'State medical universities with decades of experience teaching in English.'],
            ['European base', 'Easy travel across Europe, plus a high standard of student life.']
        ],
        caution: 'Unlike most MBBS-abroad destinations, Bulgarian medical universities usually set an entrance exam, typically in biology and chemistry, alongside your school-leaving marks. Prepare for it.',
        universities: [
            ['Medical University – Sofia', 'Sofia', 'One of the oldest medical schools in south-eastern Europe.'],
            ['Medical University of Varna', 'Varna', 'Coastal city and a popular choice for international students.'],
            ['Medical University – Plovdiv', 'Plovdiv', 'Strong research and clinical partnerships.'],
            ['Medical University – Pleven', 'Pleven', 'Long-running English-taught programme.']
        ],
        visa: {
            summary: 'Students from outside the EU apply for a Bulgarian long-stay (type D) visa for study once the university admits them.',
            items: ['Admission confirmation from the university, with Ministry of Education approval', 'Valid passport and photographs', 'Proof of funds and accommodation', 'Health insurance', 'Attested and translated academic documents'],
            after: 'After arrival, apply for a long-term residence permit through Bulgaria’s Migration Directorate and renew it during your studies.'
        },
        life: [
            ['Climate', 'Four seasons, with warm summers and cold but manageable winters.'],
            ['Food', 'International restaurants and groceries in Sofia and Varna; vegetarian food is easy to find.'],
            ['Work', 'EU rules allow some part-time work for students with the right residence status. Check current conditions before you rely on it.']
        ],
        faq: [
            ['Is there an entrance exam?', 'Usually yes. Most state medical universities test biology and chemistry, and some interview applicants or test their English too.'],
            ['Is the degree recognised outside the EU?', 'Bulgarian medical universities are listed in the World Directory of Medical Schools. Practising outside the EU still means passing that country’s licensing exam, such as the USMLE, PLAB/UKMLA or India’s FMGE/NExT.']
        ]
    },
    {
        slug: 'moldova',
        name: 'Moldova',
        headline: 'A European medical university at a moderate cost.',
        intro: 'Moldova’s Nicolae Testemițanu State University of Medicine and Pharmacy, in Chișinău, teaches General Medicine in English to a large international cohort, at fees well below western Europe.',
        facts: {
            duration: '6 years',
            medium: 'English (Romanian for patient contact)',
            tuition: '≈ EUR 4,000–6,000 / year',
            living: '≈ EUR 250–400 / month',
            intake: 'September'
        },
        why: [
            ['Single national university', 'One large, established state medical university with its own clinical bases.'],
            ['European curriculum', 'A credit-based programme modelled on European medical education.'],
            ['Moderate costs', 'Lower fees and living costs than most EU destinations.']
        ],
        caution: 'Patients speak Romanian. Check how the university supports language learning, and confirm how the 12-month internship requirement is met at the university.',
        universities: [
            ['Nicolae Testemițanu State University of Medicine and Pharmacy', 'Chișinău', 'Moldova’s main medical university, with a large international faculty.']
        ],
        visa: {
            summary: 'International students apply for a Moldovan long-stay study visa using the university’s invitation, which is approved by Moldova’s migration authority.',
            items: ['Invitation letter approved by the Bureau for Migration and Asylum', 'Valid passport and photographs', 'Admission letter and fee receipt', 'Health insurance', 'Proof of funds'],
            after: 'After arrival, apply for a temporary residence permit for study and renew it each year.'
        },
        life: [
            ['Climate', 'Warm summers and cold winters.'],
            ['Food', 'Fewer international restaurants than in larger destinations; most students cook for themselves.'],
            ['Language', 'Romanian is the official language, and Russian is widely understood.']
        ],
        faq: [
            ['Is there more than one medical university?', 'Nicolae Testemițanu University is the main option for General Medicine taught in English.'],
            ['Is Moldova in the EU?', 'No. Moldova is an EU candidate country, not a member, so its degrees do not automatically carry EU recognition the way Bulgaria’s do.']
        ]
    }
];
