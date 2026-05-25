# Test Credentials for Lumina-SIS

## Sunflower Academy (SUNF)
- **School Code:** SUNF
- **Admin Username:** admin
- **Admin Password:** Admin@123
- **Teacher Username:** sarah.thompson.sunf
- **Teacher Password:** Teacher@123

## Riverside International School (RVSD)
- **School Code:** RVSD
- **Admin Username:** admin
- **Admin Password:** Admin@123
- **Teacher Username:** elizabeth.anderson.rvsd
- **Teacher Password:** Teacher@123

## JTECH Innovations (Original - Empty)
- **School Code:** JTECH
- **Superuser Username:** JTECH
- **Superuser Email:** jtech.innovations@outlook.com
- **Superuser On-file Email:** jhemounejohnson1000@gmail.com (Resend-verified destination)
- **Superuser Password:** Xekleidoma@1

## Email (Resend) — Test Mode
- `RESEND_API_KEY` is set in `/app/backend/.env`.
- In test mode, Resend only delivers to the address you signed up with: **jhemounejohnson1000@gmail.com**.
- The JTECH superuser's `email` field has been set to that address so the Forgot-Password flow can be tested end-to-end.
- To send to ANY recipient (e.g. SUNF admin's `info@sunfloweracademy.edu.gh`):
  1. Verify a domain at https://resend.com/domains
  2. Update `SENDER_EMAIL` in `/app/backend/.env` to a `no-reply@your-domain.com`
  3. `sudo supervisorctl restart backend`

## Notes
- Both SUNF and RVSD have complete dummy data
- SUNF has 147 students across 12 classes
- RVSD has 152 students across 12 classes
- All accounts use Admin@123 for admins and Teacher@123 for teachers
