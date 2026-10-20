/* Data for the Course Finder (build-course-finder.mjs).
   Universities: city, founding year, type and QS World University Rankings 2026 position
   (null = no confirmed overall QS 2026 rank). Courses are example programmes by subject
   and level; length and intakes are typical for the country. The exact title, length,
   fees and intakes are on each university's own site. */

export const REVIEWED = 'October 2026';

/* Subject areas shown as filters. `aliases` match ?course= values used by the nav,
   destination pages and older links. */
export const subjects = [
    { key: 'business', label: 'Business & Management', aliases: ['business', 'business and management', 'business management', 'mba', 'management', 'business analytics', 'accounting', 'marketing'] },
    { key: 'computing', label: 'Computer Science & IT', aliases: ['computer science', 'computer science and ai', 'computer science ai', 'computing', 'it', 'information technology', 'software'] },
    { key: 'data', label: 'Data Science & AI', aliases: ['data science', 'data science and ai', 'ai', 'artificial intelligence', 'machine learning', 'analytics'] },
    { key: 'engineering', label: 'Engineering', aliases: ['engineering', 'engineering and technology', 'mechanical engineering', 'civil engineering', 'electrical engineering'] },
    { key: 'health', label: 'Medicine, Health & Nursing', aliases: ['medicine', 'medicine and health', 'medicine and health sciences', 'health', 'nursing', 'public health', 'pharmacy'] },
    { key: 'science', label: 'Natural Sciences', aliases: ['science', 'natural sciences', 'physics', 'biology', 'chemistry', 'biotechnology'] },
    { key: 'economics', label: 'Economics & Finance', aliases: ['economics', 'economics and finance', 'finance'] },
    { key: 'law', label: 'Law', aliases: ['law', 'llm', 'legal'] },
    { key: 'design', label: 'Architecture, Design & Arts', aliases: ['design', 'architecture and design', 'architecture', 'creative arts, design and media', 'creative arts design and media', 'arts', 'media'] },
    { key: 'psychology', label: 'Psychology', aliases: ['psychology'] },
    { key: 'social', label: 'Social Sciences & Humanities', aliases: ['social sciences and humanities', 'social sciences', 'humanities', 'social', 'international relations', 'journalism', 'education'] },
    { key: 'hospitality', label: 'Hospitality & Tourism', aliases: ['hospitality', 'tourism', 'tourism and hospitality', 'hotel management'] }
];

export const countries = {
    uk: { name: 'United Kingdom', ug: '3 years (4 in Scotland)', pg: '1 year', intakes: 'Sep (some Jan)' },
    usa: { name: 'USA', ug: '4 years', pg: '1.5–2 years', intakes: 'Aug–Sep (some Jan)' },
    canada: { name: 'Canada', ug: '4 years', pg: '1–2 years', intakes: 'Sep (some Jan, May)' },
    australia: { name: 'Australia', ug: '3 years', pg: '1.5–2 years', intakes: 'Feb, Jul' },
    germany: { name: 'Germany', ug: '3–3.5 years', pg: '2 years', intakes: 'Oct (some Apr)' },
    ireland: { name: 'Ireland', ug: '3–4 years', pg: '1 year', intakes: 'Sep' },
    newzealand: { name: 'New Zealand', ug: '3 years', pg: '1–2 years', intakes: 'Feb, Jul' },
    italy: { name: 'Italy', ug: '3 years', pg: '2 years', intakes: 'Sep–Oct' },
    finland: { name: 'Finland', ug: '3–3.5 years', pg: '2 years', intakes: 'Aug–Sep' }
};

/* URL-safe id used by ?university= links. */
export const uniSlug = (name) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\([^)]*\)/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* [subject key, programme, level: 'ug' | 'pg'] */
export const universities = [
    // United Kingdom
    { name: 'Imperial College London', city: 'London', country: 'uk', founded: '1907', type: 'Public', qs: 2, url: 'https://www.imperial.ac.uk/study/', courses: [['computing', 'Computing', 'pg'], ['computing', 'Computing', 'ug'], ['engineering', 'Mechanical Engineering', 'ug'], ['business', 'Business Analytics', 'pg']] },
    { name: 'University of Oxford', city: 'Oxford', country: 'uk', founded: 'c. 1096', type: 'Public', qs: 4, url: 'https://www.ox.ac.uk/admissions', courses: [['computing', 'Computer Science', 'ug'], ['economics', 'Economics and Management', 'ug'], ['law', 'Law (Jurisprudence)', 'ug']] },
    { name: 'University of Cambridge', city: 'Cambridge', country: 'uk', founded: '1209', type: 'Public', qs: 6, url: 'https://www.undergraduate.study.cam.ac.uk/', courses: [['economics', 'Economics', 'ug'], ['computing', 'Computer Science', 'ug'], ['science', 'Natural Sciences', 'ug']] },
    { name: 'UCL (University College London)', city: 'London', country: 'uk', founded: '1826', type: 'Public', qs: 9, url: 'https://www.ucl.ac.uk/prospective-students/', courses: [['computing', 'Computer Science', 'pg'], ['design', 'Architecture', 'ug'], ['psychology', 'Psychology', 'ug'], ['law', 'Law', 'ug']] },
    { name: 'King\'s College London', city: 'London', country: 'uk', founded: '1829', type: 'Public', qs: 31, url: 'https://www.kcl.ac.uk/study', courses: [['law', 'Law (LLM)', 'pg'], ['health', 'Nursing', 'ug'], ['social', 'International Relations', 'pg']] },
    { name: 'University of Edinburgh', city: 'Edinburgh', country: 'uk', founded: '1583', type: 'Public', qs: 34, url: 'https://www.ed.ac.uk/studying', courses: [['computing', 'Computer Science', 'ug'], ['data', 'Data Science', 'pg'], ['psychology', 'Psychology', 'ug']] },
    { name: 'University of Manchester', city: 'Manchester', country: 'uk', founded: '1824', type: 'Public', qs: 35, url: 'https://www.manchester.ac.uk/study/', courses: [['engineering', 'Mechanical Engineering', 'ug'], ['business', 'Management', 'pg'], ['data', 'Data Science', 'pg']] },
    { name: 'University of Warwick', city: 'Coventry', country: 'uk', founded: '1965', type: 'Public', qs: 74, url: 'https://warwick.ac.uk/study/', courses: [['economics', 'Economics', 'ug'], ['business', 'Business Analytics', 'pg'], ['computing', 'Computer Science', 'ug']] },
    // USA
    { name: 'Massachusetts Institute of Technology (MIT)', city: 'Cambridge, MA', country: 'usa', founded: '1861', type: 'Private', qs: 1, url: 'https://mitadmissions.org/', courses: [['computing', 'Computer Science and Engineering', 'ug'], ['engineering', 'Mechanical Engineering', 'ug'], ['engineering', 'Engineering (SM)', 'pg']] },
    { name: 'Stanford University', city: 'Stanford, CA', country: 'usa', founded: '1885', type: 'Private', qs: 3, url: 'https://www.stanford.edu/admission/', courses: [['computing', 'Computer Science (MS)', 'pg'], ['engineering', 'Engineering', 'ug'], ['economics', 'Economics', 'ug']] },
    { name: 'Harvard University', city: 'Cambridge, MA', country: 'usa', founded: '1636', type: 'Private', qs: 5, url: 'https://www.harvard.edu/admissions-aid/', courses: [['economics', 'Economics', 'ug'], ['computing', 'Computer Science', 'ug'], ['health', 'Public Health (MPH)', 'pg']] },
    { name: 'Columbia University', city: 'New York City', country: 'usa', founded: '1754', type: 'Private', qs: 38, url: 'https://www.columbia.edu/content/admissions', courses: [['data', 'Data Science (MS)', 'pg'], ['engineering', 'Engineering (MS)', 'pg'], ['social', 'Journalism (MS)', 'pg']] },
    { name: 'University of Michigan', city: 'Ann Arbor', country: 'usa', founded: '1817', type: 'Public', qs: 45, url: 'https://admissions.umich.edu/', courses: [['engineering', 'Engineering', 'ug'], ['data', 'Data Science (MS)', 'pg'], ['business', 'Business Administration (BBA)', 'ug']] },
    { name: 'Carnegie Mellon University', city: 'Pittsburgh', country: 'usa', founded: '1900', type: 'Private', qs: 52, url: 'https://www.cmu.edu/admission/', courses: [['computing', 'Computer Science', 'ug'], ['computing', 'Information Systems Management (MS)', 'pg'], ['business', 'Business Analytics (MS)', 'pg']] },
    { name: 'University of Illinois Urbana-Champaign', city: 'Urbana-Champaign', country: 'usa', founded: '1867', type: 'Public', qs: 70, url: 'https://illinois.edu/admissions/', courses: [['computing', 'Computer Science', 'ug'], ['computing', 'Computer Science (MCS)', 'pg'], ['engineering', 'Engineering', 'ug']] },
    { name: 'Purdue University', city: 'West Lafayette', country: 'usa', founded: '1869', type: 'Public', qs: 88, url: 'https://www.admissions.purdue.edu/', courses: [['engineering', 'Engineering', 'ug'], ['computing', 'Computer Science', 'ug'], ['business', 'Business Analytics (MS)', 'pg']] },
    // Canada
    { name: 'McGill University', city: 'Montreal', country: 'canada', founded: '1821', type: 'Public', qs: 27, url: 'https://www.mcgill.ca/undergraduate-admissions/', courses: [['engineering', 'Engineering', 'ug'], ['psychology', 'Psychology', 'ug'], ['business', 'Management Analytics (MMA)', 'pg']] },
    { name: 'University of Toronto', city: 'Toronto', country: 'canada', founded: '1827', type: 'Public', qs: 29, url: 'https://future.utoronto.ca/', courses: [['computing', 'Computer Science', 'ug'], ['engineering', 'Engineering', 'ug'], ['business', 'MBA (Rotman)', 'pg']] },
    { name: 'University of British Columbia', city: 'Vancouver', country: 'canada', founded: '1908', type: 'Public', qs: 40, url: 'https://you.ubc.ca/', courses: [['computing', 'Computer Science', 'ug'], ['business', 'Commerce (Sauder)', 'ug'], ['data', 'Data Science (MDS)', 'pg']] },
    { name: 'University of Waterloo', city: 'Waterloo', country: 'canada', founded: '1957', type: 'Public', qs: 119, url: 'https://uwaterloo.ca/future-students/', courses: [['computing', 'Computer Science', 'ug'], ['engineering', 'Engineering', 'ug'], ['data', 'Data Science and Artificial Intelligence', 'pg']] },
    { name: 'Western University', city: 'London, Ontario', country: 'canada', founded: '1878', type: 'Public', qs: 151, url: 'https://welcome.uwo.ca/', courses: [['business', 'Business Administration (Ivey HBA)', 'ug'], ['computing', 'Computer Science', 'ug']] },
    { name: 'Queen\'s University', city: 'Kingston', country: 'canada', founded: '1841', type: 'Public', qs: 191, url: 'https://www.queensu.ca/admission/', courses: [['business', 'Commerce', 'ug'], ['engineering', 'Engineering', 'ug']] },
    { name: 'Dalhousie University', city: 'Halifax', country: 'canada', founded: '1818', type: 'Public', qs: 283, url: 'https://www.dal.ca/admissions.html', courses: [['computing', 'Computer Science', 'ug'], ['computing', 'Applied Computer Science (MACS)', 'pg']] },
    { name: 'Simon Fraser University', city: 'Burnaby, Vancouver', country: 'canada', founded: '1965', type: 'Public', qs: 308, url: 'https://www.sfu.ca/students/admission.html', courses: [['computing', 'Computing Science', 'ug'], ['data', 'Professional Computer Science (Big Data)', 'pg']] },
    // Australia
    { name: 'University of Melbourne', city: 'Melbourne', country: 'australia', founded: '1853', type: 'Public', qs: 19, url: 'https://study.unimelb.edu.au/', courses: [['business', 'Commerce', 'ug'], ['data', 'Data Science', 'pg'], ['engineering', 'Engineering', 'pg']] },
    { name: 'UNSW Sydney', city: 'Sydney', country: 'australia', founded: '1949', type: 'Public', qs: 20, url: 'https://www.unsw.edu.au/study', courses: [['engineering', 'Engineering', 'ug'], ['computing', 'Information Technology', 'pg'], ['business', 'Business Analytics', 'pg']] },
    { name: 'University of Sydney', city: 'Sydney', country: 'australia', founded: '1850', type: 'Public', qs: 25, url: 'https://www.sydney.edu.au/study.html', courses: [['computing', 'Computing', 'ug'], ['business', 'Commerce', 'ug'], ['health', 'Nursing', 'pg']] },
    { name: 'Australian National University', city: 'Canberra', country: 'australia', founded: '1946', type: 'Public', qs: 32, url: 'https://study.anu.edu.au/', courses: [['computing', 'Computing', 'pg'], ['science', 'Science', 'ug'], ['social', 'International Relations', 'pg']] },
    { name: 'Monash University', city: 'Melbourne', country: 'australia', founded: '1958', type: 'Public', qs: 36, url: 'https://www.monash.edu/study', courses: [['health', 'Nursing', 'ug'], ['computing', 'Information Technology', 'pg'], ['business', 'Business', 'pg']] },
    { name: 'University of Queensland', city: 'Brisbane', country: 'australia', founded: '1909', type: 'Public', qs: 42, url: 'https://study.uq.edu.au/', courses: [['psychology', 'Psychology', 'ug'], ['data', 'Data Science', 'pg'], ['business', 'Business', 'pg']] },
    { name: 'Adelaide University', city: 'Adelaide', country: 'australia', founded: '2026 (merger of Adelaide and UniSA)', type: 'Public', qs: 82, url: 'https://adelaideuni.edu.au/', courses: [['business', 'Commerce', 'ug'], ['computing', 'Information Technology', 'pg']] },
    { name: 'Macquarie University', city: 'Sydney', country: 'australia', founded: '1964', type: 'Public', qs: null, url: 'https://www.mq.edu.au/study', courses: [['business', 'Commerce', 'ug'], ['computing', 'Information Technology', 'pg'], ['business', 'Business Analytics', 'pg']] },
    // Germany
    { name: 'Technical University of Munich (TUM)', city: 'Munich', country: 'germany', founded: '1868', type: 'Public', qs: 22, url: 'https://www.tum.de/en/studies', courses: [['computing', 'Informatics', 'pg'], ['engineering', 'Mechanical Engineering', 'pg'], ['business', 'Management', 'pg']] },
    { name: 'Ludwig Maximilian University (LMU)', city: 'Munich', country: 'germany', founded: '1472', type: 'Public', qs: 58, url: 'https://www.lmu.de/en/study/', courses: [['economics', 'Economics', 'pg'], ['data', 'Data Science', 'pg']] },
    { name: 'Heidelberg University', city: 'Heidelberg', country: 'germany', founded: '1386', type: 'Public', qs: 80, url: 'https://www.uni-heidelberg.de/en/study', courses: [['science', 'Physics', 'pg'], ['science', 'Molecular Biosciences', 'pg']] },
    { name: 'RWTH Aachen University', city: 'Aachen', country: 'germany', founded: '1870', type: 'Public', qs: null, url: 'https://www.rwth-aachen.de/go/id/a/?lidx=1', courses: [['engineering', 'Mechanical Engineering', 'pg'], ['data', 'Data Science', 'pg']] },
    { name: 'Humboldt University of Berlin', city: 'Berlin', country: 'germany', founded: '1810', type: 'Public', qs: null, url: 'https://www.hu-berlin.de/en/studies', courses: [['economics', 'Economics and Management Science', 'pg'], ['data', 'Statistics', 'pg']] },
    { name: 'Technical University of Berlin', city: 'Berlin', country: 'germany', founded: '1879', type: 'Public', qs: null, url: 'https://www.tu.berlin/en/studying', courses: [['computing', 'Computer Science', 'pg'], ['engineering', 'Mechanical Engineering', 'pg']] },
    { name: 'University of Stuttgart', city: 'Stuttgart', country: 'germany', founded: '1829', type: 'Public', qs: null, url: 'https://www.uni-stuttgart.de/en/study/', courses: [['engineering', 'Computational Mechanics of Materials and Structures (COMMAS)', 'pg'], ['engineering', 'Information Technology (INFOTECH)', 'pg']] },
    { name: 'Frankfurt School of Finance & Management', city: 'Frankfurt', country: 'germany', founded: '1957', type: 'Private', qs: null, url: 'https://www.frankfurt-school.de/en/home/programmes', courses: [['economics', 'Master in Finance', 'pg'], ['business', 'Business Administration', 'ug']] },
    // Ireland
    { name: 'Trinity College Dublin', city: 'Dublin', country: 'ireland', founded: '1592', type: 'Public', qs: 75, url: 'https://www.tcd.ie/study/', courses: [['computing', 'Computer Science', 'pg'], ['business', 'Business Studies', 'ug'], ['law', 'Law (LLM)', 'pg']] },
    { name: 'University College Dublin', city: 'Dublin', country: 'ireland', founded: '1854', type: 'Public', qs: 118, url: 'https://www.ucd.ie/study/', courses: [['business', 'Business Analytics', 'pg'], ['computing', 'Computer Science', 'ug'], ['engineering', 'Engineering', 'pg']] },
    { name: 'University College Cork', city: 'Cork', country: 'ireland', founded: '1845', type: 'Public', qs: 246, url: 'https://www.ucc.ie/en/study/', courses: [['data', 'Data Science and Analytics', 'pg'], ['business', 'Commerce', 'ug']] },
    { name: 'University of Galway', city: 'Galway', country: 'ireland', founded: '1845', type: 'Public', qs: 284, url: 'https://www.universityofgalway.ie/courses/', courses: [['data', 'Data Analytics', 'pg'], ['engineering', 'Engineering', 'ug']] },
    { name: 'University of Limerick', city: 'Limerick', country: 'ireland', founded: '1972', type: 'Public', qs: 401, url: 'https://www.ul.ie/courses', courses: [['computing', 'Computer Systems', 'ug'], ['business', 'Business Analytics', 'pg']] },
    { name: 'Dublin City University', city: 'Dublin', country: 'ireland', founded: '1975', type: 'Public', qs: 410, url: 'https://www.dcu.ie/courses', courses: [['computing', 'Computing', 'pg'], ['business', 'Business Studies', 'ug']] },
    { name: 'Maynooth University', city: 'Maynooth', country: 'ireland', founded: '1795', type: 'Public', qs: 771, url: 'https://www.maynoothuniversity.ie/study-maynooth', courses: [['computing', 'Computer Science', 'pg'], ['business', 'Business', 'ug']] },
    { name: 'Technological University Dublin', city: 'Dublin', country: 'ireland', founded: '2019', type: 'Public', qs: 781, url: 'https://www.tudublin.ie/study/', courses: [['computing', 'Computer Science', 'pg'], ['hospitality', 'Hospitality Management', 'ug']] },
    // New Zealand
    { name: 'University of Auckland', city: 'Auckland', country: 'newzealand', founded: '1883', type: 'Public', qs: 65, url: 'https://www.auckland.ac.nz/en/study.html', courses: [['business', 'Commerce', 'ug'], ['computing', 'Information Technology', 'pg'], ['data', 'Data Science', 'pg']] },
    { name: 'University of Otago', city: 'Dunedin', country: 'newzealand', founded: '1869', type: 'Public', qs: 197, url: 'https://www.otago.ac.nz/study', courses: [['health', 'Health Sciences', 'ug'], ['psychology', 'Psychology', 'ug']] },
    { name: 'Victoria University of Wellington', city: 'Wellington', country: 'newzealand', founded: '1897', type: 'Public', qs: 240, url: 'https://www.wgtn.ac.nz/study', courses: [['design', 'Design Innovation', 'ug'], ['computing', 'Computer Science', 'pg']] },
    { name: 'University of Canterbury', city: 'Christchurch', country: 'newzealand', founded: '1873', type: 'Public', qs: 261, url: 'https://www.canterbury.ac.nz/study', courses: [['engineering', 'Engineering', 'pg'], ['computing', 'Computer Science', 'ug']] },
    { name: 'Massey University', city: 'Palmerston North, Auckland, Wellington', country: 'newzealand', founded: '1927', type: 'Public', qs: 230, url: 'https://www.massey.ac.nz/study/', courses: [['business', 'Business', 'ug'], ['computing', 'Information Sciences', 'pg']] },
    { name: 'University of Waikato', city: 'Hamilton', country: 'newzealand', founded: '1964', type: 'Public', qs: 281, url: 'https://www.waikato.ac.nz/study/', courses: [['computing', 'Computer Science', 'ug'], ['business', 'Management Studies', 'pg']] },
    { name: 'Lincoln University', city: 'Lincoln, near Christchurch', country: 'newzealand', founded: '1878', type: 'Public', qs: 407, url: 'https://www.lincoln.ac.nz/study/', courses: [['science', 'Agricultural Science', 'ug'], ['hospitality', 'Tourism Management', 'ug']] },
    { name: 'Auckland University of Technology (AUT)', city: 'Auckland', country: 'newzealand', founded: '2000', type: 'Public', qs: 410, url: 'https://www.aut.ac.nz/study', courses: [['hospitality', 'International Hospitality Management', 'ug'], ['computing', 'Computer and Information Sciences', 'pg']] },
    // Italy
    { name: 'Politecnico di Milano', city: 'Milan', country: 'italy', founded: '1863', type: 'Public', qs: 98, url: 'https://www.polimi.it/en/international-prospective-students', courses: [['design', 'Design', 'pg'], ['computing', 'Computer Science and Engineering', 'pg'], ['design', 'Architectural Design', 'ug']] },
    { name: 'Sapienza University of Rome', city: 'Rome', country: 'italy', founded: '1303', type: 'Public', qs: 128, url: 'https://www.uniroma1.it/en/pagina/international-students', courses: [['data', 'Data Science', 'pg'], ['engineering', 'Engineering', 'pg']] },
    { name: 'University of Bologna', city: 'Bologna', country: 'italy', founded: '1088', type: 'Public', qs: 138, url: 'https://www.unibo.it/en/study', courses: [['economics', 'Business and Economics', 'ug'], ['engineering', 'Engineering', 'pg']] },
    { name: 'Politecnico di Torino', city: 'Turin', country: 'italy', founded: '1859', type: 'Public', qs: 242, url: 'https://www.polito.it/en/education', courses: [['engineering', 'Engineering', 'ug'], ['engineering', 'Engineering', 'pg']] },
    { name: 'University of Padua', city: 'Padua', country: 'italy', founded: '1222', type: 'Public', qs: 233, url: 'https://www.unipd.it/en/educational-offer', courses: [['data', 'Data Science', 'pg'], ['computing', 'Computer Engineering', 'pg']] },
    { name: 'University of Milan', city: 'Milan', country: 'italy', founded: '1924', type: 'Public', qs: 276, url: 'https://www.unimi.it/en/education', courses: [['data', 'Data Science and Economics', 'pg'], ['social', 'International Politics, Law and Economics', 'ug']] },
    { name: 'Bocconi University', city: 'Milan', country: 'italy', founded: '1902', type: 'Private', qs: null, url: 'https://www.unibocconi.it/en/programs', courses: [['economics', 'Economics and Management', 'ug'], ['economics', 'Finance', 'pg']] },
    { name: 'University of Florence', city: 'Florence', country: 'italy', founded: '1321', type: 'Public', qs: null, url: 'https://www.unifi.it/en/study', courses: [['hospitality', 'Design of Sustainable Tourism Systems', 'pg'], ['economics', 'Economics and Development', 'pg']] },
    // Finland
    { name: 'Aalto University', city: 'Espoo', country: 'finland', founded: '2010', type: 'Public', qs: 114, url: 'https://www.aalto.fi/en/study-at-aalto', courses: [['computing', 'Computer Science', 'pg'], ['design', 'Design', 'pg'], ['business', 'International Business (BBA)', 'ug']] },
    { name: 'University of Helsinki', city: 'Helsinki', country: 'finland', founded: '1640', type: 'Public', qs: 116, url: 'https://www.helsinki.fi/en/admissions-and-education', courses: [['data', 'Data Science', 'pg'], ['science', 'Science', 'ug']] },
    { name: 'Tampere University', city: 'Tampere', country: 'finland', founded: '2019', type: 'Public', qs: 423, url: 'https://www.tuni.fi/en/study-with-us', courses: [['computing', 'Computing Sciences', 'pg'], ['engineering', 'Engineering', 'pg']] },
    { name: 'University of Turku', city: 'Turku', country: 'finland', founded: '1920', type: 'Public', qs: 366, url: 'https://www.utu.fi/en/study-at-utu', courses: [['computing', 'Information and Communication Technology', 'pg'], ['science', 'Biomedical Sciences', 'pg']] },
];
