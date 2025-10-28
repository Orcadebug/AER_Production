   curl -X POST 'https://api.resend.com/emails' \
     -H 'Authorization: Bearer re_gUmdFFWn_DYFUjVudqprJoMnNJo3teM3o' \
     -H 'Content-Type: application/json' \
     -d '{"from":"onboarding@resend.dev","to":"your-email@example.com","subject":"Test","html":"Test email"}'
   