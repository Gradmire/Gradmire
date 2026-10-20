/* Facts for the destination pages, applied by update-destinations.mjs.
   Ranks: QS World University Rankings 2026 (published June 2025), checked October 2026.
   A university with no confirmed overall QS 2026 rank gets no rank badge.
   City lists name the universities in or next to each city; the badge shows "N+"
   because smaller colleges are not all listed. */

export const RANK_LABEL = 'QS 2026';

export const pages = {
    uk: {
        file: 'study-in-uk.html',
        ranks: { 'University of Oxford': 4, 'University of Cambridge': 6, 'UCL, London': 9, 'Imperial College London': 2, 'University of Edinburgh': 34, 'University of Manchester': 35, 'King\'s College London': 31, 'University of Warwick': 74 },
        cities: {
            London: ['Imperial', 'UCL', 'King\'s College London', 'LSE', 'Queen Mary', 'City St George\'s', 'Brunel', 'Westminster'],
            Edinburgh: ['University of Edinburgh', 'Heriot-Watt', 'Edinburgh Napier', 'Queen Margaret'],
            Manchester: ['University of Manchester', 'Manchester Metropolitan', 'Royal Northern College of Music'],
            Oxford: ['University of Oxford', 'Oxford Brookes'],
            Cambridge: ['University of Cambridge', 'Anglia Ruskin'],
            Birmingham: ['University of Birmingham', 'Aston', 'Birmingham City', 'Newman', 'University College Birmingham']
        },
        cityCounts: { London: '40+' }
    },
    usa: {
        file: 'study-in-usa.html',
        ranks: { MIT: 1, 'Stanford University': 3, 'Harvard University': 5, 'Carnegie Mellon': 52, 'Univ. of Michigan': 45, 'Columbia University': 38, 'Univ. of Illinois': 70, 'Purdue University': 88 },
        cities: {
            'New York City': ['Columbia', 'NYU', 'Fordham', 'The New School', 'CUNY colleges'],
            Boston: ['MIT', 'Harvard', 'Boston University', 'Northeastern', 'Tufts'],
            'San Francisco Bay Area': ['Stanford', 'UC Berkeley', 'UCSF', 'San José State', 'Santa Clara'],
            Chicago: ['UChicago', 'Northwestern', 'UIC', 'Loyola', 'DePaul'],
            Pittsburgh: ['Carnegie Mellon', 'Pitt', 'Duquesne'],
            'Austin, Texas': ['UT Austin', 'St. Edward\'s', 'Huston-Tillotson']
        }
    },
    canada: {
        file: 'study-in-canada.html',
        ranks: { 'University of Toronto': 29, 'UBC, Vancouver': 40, 'McGill University': 27, 'University of Waterloo': 119, 'Queen\'s University': 191, 'Western University': 151, 'Dalhousie University': 283, 'Simon Fraser University': 308 },
        cities: {
            Toronto: ['U of T', 'Toronto Metropolitan', 'York', 'OCAD'],
            Vancouver: ['UBC', 'SFU', 'Emily Carr'],
            Montreal: ['McGill', 'Concordia', 'Université de Montréal', 'UQAM'],
            'Waterloo / Kitchener': ['Waterloo', 'Wilfrid Laurier'],
            Ottawa: ['uOttawa', 'Carleton'],
            'Calgary / Edmonton': ['U of Calgary', 'U of Alberta', 'Mount Royal', 'MacEwan']
        }
    },
    australia: {
        file: 'study-in-australia.html',
        ranks: { 'Univ. of Melbourne': 19, 'ANU, Canberra': 32, 'Univ. of Sydney': 25, 'UNSW Sydney': 20, 'Univ. of Queensland': 42, 'Monash University': 36, 'Adelaide University': 82 },
        rename: { 'Univ. of Adelaide': 'Adelaide University' },
        cities: {
            Sydney: ['Univ. of Sydney', 'UNSW', 'UTS', 'Macquarie', 'Western Sydney'],
            Melbourne: ['Univ. of Melbourne', 'Monash', 'RMIT', 'Deakin', 'La Trobe', 'Swinburne'],
            Brisbane: ['UQ', 'QUT', 'Griffith'],
            Canberra: ['ANU', 'University of Canberra'],
            Perth: ['UWA', 'Curtin', 'Murdoch', 'Edith Cowan'],
            Adelaide: ['Adelaide University', 'Flinders']
        }
    },
    germany: {
        file: 'study-in-germany.html',
        ranks: { 'Technical University of Munich': 22, 'Ludwig Maximilian University (LMU)': 58, 'Heidelberg University': 80 },
        cities: {
            Munich: ['TUM', 'LMU', 'Munich University of Applied Sciences'],
            Berlin: ['Humboldt', 'Freie Universität', 'TU Berlin', 'Berlin University of the Arts'],
            Heidelberg: ['Heidelberg University', 'SRH University Heidelberg'],
            Aachen: ['RWTH Aachen', 'FH Aachen'],
            Hamburg: ['University of Hamburg', 'TU Hamburg', 'HAW Hamburg'],
            Stuttgart: ['University of Stuttgart', 'University of Hohenheim', 'HFT Stuttgart']
        }
    },
    ireland: {
        file: 'study-in-ireland.html',
        ranks: { 'Trinity College Dublin': 75, 'University College Dublin (UCD)': 118, 'University College Cork (UCC)': 246, 'University of Galway (NUIG)': 284, 'University of Limerick (UL)': 401, 'Dublin City University (DCU)': 410, 'Maynooth University': 771, 'Technological University Dublin': 781 },
        cities: {
            Dublin: ['Trinity', 'UCD', 'DCU', 'TU Dublin'],
            Cork: ['UCC', 'Munster Technological University'],
            Galway: ['University of Galway', 'Atlantic Technological University'],
            Limerick: ['University of Limerick', 'TUS', 'Mary Immaculate College'],
            Maynooth: ['Maynooth University'],
            Waterford: ['South East Technological University']
        }
    },
    italy: {
        file: 'study-in-italy.html',
        ranks: { 'University of Bologna': 138, 'Sapienza University of Rome': 128, 'Politecnico di Milano': 98, 'University of Padua': 233, 'University of Milan': 276, 'Politecnico di Torino': 242 },
        cities: {
            Milan: ['Politecnico di Milano', 'Bocconi', 'University of Milan', 'Milano-Bicocca', 'Cattolica'],
            Rome: ['Sapienza', 'Tor Vergata', 'Roma Tre', 'LUISS'],
            Bologna: ['University of Bologna'],
            Florence: ['University of Florence'],
            Turin: ['Politecnico di Torino', 'University of Turin'],
            Naples: ['Federico II', 'L\'Orientale', 'Parthenope']
        }
    },
    newzealand: {
        file: 'study-in-newzealand.html',
        ranks: { 'University of Auckland': 65, 'University of Otago': 197, 'Victoria University of Wellington': 240, 'University of Canterbury': 261, 'Massey University': 230, 'University of Waikato': 281, 'Lincoln University': 407, 'AUT — Auckland Univ. of Technology': 410 },
        cities: {
            Auckland: ['University of Auckland', 'AUT'],
            Wellington: ['Victoria University of Wellington', 'Massey (Wellington campus)'],
            Christchurch: ['University of Canterbury', 'Lincoln University (nearby)'],
            Dunedin: ['University of Otago'],
            Hamilton: ['University of Waikato'],
            Queenstown: []
        }
    },
    finland: {
        file: 'study-in-finland.html',
        ranks: { 'University of Helsinki': 116, 'Aalto University': 114, 'Tampere University': 423, 'University of Turku': 366 },
        cities: {
            'Helsinki &amp; Espoo': ['University of Helsinki', 'Aalto', 'Hanken', 'Uniarts Helsinki'],
            'Tampere &amp; Turku': ['Tampere University', 'University of Turku', 'Åbo Akademi']
        }
    }
};

/* Displayed university name on a destination page → its Course Finder entry (course-data.mjs).
   Names that already match exactly are not listed. */
export const finderNames = {
    'UCL, London': 'UCL (University College London)',
    MIT: 'Massachusetts Institute of Technology (MIT)',
    'Carnegie Mellon': 'Carnegie Mellon University',
    'Univ. of Michigan': 'University of Michigan',
    'Univ. of Illinois': 'University of Illinois Urbana-Champaign',
    'UBC, Vancouver': 'University of British Columbia',
    'Univ. of Melbourne': 'University of Melbourne',
    'ANU, Canberra': 'Australian National University',
    'Univ. of Sydney': 'University of Sydney',
    'Univ. of Queensland': 'University of Queensland',
    'Technical University of Munich': 'Technical University of Munich (TUM)',
    'RWTH Aachen University': 'RWTH Aachen University',
    'Frankfurt School of Finance &amp; Management': 'Frankfurt School of Finance & Management',
    'University College Dublin (UCD)': 'University College Dublin',
    'University College Cork (UCC)': 'University College Cork',
    'University of Galway (NUIG)': 'University of Galway',
    'University of Limerick (UL)': 'University of Limerick',
    'Dublin City University (DCU)': 'Dublin City University',
    'AUT — Auckland Univ. of Technology': 'Auckland University of Technology (AUT)'
};
