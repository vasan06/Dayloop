# DayLoop product foundation

## Positioning
DayLoop is a personal-first life operating space. It combines Notion-like flexible knowledge, Todoist-like task execution, habit consistency, personal growth and practical life administration.

## Core modules
1. Home — daily command center and configurable widgets.
2. Tasks and projects — inbox, priorities, subtasks, dependencies, recurring tasks, boards, list, calendar and timeline.
3. Notes — nested pages, structured blocks, collections, tags, backlinks, templates, revisions and attachments.
4. Habits — flexible schedules, targets, history, streaks and recovery.
5. Goals and growth — milestones, skills, learning plans, journal and periodic reviews.
6. Finance — income, expenses, categories, budgets, savings goals and simple reports.
7. Trackers — focus sessions, time entries and custom numeric trackers.
8. Calendar — events, deadlines, reminders and recurring schedules.
9. Notifications — in-app first, with optional email and browser push adapters.
10. Search and analytics — global search and evidence-based summaries.

## Product constraints
- Personal-first; data model permits future workspace expansion without shipping collaboration prematurely.
- Basic finance only; no bank sync, investment management or tax filing in the initial scope.
- Web is completed and tested before mobile work begins.
- Offline support is a core capability, with conflict-aware synchronization.
- No paid subscriptions or paid infrastructure as a requirement.
- All user data is private by default.

## Design direction
Warm editorial utility: parchment canvas, aubergine/plum structure, persimmon action accents, saffron warmth, and restrained lilac/sage supporting colors. Avoid generic blue-grey-green SaaS styling. Build both light and dark themes from semantic tokens; preserve contrast and keyboard accessibility.

## Engineering constraints
- Python backend uses cohesive `def` and `async def` functions only in application code.
- No authored application classes or ORM model classes.
- PostgreSQL with SQL migrations and parameterized SQL.
- Firebase Authentication email/password; backend verifies Firebase ID tokens.
- Local attachment storage behind authenticated API routes.
- PostgreSQL-backed jobs; no Redis requirement.
- Free/open-source-first stack; document all external service limits and alternatives.
