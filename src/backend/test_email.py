import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_USER     = "hydogennetwork.repots@gmail.com"
SMTP_PASSWORD = "gvwcqduppiiqoxpt"
TO            = "hydogennetwork.repots@gmail.com"  # send to yourself to test

print("Connecting to Gmail on port 465 (SSL)...")
try:
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.set_debuglevel(1)
        print("Connected OK")
        server.login(SMTP_USER, SMTP_PASSWORD)
        print("Login OK")
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Hydrogen Network — Test Email"
        msg["From"]    = SMTP_USER
        msg["To"]      = TO
        msg.attach(MIMEText("<b>It works!</b>", "html"))
        server.sendmail(SMTP_USER, TO, msg.as_string())
        print(f"\n✓ Email sent to {TO}")
except Exception as e:
    print(f"\n✗ Failed: {e}")
