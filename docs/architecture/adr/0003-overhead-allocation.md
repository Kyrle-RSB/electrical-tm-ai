# ADR 0003: Daily overhead half-day allocation (OWNER DECISION PENDING)

The owner approved daily estimated overhead and calendar project participation units of 0.5 or 1.0 day. Owner DID NOT approve how remaining overhead is distributed when total entered participation is below a full workday.

Given $300 of daily overhead and a single half-day project:

- **A, capacity-aware (recommended):** allocate $150 to the project and record $150 as unallocated overhead. Full-day capacity is the baseline denominator; total allocated can be less than daily overhead. Makes project margin visible without making a half-day project absorb office overhead incurred while idle.
- **B, all-to-active-project:** allocate all $300 to the one half-day project. Every dollar of overhead on a date goes to active work, potentially producing volatile estimates on slow days.

When total participation exceeds one day (e.g. two half-day jobs and one full-day job), both models allocate by relative half-day weights across the day's work unless a separate capacity policy is approved. Both require deterministic cent remainders and immutable historical snapshots once used for an issued estimate/report.

**Blocking owner question:** Approve A, B, or specify a third rule. Do not implement one as approved business behavior. Until answered, keep the estimated-profit overhead finalization gate blocked.
