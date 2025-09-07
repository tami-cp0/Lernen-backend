const RegisterEmailTemplate = {
  "subject": "OTP Verification",
  "html": `
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Email Verification</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; color: #333;">
          <p>Hello <span style="color: #8BB83E;">{{name}}</span>,</p>

          <p>Use the OTP below to verify your email address:</p>

          <h2 style="color: #8BB83E; letter-spacing: 2px;">{{otp}}</h2>

          <p>This OTP will expire in 10 minutes.</p>

          <hr style="margin: 20px 0;" />

          <p style="font-size: 12px; color: #888;">
            If you didn’t request this, you can safely ignore it or contact support.
          </p>
        </div>
      </body>
    </html>
  `
};

export default RegisterEmailTemplate;