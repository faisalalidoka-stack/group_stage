# Group Stage: verification checklist

Nothing here changes your data. Do it in this order and tell me the result of each step.

## 1. Database (about 2 minutes)

1. Supabase dashboard > SQL Editor > New query.
2. Paste the whole of `verify.sql` and run it.
3. Send me every row whose status is not `OK` or `INFO`, plus all rows in the
   `tournaments` section.

What the statuses mean:

| Status  | Meaning                                                   |
|---------|-----------------------------------------------------------|
| OK      | present and as expected                                   |
| MISSING | a migration has not been applied yet (safe to apply)      |
| WARN    | works, but needs attention                                |
| FAIL    | a security or data problem. Fix before going further      |

If rows say MISSING, run the named file(s) in order: `phase1.sql`, `phase2.sql`, `phase3.sql`,
`phase4.sql`, `phase5.sql`, then run `verify.sql` again. Do not run `policies.sql` on a
database that already has policies; it is only for a fresh setup.
If a phase fails with an error, send me the exact error text and do not retry.

## 2. Authentication settings (Supabase dashboard)

- Authentication > URL Configuration:
  - Site URL: `http://localhost:3000` while developing.
  - Redirect URLs: add `http://localhost:3000/auth/callback`.
  - When you deploy, add the production URL's `/auth/callback` as well.
- The built-in email sender has a very low hourly limit. That is the rate limit
  you hit earlier. To test without sending any email:
  Authentication > Users > Add user > Create new user, tick "Auto Confirm User".
  Before real use, configure a custom SMTP provider under Authentication > SMTP Settings.

## 3. App tests (run with `npm run dev`)

Mark each Pass or Fail, and copy any error message shown on screen.

| #  | Test                                                                                              | Expected |
|----|---------------------------------------------------------------------------------------------------|----------|
| 1  | Create an account on `/`                                                                          | "Account created, check your email" |
| 2  | Open the confirmation link in the same browser                                                    | You land on `/dashboard` signed in |
| 3  | (Optional) open a confirmation link on a different device                                         | Sign-in page with a message; your password still works afterwards |
| 4  | Sign out, then sign in again                                                                      | `/dashboard` lists every tournament you own, including Block C Campus Cup if you are its owner |
| 5  | Sign in with a wrong password                                                                     | A clear error, no crash |
| 6  | "Forgot password", open the emailed link                                                          | `/auth/reset` asks for a new password |
| 7  | Set a new password, sign out, sign in with it                                                     | Works |
| 8  | Sign in as a SECOND account, open `/admin/block-c-campus-cup-test`                                | "Access denied" |
| 9  | In a private window (signed out), open `/t/block-c-campus-cup-test`                               | Public page loads, no sign-in needed |
| 10 | Create a new throwaway tournament, then archive and restore it                                    | Moves between Active and Archived |
| 11 | Delete the throwaway tournament. Never delete Block C Campus Cup while testing                    | Disappears from the list |
| 12 | In Teams > Players, add two players with the same shirt number in one team                        | Second one is refused with a clear message |
| 13 | Registration tab: create a link, open it in a private window, submit a player, approve it         | Player appears in the squad |

## 4. What to send me

1. The non-OK rows and the `tournaments` rows from `verify.sql`.
2. Pass or Fail for tests 1-13, with error text for any failure.
3. Your latest project as a ZIP, so I can compare it with my copy before changing anything.
   Exclude `node_modules`, `.next` and `.env.local`. Never send keys or secrets.
