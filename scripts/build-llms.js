#!/usr/bin/env node
/**
 * Build llms.txt and llms-full.txt from the HACKATHONS array in index.html.
 *
 * This keeps the LLM-facing files in sync with the canonical event data
 * whenever the site is updated. Run locally with `node scripts/build-llms.js`
 * or wire it into a GitHub Action on push to main.
 *
 * Outputs:
 *   - /llms.txt        (short directory summary, llmstxt.org spec)
 *   - /llms-full.txt   (expanded directory with every event listed)
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(REPO_ROOT, 'index.html');
const LLMS_PATH = path.join(REPO_ROOT, 'llms.txt');
const LLMS_FULL_PATH = path.join(REPO_ROOT, 'llms-full.txt');

const SITE_URL = 'https://www.quantumhackathons.com';
const CONTACT_EMAIL = 'brian.pearson@qbraid.com';

// --- Extract HACKATHONS array -------------------------------------------------

function extractHackathons(html) {
  const match = html.match(/const\s+HACKATHONS\s*=\s*(\[[\s\S]*?\n\];)/);
  if (!match) {
    throw new Error('Could not find HACKATHONS array in index.html');
  }
  // The array uses unquoted keys and trailing commas, so parse via VM
  const src = match[1].replace(/;\s*$/, '');
  const context = {};
  vm.createContext(context);
  return vm.runInContext(`(${src})`, context);
}

// --- Utility -----------------------------------------------------------------

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isUpcoming(ev) {
  return ev.dateSort && ev.dateSort >= today();
}

function byDate(a, b) {
  return (a.dateSort || '').localeCompare(b.dateSort || '');
}

function byDateDesc(a, b) {
  return (b.dateSort || '').localeCompare(a.dateSort || '');
}

function formatLabel(ev) {
  const fmt = ev.format ? ev.format.replace('-', ' ') : '';
  return fmt ? ` (${fmt})` : '';
}

// --- Render llms.txt (short) -------------------------------------------------

function renderShort(events) {
  const upcoming = events.filter(isUpcoming).sort(byDate);
  const countries = new Set();
  for (const ev of events) {
    const tail = ev.location && ev.location.split(',').pop().trim();
    if (tail) countries.add(tail);
  }

  const totalCount = events.length;
  const upcomingCount = upcoming.length;
  const years = [...new Set(events.map((e) => e.year))].sort();

  const lines = [];
  lines.push('# Quantum Hackathons');
  lines.push('');
  lines.push(
    `> Global, community-maintained directory of quantum computing hackathons. Currently tracking ${totalCount} events (${upcomingCount} upcoming), maintained by qBraid as an open resource for the quantum developer community.`
  );
  lines.push('');
  lines.push(
    `The directory covers in-person, virtual, and hybrid quantum hackathons hosted by universities, research labs, hardware providers, and foundations. Events span ${years[0]} through ${years[years.length - 1]}. Each listing includes the host organization, dates, format, location, sponsors, and a link to the official event page. New events can be submitted to ${CONTACT_EMAIL}.`
  );
  lines.push('');
  lines.push('## Main pages');
  lines.push('');
  lines.push(
    `- [Quantum Hackathons Home](${SITE_URL}/): Interactive directory filterable by year, format (in-person, virtual, hybrid), and upcoming vs past.`
  );
  lines.push(`- [llms-full.txt](${SITE_URL}/llms-full.txt): Expanded directory with every tracked event.`);
  lines.push('');
  lines.push('## Upcoming events');
  lines.push('');
  for (const ev of upcoming.slice(0, 15)) {
    lines.push(`- [${ev.name}](${ev.url}): ${ev.date}, ${ev.location}${formatLabel(ev)}. Host: ${ev.org}.`);
  }
  if (upcoming.length > 15) {
    lines.push(`- See llms-full.txt for the remaining ${upcoming.length - 15} upcoming events.`);
  }
  lines.push('');
  lines.push('## Categories');
  lines.push('');
  lines.push('- In-person quantum hackathons');
  lines.push('- Virtual quantum hackathons');
  lines.push('- Hybrid quantum hackathons');
  lines.push(`- By year: ${years.join(', ')}`);
  lines.push(`- By country: ${[...countries].sort().join(', ')}`);
  lines.push('');
  lines.push('## Related resources');
  lines.push('');
  lines.push('- [qBraid](https://qbraid.com): Quantum computing platform, directory maintainer.');
  lines.push('- [qBraid Lab](https://account.qbraid.com): Cloud quantum development environment, free for hackathon participants.');
  lines.push('- [qBraid SDK](https://github.com/qBraid/qBraid): Open-source, hardware-agnostic quantum SDK.');
  lines.push('- [Year of Illinois Quantum](https://www.yearofquantum.org): Companion community site.');
  lines.push('');
  lines.push('## Optional');
  lines.push('');
  lines.push(`- [Submit a hackathon](mailto:${CONTACT_EMAIL}): Add a new event or correction.`);
  lines.push('- [qBraid blog](https://qbraid.com/blog)');
  lines.push('- [qBraid Pilots](https://qbraid.com/pilots)');
  lines.push('');
  return lines.join('\n');
}

// --- Render llms-full.txt (expanded) ----------------------------------------

function renderFull(events) {
  const upcoming = events.filter(isUpcoming).sort(byDate);
  const past = events.filter((e) => !isUpcoming(e)).sort(byDateDesc);

  const lines = [];
  lines.push('# Quantum Hackathons');
  lines.push('');
  lines.push('> Global directory of past, current, and upcoming quantum computing hackathons, maintained by qBraid.');
  lines.push('');
  lines.push(`Source: ${SITE_URL} | Last generated: ${today()}`);
  lines.push('');
  lines.push('## About');
  lines.push('');
  lines.push(
    `Quantum Hackathons is an open, community-maintained directory of quantum computing hackathons held around the world. The site is maintained by qBraid, a hardware-agnostic quantum computing platform headquartered in Chicago, Illinois, and serves as a free resource for students, researchers, developers, and industry professionals looking to participate in quantum programming challenges.`
  );
  lines.push('');
  lines.push(`Currently tracking ${events.length} events (${upcoming.length} upcoming). Events can be submitted by emailing ${CONTACT_EMAIL}.`);
  lines.push('');

  const renderEvent = (ev) => {
    lines.push(`### ${ev.name}`);
    lines.push('');
    lines.push(`- Host: ${ev.org}`);
    lines.push(`- Date: ${ev.date}`);
    lines.push(`- Location: ${ev.location}`);
    lines.push(`- Format: ${ev.format}`);
    if (ev.sponsors && ev.sponsors.length) {
      lines.push(`- Sponsors: ${ev.sponsors.join(', ')}`);
    }
    lines.push(`- URL: ${ev.url}`);
    lines.push('');
  };

  lines.push('## Upcoming events');
  lines.push('');
  if (upcoming.length === 0) {
    lines.push('No upcoming events currently tracked.');
    lines.push('');
  } else {
    upcoming.forEach(renderEvent);
  }

  lines.push('## Past events');
  lines.push('');
  past.forEach(renderEvent);

  lines.push('## How to submit an event');
  lines.push('');
  lines.push(`To add a hackathon, email ${CONTACT_EMAIL} with the event name, host, dates, format, location, official URL, and a short description.`);
  lines.push('');
  lines.push('## Contact');
  lines.push('');
  lines.push('Brian Pearson, Head of Business Development, qBraid');
  lines.push(CONTACT_EMAIL);
  lines.push('');
  return lines.join('\n');
}

// --- Main ---------------------------------------------------------------------

function main() {
  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const events = extractHackathons(html);

  const shortContent = renderShort(events);
  const fullContent = renderFull(events);

  fs.writeFileSync(LLMS_PATH, shortContent);
  fs.writeFileSync(LLMS_FULL_PATH, fullContent);

  console.log(`Wrote ${events.length} events to llms.txt and llms-full.txt`);
}

main();
