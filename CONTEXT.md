# Acme

One paragraph: what this system does and for whom. Replace this file's content as the domain takes shape; keep one term per concept.

## Language

**Claim (報銷)**:
An expense a user submits for reimbursement. Belongs to exactly one owner. Template example; replace it.
_Avoid_: expense, request

**Owner**:
The signed-in user a row belongs to, stored as the auth token subject (`ownerId`).
_Avoid_: user id (ambiguous across auth providers), creator

**Monthly quota (每月額度)**:
The most one owner may claim in a UTC calendar month. A claim that would exceed it is rejected.

**Auto-approve limit**:
Claims at or below this amount are approved on submit; larger ones stay pending.

## Relationships

- An owner has many claims.
- The claim rule (`packages/domain/src/claims`) decides a claim's status from the claim and the owner's month-to-date total.
