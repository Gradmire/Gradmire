/* Photos for the MBBS, Student Services and Scholarships pages.
   `PHOTOS` are the WebP sets in frontend/assets/photos (<key>-960.webp and <key>-640.webp, made from freely licensed
   Wikimedia Commons files). `COUNTRY_PHOTOS` reuse the university photos that are already on the country guides.
   Every photo is credited in docs/*-image-attributions.md and on the public Photo credits page
   (node scripts/build-credits-page.mjs). Pictures without prominent faces were chosen on purpose.
   `pos` is the CSS object-position used when a wide band crops the picture. */

export const PHOTOS = {
    'mbbs-russia': { w: 960, h: 640, pos: 'center 55%', alt: 'A modern building of Sechenov University in Moscow', caption: 'Sechenov University, Moscow' },
    'mbbs-china': { w: 960, h: 720, pos: 'center 55%', alt: 'A traditional-style hall of Peking Union Medical College in Beijing, with modern towers behind it', caption: 'Peking Union Medical College, Beijing' },
    'mbbs-georgia': { w: 960, h: 640, pos: 'center 60%', alt: 'Old Tbilisi houses on a hillside below the Mother of Georgia statue', caption: 'Old Tbilisi, with the Mother of Georgia statue on the hill' },
    'mbbs-egypt': { w: 960, h: 720, pos: 'center 45%', alt: 'Kasr Al-Ainy University Hospital buildings in Cairo', caption: 'Kasr Al-Ainy University Hospital, Cairo' },
    'mbbs-uzbekistan': { w: 960, h: 720, pos: 'center 40%', alt: 'Buildings on the Tashkent Medical Academy campus', caption: 'Tashkent Medical Academy campus' },
    'mbbs-kazakhstan': { w: 960, h: 710, pos: 'center 35%', alt: 'Fountains and a monument on Republic Square in Almaty, with mountains behind', caption: 'Republic Square, Almaty, with the mountains behind' },
    'mbbs-kyrgyzstan': { w: 960, h: 720, pos: 'center 45%', alt: 'Fountains and the national flag on Ala-Too Square in Bishkek', caption: 'Ala-Too Square, Bishkek' },
    'mbbs-bulgaria': { w: 960, h: 720, pos: 'center 55%', alt: 'The arched gate of the Medical University of Sofia', caption: 'Medical University of Sofia' },
    'mbbs-moldova': { w: 960, h: 621, pos: 'center 50%', alt: 'The Triumphal Arch and the government building in Chișinău in winter', caption: 'Triumphal Arch and the Government building, Chișinău' },
    'med-nurse-laptop': { w: 960, h: 641, pos: 'center 40%', alt: 'A health worker with a stethoscope holding an apple at a desk with a laptop', caption: 'Study and clinical training go together in every MBBS programme' },
    'med-lecture-theatre': { w: 960, h: 786, pos: 'center 45%', alt: 'A historic wooden surgical lecture theatre with tiered seating', caption: 'A historic surgical lecture theatre: medicine has a long teaching tradition' },
    'svc-visa': { w: 960, h: 657, pos: 'center 40%', alt: 'A passport open to pages of visa and entry stamps', caption: 'Every visa file starts with the right documents' },
    'svc-application': { w: 960, h: 641, pos: 'center 55%', alt: 'Hands writing in a notebook beside an open laptop', caption: 'A strong application starts with a clear plan and a well-written statement' },
    'svc-tests': { w: 960, h: 636, pos: 'center 50%', alt: 'A laptop, keyboard and mug on a wooden desk', caption: 'Practice tests and a study plan, fitted around your schedule' },
    'svc-courses': { w: 960, h: 640, pos: 'center 50%', alt: 'A long university library reading hall lined with bookshelves', caption: 'Choosing the course first makes every other decision easier' },
    'sch-graduation': { w: 960, h: 492, pos: 'center 40%', alt: 'Graduation caps thrown into the air inside a hall', caption: 'Scholarships can make a degree abroad affordable: check each funder’s rules' }
};

export const COUNTRY_PHOTOS = {
    uk: { file: 'uk/uni-university-of-oxford.jpg', w: 800, h: 422, name: 'University of Oxford' },
    usa: { file: 'usa/uni-harvard-university.jpg', w: 800, h: 519, name: 'Harvard University' },
    canada: { file: 'canada/uni-university-of-toronto.jpg', w: 800, h: 534, name: 'University of Toronto' },
    australia: { file: 'australia/uni-univ-of-melbourne.jpg', w: 800, h: 600, name: 'University of Melbourne' },
    germany: { file: 'germany/tum-main-building-web.jpg', w: 1200, h: 767, name: 'Technical University of Munich, main building' },
    ireland: { file: 'ireland/uni-trinity-college-dublin.jpg', w: 800, h: 535, name: 'Trinity College Dublin' },
    italy: { file: 'italy/uni-university-of-bologna.jpg', w: 800, h: 529, name: 'University of Bologna' },
    newzealand: { file: 'newzealand/uni-university-of-auckland.jpg', w: 800, h: 600, name: 'University of Auckland' }
};
