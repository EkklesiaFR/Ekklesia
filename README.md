# Ekklesia

Application Next.js / Firebase de scrutins par classement et dépouillement Schulze.

- [Architecture et parcours réels](docs/ARCHITECTURE.md)
- [Fiabilisation du vote, compatibilité et déploiement](docs/VOTE_INTEGRITY.md)

Node 22, Java 21. Installer avec `npm ci` puis exécuter `npm run lint`,
`npm run typecheck`, `npm run test:run`, `npm run test:emulator`, `npm run build`.
Pour la recette navigateur locale : `npx playwright install chromium`, `npm run test:browser`.
Les tests utilisent exclusivement le projet fictif `demo-ekklesia-test`.
