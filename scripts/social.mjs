/* Where Gradmire can be reached online: the one list behind the footer icons on every page. The phone menu copies its
   icons from the footer at run time, so the two can never disagree.

   HOW TO ADD A PROFILE: paste the full address of the real page into `url` (for example
   'https://www.instagram.com/yourhandle'), then run:  node scripts/sync-footer.mjs
   That adds the icon to every footer and the phone menu and the address to `sameAs` in the homepage structured data.
   The icon opens that page in a new tab. A network whose `url` is empty still shows its icon, as a quiet placeholder that
   is not a link, so nothing ever points at a page that does not exist. The homepage `sameAs` list is filled in from this
   file automatically (scripts/same-as.mjs).

   Email and WhatsApp are Gradmire's own contact details, the same as on the Contact page. */

const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const profiles = [
    { key: 'email', label: 'Email Gradmire', url: 'mailto:info@gradmire.com',
      icon: svg('<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7.5 7.5 5.8 7.5-5.8"/>') },
    { key: 'whatsapp', label: 'Chat with Gradmire on WhatsApp', url: 'https://wa.me/918577909702?text=Hi+Gradmire%2C+I+have+a+query+about+studying+abroad.',
      icon: svg('<path d="M4 20l1.2-4.2A8 8 0 1 1 8.3 18.9z"/><path d="M9.2 9.3c.3 2.5 2.4 4.6 5.1 5.2l.9-1.1-1.7-.9-.8.6a4 4 0 0 1-1.9-1.9l.7-.8-.9-1.7z"/>') },
    { key: 'instagram', label: 'Gradmire on Instagram', url: '',
      icon: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".7" fill="currentColor"/>') },
    { key: 'facebook', label: 'Gradmire on Facebook', url: '',
      icon: svg('<path d="M14.5 4.5h-2A3.5 3.5 0 0 0 9 8v2H6.5v3.2H9V20h3.4v-6.8h2.4l.5-3.2h-2.9V8.4c0-.5.4-.9.9-.9h1.7z"/>') },
    { key: 'linkedin', label: 'Gradmire on LinkedIn', url: '',
      icon: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 10.5v6M8 7.6v.01M12 16.5v-6m0 3c0-1.7 1-3 2.6-3s2.4 1.1 2.4 3v3"/>') },
    { key: 'youtube', label: 'Gradmire on YouTube', url: '',
      icon: svg('<rect x="3" y="6" width="18" height="12" rx="3.5"/><path d="m10.5 9.5 4 2.5-4 2.5z"/>') },
    { key: 'x', label: 'Gradmire on X', url: '',
      icon: svg('<path d="M5 5l14 14M19 5 5 19"/>') }
];

/* The icon row for the footer. A profile with an address is a link that opens that page in a new tab. A profile without one
   is shown as a quiet, non-clickable placeholder (no link at all, hidden from screen readers), so the row is complete
   today and nothing points at a page that does not exist. */
export function socialHtml() {
    const items = profiles.map((p) => {
        if (!p.url) {
            const name = p.label.replace(/^Gradmire on /, '');
            return `<span class="gm-social-link is-soon" title="${name}: coming soon" aria-hidden="true">${p.icon}</span>`;
        }
        const external = !p.url.startsWith('mailto:');
        return `<a class="gm-social-link" href="${p.url}" aria-label="${p.label}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${p.icon}</a>`;
    });
    return `<div class="gm-footer-social" role="group" aria-label="Contact and social links">${items.join('')}</div>`;
}
