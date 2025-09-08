const MagicLinkEmailTemplate = {
  "subject": "Sign In to Lernen",
  "html": `
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Sign in to Lernen</title>
      </head>
      <body>
        <div style="font-family: Arial, sans-serif; color: #333;">
          <p>You requested to sign in. You can click the link below to verify and confirm:</p>
            <a 
                href="{{link}}" 
                style="
                display: inline-block; 
                padding: 10px 20px; 
                font-size: 14px; 
                color: #0c0c0c;
                background-color: #8BB83E; 
                text-decoration: none; 
                border-radius: 5px;
                margin: 5px 0;
                "
            >
              Sign in
            </a>
          <p>This link will expire in 10 minutes.</p>

          <hr style="margin: 20px 0;" />

          <p style="font-size: 12px; color: #888;">
            If you didn’t request this, you can safely ignore it or contact support.
          </p>
        </div>
      </body>
    </html>
  `
};

export default MagicLinkEmailTemplate;