# WorkHub Agent Rules

- Never count or paginate resources before authorization filtering. `totalElements` must reflect only resources readable by the current user.
- Locked/disabled users must be blocked at auth/login.
- Do not infer department/project membership from fields that are not modeled.
