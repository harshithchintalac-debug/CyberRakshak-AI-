from fastapi import APIRouter

router = APIRouter(prefix="/api/content", tags=["content"])

NEWS_ITEMS = [
    {"cat": "Phishing", "sev": "High", "title": "Fake \"Account Suspended\" emails impersonating major banks",
     "body": "Attackers are sending emails claiming your bank account is suspended, urging you to \"verify\" login details on a fake page.",
     "affected": "Bank customers with public email addresses",
     "how": "Email creates urgency, links to a lookalike login page that captures credentials.",
     "do": "Never click email links to log in — always type your bank's URL directly.", "date": "2026-07-08"},
    {"cat": "Mobile Threats", "sev": "Critical", "title": "Fake delivery-tracking APK spreading via WhatsApp",
     "body": "A malicious Android app disguised as a courier tracking tool is being shared in WhatsApp groups.",
     "affected": "Android users who sideload APKs",
     "how": "App requests SMS and accessibility permissions, then reads OTPs to drain bank accounts.",
     "do": "Only install apps from the Play Store; never sideload APKs from chat links.", "date": "2026-07-06"},
    {"cat": "Banking Scams", "sev": "High", "title": "\"KYC update\" calls targeting UPI users",
     "body": "Scammers pose as bank representatives asking users to update KYC via a remote-access app.",
     "affected": "UPI and mobile banking users",
     "how": "Victim is guided to install a screen-sharing app, then scammer initiates transactions.",
     "do": "Banks never ask you to install remote-access apps. Hang up and call the official number.", "date": "2026-07-04"},
    {"cat": "Social Media Scams", "sev": "Medium", "title": "Fake job offer messages on Instagram DMs",
     "body": "Accounts posing as recruiters offer \"easy work-from-home\" jobs requiring an upfront registration fee.",
     "affected": "Job seekers, students",
     "how": "Victims pay a small \"registration fee\" that is never refunded, and personal data is harvested.",
     "do": "Legitimate employers never ask for payment to get hired.", "date": "2026-07-02"},
    {"cat": "Data Breaches", "sev": "Medium", "title": "Third-party marketing vendor breach exposes contact lists",
     "body": "A marketing analytics vendor disclosed a breach affecting millions of email/phone records.",
     "affected": "Users of affected retail loyalty programs",
     "how": "Exposed contact data fuels targeted phishing and spam campaigns.",
     "do": "Watch for unusually personalized phishing attempts; consider changing reused passwords.", "date": "2026-06-29"},
    {"cat": "Malware", "sev": "High", "title": "Malicious \"invoice\" ZIP attachments target small businesses",
     "body": "Emails with ZIP attachments claiming to be overdue invoices install information-stealing malware.",
     "affected": "Small business owners, accounts-payable staff",
     "how": "Opening the ZIP runs a script that harvests browser-saved passwords.",
     "do": "Verify unexpected invoices by phone before opening attachments.", "date": "2026-06-27"},
]

INCIDENTS = [
    {"title": "Bank Fraud — Unauthorized Transaction", "steps": [
        "Call your bank's official fraud helpline immediately.", "Freeze/block your card or account through the bank app.",
        "File a complaint on the national cybercrime portal.", "Change your net-banking password and enable MFA.",
        "Save transaction SMS/emails as evidence."]},
    {"title": "UPI Fraud", "steps": [
        "Immediately raise a dispute in your UPI app.", "Call your bank's 24x7 fraud helpline.",
        "Do not make any further payments to \"reverse\" the transaction — that's a follow-up scam.",
        "Report to cybercrime.gov.in (or your country's equivalent).", "Revoke UPI access for any unfamiliar linked apps."]},
    {"title": "Social Media Account Hacked", "steps": [
        "Try resetting your password via \"Forgot Password.\"", "Check for an official account-recovery / hacked-account form.",
        "Alert your contacts not to trust messages from the account.", "Review and revoke connected third-party app access once recovered.",
        "Enable MFA immediately after recovery."]},
    {"title": "Email Account Compromise", "steps": [
        "Reset your email password from a trusted device.", "Check and remove unfamiliar forwarding rules or recovery emails.",
        "Enable MFA on your email account.", "Review connected apps and revoke unknown access.",
        "Check other accounts that use this email for recovery."]},
    {"title": "Malware Infection", "steps": [
        "Disconnect the device from the internet.", "Run a full scan with updated antivirus software.",
        "Change passwords from a different, clean device.", "Back up important files before any factory reset.",
        "If symptoms persist, consider a full factory reset."]},
    {"title": "Lost or Stolen Phone", "steps": [
        "Use \"Find My Device\" to lock or erase it remotely.", "Contact your mobile carrier to block the SIM.",
        "Change passwords for accounts logged in on the phone.", "Report the theft to local police for a record/FIR.",
        "Enable remote-wipe and MFA on all key accounts going forward."]},
    {"title": "I Shared My OTP", "steps": [
        "Call your bank's fraud helpline immediately — do not wait.", "Block your card/account through the banking app if possible.",
        "Check recent transactions for anything unauthorized.", "Never share future OTPs with anyone, including \"bank staff.\"",
        "File a cybercrime complaint if funds were lost."]},
    {"title": "Identity Theft", "steps": [
        "Report to your country's cybercrime authority.", "Alert your bank(s) to monitor for fraudulent accounts.",
        "Place a fraud alert with credit bureaus if available.", "Change passwords on all major accounts.",
        "Keep records of all fraudulent activity as evidence."]},
    {"title": "Ransomware", "steps": [
        "Disconnect the infected device from the network immediately.", "Do not pay the ransom — there's no guarantee of file recovery.",
        "Report the incident to relevant authorities.", "Restore files from a clean, offline backup if available.",
        "Reinstall the operating system if backups aren't available."]},
    {"title": "Suspicious APK Installation", "steps": [
        "Do not open the app if you haven't already.", "If installed, uninstall it immediately in Airplane mode.",
        "Run a security scan with a trusted antivirus app.", "Change passwords for accounts accessed on that device.",
        "Enable Play Protect and disable \"install from unknown sources.\""]},
]


@router.get("/news")
async def get_news(category: str | None = None):
    items = NEWS_ITEMS if not category or category == "All" else [n for n in NEWS_ITEMS if n["cat"] == category]
    return {"items": items, "categories": ["All"] + sorted({n["cat"] for n in NEWS_ITEMS})}


@router.get("/incidents")
async def get_incidents():
    return {"items": INCIDENTS}
