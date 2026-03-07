"""
Contact Form API — Handle user inquiries
"""

import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, EmailStr

from config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


class ContactRequest(BaseModel):
    """Contact form submission."""
    name: str
    email: EmailStr
    contactType: str  # "feedback" | "complaint" | "buy-report" | "other"
    message: str


class ContactResponse(BaseModel):
    """Contact form response."""
    success: bool
    error: str | None = None


def get_contact_type_emoji(contact_type: str) -> str:
    """Get emoji for contact type."""
    emoji_map = {
        "feedback": "💬",
        "complaint": "⚠️",
        "buy-report": "📊",
        "other": "✉️",
    }
    return emoji_map.get(contact_type, "✉️")


def send_contact_email(name: str, email: str, contact_type: str, message: str) -> None:
    """
    Send contact form submission via SMTP.
    
    Raises:
        Exception: If email sending fails
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        raise Exception(
            "SMTP not configured. Please set SMTP_USER and SMTP_PASSWORD environment variables."
        )

    emoji = get_contact_type_emoji(contact_type)
    subject = f"{emoji} Contact Form: {contact_type.replace('-', ' ').title()} from {name}"
    
    # Create email body
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #0ea66e 0%, #0c8f5e 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }}
            .content {{ background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }}
            .field {{ margin-bottom: 20px; }}
            .label {{ font-weight: 600; color: #0c1a2e; margin-bottom: 5px; }}
            .value {{ color: #4a5568; }}
            .message-box {{ background: #f8f9fb; padding: 15px; border-radius: 6px; border-left: 4px solid #0ea66e; }}
            .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #718096; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2 style="margin: 0;">New Contact Form Submission</h2>
            </div>
            <div class="content">
                <div class="field">
                    <div class="label">Contact Type:</div>
                    <div class="value">{emoji} {contact_type.replace("-", " ").title()}</div>
                </div>
                <div class="field">
                    <div class="label">Name:</div>
                    <div class="value">{name}</div>
                </div>
                <div class="field">
                    <div class="label">Email:</div>
                    <div class="value"><a href="mailto:{email}">{email}</a></div>
                </div>
                <div class="field">
                    <div class="label">Message:</div>
                    <div class="message-box">{message.replace(chr(10), '<br>')}</div>
                </div>
                <div class="field">
                    <div class="label">Submitted:</div>
                    <div class="value">{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC</div>
                </div>
            </div>
            <div class="footer">
                <p>This email was sent from the CheckEmailDelivery.com contact form</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_body = f"""
New Contact Form Submission

Contact Type: {emoji} {contact_type.replace("-", " ").title()}
Name: {name}
Email: {email}
Message:
{message}

Submitted: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC
"""
    
    # Create message
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = settings.SMTP_USER
    msg['To'] = settings.CONTACT_EMAIL
    msg['Reply-To'] = email  # Allow easy reply to the sender
    
    # Attach both plain text and HTML versions
    part1 = MIMEText(text_body, 'plain')
    part2 = MIMEText(html_body, 'html')
    msg.attach(part1)
    msg.attach(part2)
    
    # Send email via SMTP
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        logger.info(f"Contact email sent successfully from {email} ({contact_type})")
    except Exception as e:
        logger.error(f"Failed to send contact email: {e}")
        raise


@router.post("/contact", response_model=ContactResponse)
async def handle_contact_form(request: Request, body: ContactRequest) -> ContactResponse:
    """
    Handle contact form submission.
    
    Sends email to CONTACT_EMAIL with form details.
    """
    try:
        # Validate contact type
        valid_types = ["feedback", "complaint", "buy-report", "other"]
        if body.contactType not in valid_types:
            return ContactResponse(
                success=False,
                error=f"Invalid contact type. Must be one of: {', '.join(valid_types)}"
            )
        
        # Basic validation
        if len(body.message.strip()) < 10:
            return ContactResponse(
                success=False,
                error="Message is too short. Please provide more details."
            )
        
        # Send email
        send_contact_email(
            name=body.name.strip(),
            email=body.email,
            contact_type=body.contactType,
            message=body.message.strip()
        )
        
        logger.info(
            f"Contact form submitted: {body.contactType} from {body.name} <{body.email}>"
        )
        
        return ContactResponse(success=True)
        
    except Exception as e:
        logger.error(f"Contact form error: {e}", exc_info=True)
        return ContactResponse(
            success=False,
            error="Failed to send message. Please try again or email us directly at contact@checkemaildelivery.com"
        )
