# **App Name**: Ekklesia Vote

## Core Features:

- Secure User Authentication & Roles: User registration and login via Firebase Authentication (email/password). Assign 'admin' or 'member' roles stored in Firestore, with membership status.
- Session & Project Management (Admin): Admins can create new voting sessions, defining announcement, open, and close times. They can also add and manage up to 5 projects per session, including titles, summaries, budgets, and asset URLs. Includes a tool to generate project summaries.
- Project Overview (Member): Members can view project details for an upcoming session once the announcement time has passed, ensuring projects are displayed consistently and clearly.
- Ranked Voting System (Member): During the live voting window, members can rank active projects via a drag-and-drop interface. Ballots are submitted as final and cannot be edited, with server-side validation using a Cloud Function.
- Live Voting Turnout & Countdown: During the active voting window, members see a real-time countdown to vote closure and the current number of submitted ballots, without revealing live results.
- Automated Vote Tallying: A Cloud Function is triggered automatically at vote close (with manual fallback) to compute results using the Condorcet method with Schulze tie-breaking, then stores the ranking and winner.
- Published Results Display: Once an admin publishes the results, members can view the final winner, the full project ranking, and total ballot count for the session.
- Project Structure & Code Quality: The project will adhere to a clean modular folder structure: /app (frontend), /lib (firebase config), /functions (Cloud Functions separate), /types (TypeScript interfaces), /tests (unit tests for Schulze). Code will be modular, readable, and well-documented for easy CTO handover.
- Email Allowlist Management (Admin): Admins can manage an allowlist of emails for user registration and voting. This includes adding and removing emails via a dedicated admin screen.
- Email Allowlist Enforcement: Only users whose emails are on the allowlist can sign up and submit ballots. This is enforced at user registration and before submitting a ballot.
- Single Upcoming Session Focus: The user experience for members is streamlined to focus solely on the next upcoming voting session, simplifying navigation and information display.
- Admin 'Dry Run Tally' Button: Admins can trigger a 'dry run' tally computation after the voting window closes, using current ballots, without publishing the results. This provides a preview of the outcome.
- Admin 'Export Data' Button: Admins can download session metadata and tallies as a JSON file, facilitating data portability and CTO handover.

## Style Guidelines:

- Main background: Pure white (#FFFFFF) for a clean, spacious, and institutional canvas across all pages.
- Neutral Separators: Subtle light grey (#E3E3E3) for borders, dividers, and outlining content blocks without creating heavy visual weight.
- Primary Text: Deep black (#000000) for all text to ensure maximum readability and a formal, solemn tone.
- Primary Accent: A restrained green (#7DC092) used very sparingly for interactive elements, selected states, subtle highlights, and critical actions like confirmation buttons, aligning with a civic and understated feel. It will also be used for links.
- Font Family: Exclusively 'Figtree' (sans-serif) for all text elements throughout the application.
- Typographic Hierarchy: Achieved through variations in Figtree font size and weight, and ample line-height. Large titles (e.g., 'Assemblée Ekklesia — {Month Year}', 'Projet retenu') will use Figtree bold. Section titles ('Projets soumis au vote', 'Classement complet') will use Figtree semi-bold. Body text, status labels, and countdowns will use Figtree regular weight.
- Letter Spacing: Standard letter spacing for body text. Slightly more generous letter spacing for prominent titles and headlines to enhance legibility and an editorial feel, matching the Framer website's aesthetic.
- Global Structure: Content is strictly confined to a centered column with a maximum width of 900px, flanked by large areas of whitespace. No sidebars or dashboard grids are used.
- Vertical Spacing: Generous vertical spacing between all elements and sections, creating a calm, uncrowded, and deliberate reading experience, emphasizing a civic and editorial tone.
- Content Blocks: Projects and other distinct content items are presented in simple blocks with a white background and subtle 1px borders in light grey (#E3E3E3). No shadows, colorful cards, or heavy visual treatments are permitted.
- Minimal Navigation: A minimal top header containing a simple 'Ekklesia' logo/text, a small session status indicator, and a minimalist 'Logout' link. No complex navigation menus are present.
- Voting UI: Ranked drag-and-drop list items will be simple blocks with a white background and subtle borders in light grey (#E3E3E3). Each item displays a position number, title, and a minimal line icon for dragging. The selected/dragged state uses a thin border in the primary accent green (#7DC092) without any background fill.
- Confirmation Buttons: Buttons like 'Confirmer mon bulletin' will have either a black (#000000) background with white text, or the primary accent green (#7DC092) background with white text, maintaining visual sobriety.
- Results Display: Designed to feel like an official proclamation. Prominent project name, total ballots, and full ranking presented clearly. No celebratory graphics, confetti, charts, or live score visuals are included, aligning with the solemn tone.
- Extremely minimalist, line-based icons, used very sparingly to convey actions and statuses (e.g., drag handle for ranking). No decorative, playful, or filled icons are permitted, ensuring alignment with the calm, institutional aesthetic.
- Transitions: All view transitions will use subtle fade effects with a duration of 200-300ms.
- Interactions: Animations are limited to subtle and purposeful feedback for state changes (e.g., hover effects on buttons, ballot submission confirmation) and smooth drag-and-drop interactions for ranking.
- Constraints: No bounce, scale effects, or any playful/flashy animations are allowed. All animations must be understated and deliberate, consistent with the calm, institutional, and solemn UX tone.