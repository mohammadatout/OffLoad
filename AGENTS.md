## Learned User Preferences
- Keep responses brief and direct, start with a summary, and expand only when asked.
- Number the points in a response so the user can give feedback by point number.
- Use plain business language and ask simple, focused clarifying questions.
- Do not write code, create plans, or make changes until the user explicitly approves; do not assume missing requirements.
- Stay within the requested scope, skip unrequested evaluation or validation write-ups, and present optional suggestions concisely without implementing them.
- For larger builds, split work across developer, QA, and critic/product-manager roles, and act on the critic's feedback rather than only validating what was done.
- When asked to run the app, start all backend and frontend servers together and open it in the Cursor browser.
- Protect matching-engine accuracy and performance; test current behavior before core changes, and ask with concise pros/cons when a change is risky.
- When finalizing meaningful work, keep the relevant README, log, and handoff notes current and clearly confirm commit, branch, and remote status.

## Learned Workspace Facts
- OffLoad normalizes messy organization data, matches it to Cisco account references, supports human review, and remembers approved matches for reuse.
- The main product areas are Normalization, Matching Engine, Match Library, and Account Executive Allocation.
- The frontend is a Next.js/TypeScript app, while matching, authentication, and persistence use FastAPI and SQLite; normalization runs client-side.
- `Matching_Engine/entity_matcher_v4.py` is the sensitive scoring core and should be wrapped rather than modified.
- A SAV/SFDC account is an account-level record that rolls up to a SAVM group; the app imports one precomputed reference dataset rather than merging separate feeds.
- For AE resolution, an SFDC-level match keeps that exact account row's AE, while a SAVM-level match ranks child rows by nomination priority.
- `Snowflake_AE_Nomination` is the upstream SQL that creates the account-owner nomination reference; its priority order runs from strongest agreement to SAV-only.
- `.cursor/plans/RoadMap ThreePhases.md` holds the phased delivery plan; record completed tasks under the relevant phase section as work lands.
- AE Allocation filters use business labels rather than raw column names: Sales Levels 2-6 show as Theater, Area, Operation, Region, and Account; `SAVM_ID` as SAV ID; `NODE_SUBSEGMENT` as Tier; `SAV_VERTICAL_TOP` as SAV Vertical; `Unified_Account_Name` as Unified Acc. Name.
- Admin owns the AE accounts reference table: upload from the SAV/AM/SFDC goal template, choose which columns appear in AE Allocation, and export or purge the table.
- `.cursor/skills/design/SKILL.md` defines the house cream-editorial UI system and is the reference for any new or restyled interface.
