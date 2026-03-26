"""Authentication endpoints — register, login, current-user lookup, and first-time setup."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
import bcrypt
from jose import jwt
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.email_template import EmailTemplate
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

# ── Default template library ─────────────────────────────────────────────────

_DEFAULT_TEMPLATES = [
    {
        "name": "Introduction to Buyer",
        "subject": "Welcome — Your Transaction Is Underway | {{property_address}}",
        "body": (
            "Dear {{buyer_name}},\n\n"
            "Welcome! I am thrilled to be working with you on the purchase of {{property_address}}.\n\n"
            "I wanted to reach out to introduce myself formally and walk you through what to expect "
            "over the coming weeks.\n\n"
            "Key Contacts:\n"
            "- Your Agent: {{agent_name}} | {{agent_phone}} | {{agent_email}}\n"
            "- Title Company: {{title_company}}\n"
            "- Lender: {{lender_name}}\n\n"
            "What Happens Next:\n"
            "1. Review the contract together and confirm all deadlines\n"
            "2. Schedule your home inspection within {{inspection_days}} days of contract execution\n"
            "3. Your lender will begin the financing and appraisal process\n"
            "4. Title company will begin the title search\n\n"
            "Important Deadlines:\n"
            "- Inspection Deadline: {{inspection_deadline}}\n"
            "- Financing Contingency: {{financing_deadline}}\n"
            "- Estimated Closing Date: {{closing_date}}\n\n"
            "Please do not hesitate to reach out at any time. I am available 7 days a week.\n\n"
            "Warm regards,\n"
            "{{agent_name}}\n"
            "{{brokerage_name}}\n"
            "{{agent_phone}} | {{agent_email}}"
        ),
    },
    {
        "name": "Introduction to Seller",
        "subject": "We're Under Contract — What Happens Next | {{property_address}}",
        "body": (
            "Dear {{seller_name}},\n\n"
            "Congratulations — you are officially under contract for the sale of {{property_address}}!\n\n"
            "Here is what you need to know and do in the coming days:\n\n"
            "Your Action Items:\n"
            "1. Gather all property disclosures and HOA documents (if applicable)\n"
            "2. Prepare for the buyer's home inspection on or around {{inspection_date}}\n"
            "3. Continue maintaining the property in its current condition\n"
            "4. Vacate the property by {{closing_date}} as agreed\n\n"
            "Documents We Will Need From You:\n"
            "- Seller's disclosure forms\n"
            "- HOA contact and document package (if applicable)\n"
            "- Copy of any warranties on appliances or roof\n"
            "- Survey (if available)\n\n"
            "Timeline Overview:\n"
            "- Inspection Period Ends: {{inspection_deadline}}\n"
            "- Appraisal Expected: {{appraisal_date}}\n"
            "- Estimated Closing: {{closing_date}}\n\n"
            "I will keep you updated every step of the way. Feel free to call or text me anytime.\n\n"
            "Best regards,\n"
            "{{agent_name}}\n"
            "{{brokerage_name}}\n"
            "{{agent_phone}} | {{agent_email}}"
        ),
    },
    {
        "name": "Inspection Reminder",
        "subject": "ACTION REQUIRED: Schedule Your Home Inspection | {{property_address}}",
        "body": (
            "Dear {{buyer_name}},\n\n"
            "This is a reminder that your home inspection must be scheduled and completed by "
            "{{inspection_deadline}}.\n\n"
            "Why the Inspection Matters:\n"
            "The home inspection is one of the most important steps in your purchase. A licensed "
            "inspector will evaluate the property's condition — roof, foundation, electrical, "
            "plumbing, HVAC, and more.\n\n"
            "Recommended Inspectors:\n"
            "- {{inspector_name_1}} | {{inspector_phone_1}}\n"
            "- {{inspector_name_2}} | {{inspector_phone_2}}\n\n"
            "What to Expect:\n"
            "- Inspections typically take 2-4 hours depending on property size\n"
            "- You are encouraged to attend\n"
            "- You will receive a full written report within 24 hours\n"
            "- We can then negotiate repairs or credits based on findings\n\n"
            "Please contact me immediately once your inspection is scheduled so I can confirm "
            "with the seller's agent.\n\n"
            "Best,\n"
            "{{agent_name}}\n"
            "{{brokerage_name}}\n"
            "{{agent_phone}} | {{agent_email}}"
        ),
    },
    {
        "name": "Under Contract Congratulations",
        "subject": "Congratulations — You're Under Contract! | {{property_address}}",
        "body": (
            "Dear {{buyer_name}},\n\n"
            "Congratulations! Your offer on {{property_address}} has been accepted and you are now "
            "officially under contract.\n\n"
            "This is an exciting milestone. Here is what happens next:\n\n"
            "Immediate Next Steps:\n"
            "1. Earnest Money Deposit (EMD) of {{emd_amount}} is due by {{emd_due_date}}\n"
            "2. Schedule your home inspection before {{inspection_deadline}}\n"
            "3. Notify your lender to begin processing your loan\n\n"
            "Coming Up:\n"
            "- Home inspection\n"
            "- Appraisal (ordered by lender)\n"
            "- Title search and insurance\n"
            "- Final loan approval\n"
            "- Final walkthrough\n"
            "- CLOSING — estimated {{closing_date}}\n\n"
            "I will be with you every step of the way. Do not hesitate to reach out with any questions.\n\n"
            "Warmly,\n"
            "{{agent_name}}\n"
            "{{brokerage_name}}\n"
            "{{agent_phone}} | {{agent_email}}"
        ),
    },
    {
        "name": "Closing Date Reminder",
        "subject": "Your Closing Is in 3 Days | {{property_address}}",
        "body": (
            "Dear {{buyer_name}},\n\n"
            "Your closing is scheduled for {{closing_date}} — just 3 days away!\n\n"
            "What to Bring to Closing:\n"
            "- Government-issued photo ID (driver's license or passport)\n"
            "- Cashier's check or confirmation of wire transfer for {{cash_to_close}} "
            "(exact amount will be on your Closing Disclosure)\n"
            "- Proof of homeowner's insurance\n\n"
            "WIRE FRAUD WARNING:\n"
            "NEVER wire funds based solely on email instructions. Always call our office at "
            "{{agent_phone}} to verbally verify wiring instructions before sending any money.\n\n"
            "Closing Details:\n"
            "- Date: {{closing_date}}\n"
            "- Time: {{closing_time}}\n"
            "- Location: {{closing_location}}\n"
            "- Closing Agent: {{closing_agent_name}}\n\n"
            "Plan to arrive 10-15 minutes early. Closing typically takes 1-2 hours.\n\n"
            "Congratulations — you are almost a homeowner!\n\n"
            "Best regards,\n"
            "{{agent_name}}\n"
            "{{brokerage_name}}\n"
            "{{agent_phone}} | {{agent_email}}"
        ),
    },
    {
        "name": "Post-Closing Thank You",
        "subject": "Congratulations on Your New Home! | {{property_address}}",
        "body": (
            "Dear {{buyer_name}},\n\n"
            "Congratulations — you are officially a homeowner! It has been an absolute pleasure "
            "working with you on the purchase of {{property_address}}.\n\n"
            "A Few Reminders Now That You Are Home:\n"
            "- Change the locks as soon as possible\n"
            "- Register your address for mail forwarding if you have not already\n"
            "- File for Homestead Exemption (if applicable in your county) — "
            "the deadline is typically March 1st\n"
            "- Keep your closing documents in a safe place\n\n"
            "Stay in Touch:\n"
            "I would love to stay connected. If you know anyone looking to buy or sell, "
            "I would be honored by your referral.\n\n"
            "If you had a great experience working with me, I would truly appreciate a review:\n"
            "{{review_link}}\n\n"
            "Wishing you many years of happiness in your new home!\n\n"
            "Warmly,\n"
            "{{agent_name}}\n"
            "{{brokerage_name}}\n"
            "{{agent_phone}} | {{agent_email}}"
        ),
    },
    {
        "name": "Document Request — Buyer",
        "subject": "Documents Needed to Keep Your Transaction on Track | {{property_address}}",
        "body": (
            "Dear {{buyer_name}},\n\n"
            "To keep your transaction on track, we need the following documents from you by "
            "{{document_deadline}}:\n\n"
            "Documents Needed:\n"
            "- {{document_1}}\n"
            "- {{document_2}}\n"
            "- {{document_3}}\n\n"
            "How to Submit:\n"
            "You can upload documents directly through your secure client portal:\n"
            "{{portal_link}}\n\n"
            "Alternatively, you may email them to {{agent_email}} or bring them to our office.\n\n"
            "Missing this deadline could delay your closing or put your contract at risk. "
            "Please reach out immediately if you have any questions or need an extension.\n\n"
            "Thank you for your prompt attention to this matter.\n\n"
            "Best regards,\n"
            "{{agent_name}}\n"
            "{{brokerage_name}}\n"
            "{{agent_phone}} | {{agent_email}}"
        ),
    },
    {
        "name": "Document Request — Lender",
        "subject": "Documents Needed from Your Lending Team | {{property_address}}",
        "body": (
            "Dear {{lender_name}},\n\n"
            "I am following up on the transaction for {{property_address}} with our buyer "
            "{{buyer_name}}.\n\n"
            "To keep this transaction on schedule for closing on {{closing_date}}, we need the "
            "following from your team by {{document_deadline}}:\n\n"
            "Documents Needed:\n"
            "- Commitment Letter\n"
            "- Clear to Close (CTC) confirmation\n"
            "- Closing Disclosure (CD) — at least 3 business days before closing\n"
            "- Final loan approval documentation\n\n"
            "Lender Portal:\n"
            "You can upload documents directly through the secure lender portal:\n"
            "{{lender_portal_link}}\n\n"
            "Please let me know immediately if there are any issues or conditions that need to be "
            "resolved. We are counting on your team to keep this deal moving.\n\n"
            "Thank you for your attention to this.\n\n"
            "Best regards,\n"
            "{{agent_name}}\n"
            "{{brokerage_name}}\n"
            "{{agent_phone}} | {{agent_email}}"
        ),
    },
    {
        "name": "FIRPTA Notice",
        "subject": "Important: FIRPTA Withholding Notice | {{property_address}}",
        "body": (
            "Dear {{seller_name}},\n\n"
            "As part of your real estate transaction for {{property_address}}, I need to inform you "
            "about an important federal tax requirement that may apply to your sale.\n\n"
            "What Is FIRPTA?\n"
            "The Foreign Investment in Real Property Tax Act (FIRPTA) requires buyers to withhold "
            "a portion of the sale price when purchasing property from a foreign person or entity.\n\n"
            "Withholding Details:\n"
            "- Standard withholding rate: 15% of the gross sales price\n"
            "- Applicable sales price: {{purchase_price}}\n"
            "- Estimated withholding amount: {{firpta_withholding_amount}}\n\n"
            "What You Need to Do:\n"
            "1. Consult with a tax professional or CPA familiar with international tax law\n"
            "2. Determine if you qualify for a reduced withholding certificate from the IRS\n"
            "3. Complete IRS Form 8288 (U.S. Withholding Tax Return for Dispositions by Foreign "
            "Persons of U.S. Real Property Interests)\n"
            "4. Provide your ITIN (Individual Taxpayer Identification Number) if you do not "
            "have a U.S. Social Security Number\n\n"
            "Key IRS Forms:\n"
            "- Form 8288: Withholding tax return\n"
            "- Form 8288-A: Statement of withholding\n"
            "- Form 8288-B: Application for withholding certificate (to request reduction)\n\n"
            "Please consult with a qualified tax professional as soon as possible. This is a legal "
            "requirement and non-compliance can result in penalties.\n\n"
            "Best regards,\n"
            "{{agent_name}}\n"
            "{{brokerage_name}}\n"
            "{{agent_phone}} | {{agent_email}}"
        ),
    },
    {
        "name": "Earnest Money Deposit Reminder",
        "subject": "EMD Due in 48 Hours | {{property_address}}",
        "body": (
            "Dear {{buyer_name}},\n\n"
            "This is an urgent reminder that your Earnest Money Deposit (EMD) is due within "
            "48 hours.\n\n"
            "EMD Details:\n"
            "- Amount Due: {{emd_amount}}\n"
            "- Due Date: {{emd_due_date}}\n"
            "- Payable To: {{escrow_company}}\n\n"
            "How to Submit Your EMD:\n"
            "Option 1 — Wire Transfer:\n"
            "  Bank: {{escrow_bank}}\n"
            "  Account: {{escrow_account}}\n"
            "  Routing: {{escrow_routing}}\n\n"
            "Option 2 — Cashier's Check:\n"
            "  Made payable to: {{escrow_company}}\n"
            "  Deliver to: {{escrow_address}}\n\n"
            "IMPORTANT: Before wiring any funds, call {{agent_phone}} to verbally verify the wire "
            "instructions. Never rely on email instructions alone — wire fraud is real.\n\n"
            "Failure to deliver the EMD on time may put your contract at risk of cancellation. "
            "Please act immediately and confirm with me once it has been sent.\n\n"
            "Best regards,\n"
            "{{agent_name}}\n"
            "{{brokerage_name}}\n"
            "{{agent_phone}} | {{agent_email}}"
        ),
    },
    {
        "name": "Inspection Results — Repair Request",
        "subject": "Inspection Complete — Repair Negotiations Begin | {{property_address}}",
        "body": (
            "Dear {{buyer_name}},\n\n"
            "The home inspection for {{property_address}} has been completed. Here is a summary "
            "of the findings and our next steps.\n\n"
            "Items Being Negotiated:\n"
            "- {{repair_item_1}}\n"
            "- {{repair_item_2}}\n"
            "- {{repair_item_3}}\n\n"
            "Our Approach:\n"
            "We have several options:\n"
            "1. Request the seller to repair specific items before closing\n"
            "2. Request a credit at closing in lieu of repairs\n"
            "3. Accept the property as-is for major items and negotiate price reduction\n\n"
            "Timeline:\n"
            "- We must submit our repair request by: {{repair_request_deadline}}\n"
            "- Seller has until {{seller_response_deadline}} to respond\n\n"
            "I will be sending our formal repair request to the seller's agent shortly. "
            "I will keep you updated as soon as we receive a response.\n\n"
            "Best regards,\n"
            "{{agent_name}}\n"
            "{{brokerage_name}}\n"
            "{{agent_phone}} | {{agent_email}}"
        ),
    },
    {
        "name": "Clear to Close",
        "subject": "CLEAR TO CLOSE — Final Steps | {{property_address}}",
        "body": (
            "Dear {{buyer_name}},\n\n"
            "Excellent news — your lender has issued a Clear to Close (CTC) for your loan on "
            "{{property_address}}!\n\n"
            "This means your financing has been fully approved and we are ready to move to the "
            "final steps.\n\n"
            "What Happens Now:\n"
            "1. You will receive your Closing Disclosure (CD) — review it carefully and confirm "
            "your cash-to-close amount\n"
            "2. Final walkthrough of the property is scheduled for {{walkthrough_date}} at "
            "{{walkthrough_time}}\n"
            "3. Closing is confirmed for {{closing_date}} at {{closing_time}}\n"
            "4. Arrange your cashier's check or wire transfer for {{cash_to_close}}\n\n"
            "Closing Location:\n"
            "{{closing_location}}\n"
            "{{closing_agent_name}} — {{closing_agent_phone}}\n\n"
            "REMINDER: Always call to verify wire instructions before transferring funds. "
            "Wire fraud is real — protect yourself.\n\n"
            "You are almost there! This is a huge milestone.\n\n"
            "See you at closing!\n\n"
            "{{agent_name}}\n"
            "{{brokerage_name}}\n"
            "{{agent_phone}} | {{agent_email}}"
        ),
    },
    {
        "name": "Wire Fraud Warning",
        "subject": "IMPORTANT: Wire Fraud Warning for Your Closing | {{property_address}}",
        "body": (
            "Dear {{buyer_name}},\n\n"
            "As your closing date approaches, I want to share an extremely important warning about "
            "wire fraud — one of the fastest-growing scams targeting homebuyers.\n\n"
            "WHAT IS WIRE FRAUD?\n"
            "Criminals monitor real estate email communications and send fake wire instructions "
            "that appear to come from your agent, title company, or lender. If you wire money to "
            "the wrong account, it is nearly impossible to recover.\n\n"
            "HOW TO PROTECT YOURSELF:\n"
            "1. ALWAYS call to verify — Before wiring ANY funds, call our office directly at "
            "{{agent_phone}} using a number you find independently (not from an email)\n"
            "2. NEVER click links in emails claiming to have wire instructions\n"
            "3. NEVER trust a last-minute change in wire instructions without verbal confirmation\n"
            "4. Confirm the FULL routing and account number verbally before wiring\n\n"
            "OUR OFFICIAL CONTACT INFORMATION:\n"
            "- Agent: {{agent_name}} | {{agent_phone}}\n"
            "- Title Company: {{title_company}} | {{title_phone}}\n\n"
            "If you ever receive wire instructions via email that seem off — even slightly — "
            "STOP and call us immediately before doing anything.\n\n"
            "Your money and your home purchase are too important to risk.\n\n"
            "Stay safe,\n"
            "{{agent_name}}\n"
            "{{brokerage_name}}\n"
            "{{agent_phone}} | {{agent_email}}"
        ),
    },
    {
        "name": "Title Insurance Explanation",
        "subject": "Understanding Your Title Insurance | {{property_address}}",
        "body": (
            "Dear {{buyer_name}},\n\n"
            "As part of your purchase of {{property_address}}, you will be purchasing title "
            "insurance. I want to make sure you fully understand what it covers and why it matters.\n\n"
            "What Is Title Insurance?\n"
            "Title insurance protects you against problems with the ownership history (title) of "
            "the property — things that may not be discovered during the title search.\n\n"
            "Two Types of Title Insurance:\n\n"
            "1. Lender's Title Insurance (required)\n"
            "   - Protects your lender against title defects\n"
            "   - Required by virtually all mortgage lenders\n"
            "   - Does NOT protect you as the buyer\n\n"
            "2. Owner's Title Insurance (strongly recommended)\n"
            "   - Protects YOU as the property owner\n"
            "   - One-time premium paid at closing\n"
            "   - Covers you for as long as you own the property\n\n"
            "What It Covers:\n"
            "- Unknown liens or encumbrances on the property\n"
            "- Forged documents or fraud in the chain of title\n"
            "- Errors in public records\n"
            "- Unknown heirs claiming ownership\n"
            "- Boundary disputes\n\n"
            "Your Premium:\n"
            "- Estimated Owner's Policy: {{owners_policy_amount}}\n"
            "- Estimated Lender's Policy: {{lenders_policy_amount}}\n\n"
            "I strongly recommend purchasing the owner's title insurance policy. It is a small "
            "one-time cost for permanent peace of mind.\n\n"
            "Please let me know if you have any questions.\n\n"
            "Best regards,\n"
            "{{agent_name}}\n"
            "{{brokerage_name}}\n"
            "{{agent_phone}} | {{agent_email}}"
        ),
    },
    {
        "name": "Foreign National Welcome",
        "subject": (
            "Welcome — Informacion Importante Para Compradores Internacionales | {{property_address}}"
        ),
        "body": (
            "Dear {{buyer_name}} / Estimado/a {{buyer_name}},\n\n"
            "--- ENGLISH ---\n\n"
            "Welcome and congratulations on your decision to purchase property in the United States! "
            "I am honored to represent you in the purchase of {{property_address}}.\n\n"
            "As an international buyer, there are a few important items specific to your situation:\n\n"
            "FIRPTA (Foreign Investment in Real Property Tax Act):\n"
            "When you eventually sell U.S. property, federal law requires withholding of up to 15% "
            "of the gross sale price for tax purposes. Plan for this in your long-term investment strategy.\n\n"
            "ITIN (Individual Taxpayer Identification Number):\n"
            "If you do not have a U.S. Social Security Number, you will need an ITIN for tax "
            "reporting purposes. Contact the IRS or a tax professional to apply (IRS Form W-7).\n\n"
            "Required Documents for This Transaction:\n"
            "- Valid passport (all buyers)\n"
            "- Proof of funds or financing approval\n"
            "- ITIN or SSN for tax reporting\n"
            "- Wire transfer documentation from your financial institution\n\n"
            "I am here to guide you through every step. Please feel free to contact me anytime.\n\n"
            "--- ESPANOL ---\n\n"
            "Bienvenido/a y felicidades por su decision de comprar propiedad en los Estados Unidos. "
            "Es un honor representarle en la compra de {{property_address}}.\n\n"
            "Como comprador internacional, hay algunos aspectos importantes especificos a su situacion:\n\n"
            "FIRPTA (Ley de Inversion Extranjera en Bienes Raices):\n"
            "Cuando eventualmente venda propiedad en EE.UU., la ley federal requiere la retencion "
            "de hasta el 15% del precio de venta bruto para efectos fiscales.\n\n"
            "ITIN (Numero de Identificacion Personal del Contribuyente):\n"
            "Si no tiene numero de Seguro Social de EE.UU., necesitara un ITIN para declaraciones "
            "de impuestos. Contacte al IRS o un profesional de impuestos (Formulario IRS W-7).\n\n"
            "Documentos Requeridos para Esta Transaccion:\n"
            "- Pasaporte valido (todos los compradores)\n"
            "- Comprobante de fondos o aprobacion de financiamiento\n"
            "- ITIN o SSN para declaracion de impuestos\n"
            "- Documentacion de transferencia bancaria\n\n"
            "Estoy aqui para guiarle en cada paso del proceso. No dude en contactarme.\n\n"
            "Atentamente,\n"
            "{{agent_name}}\n"
            "{{brokerage_name}}\n"
            "{{agent_phone}} | {{agent_email}}"
        ),
    },
]


async def seed_default_templates(user_id: int, db: AsyncSession) -> None:
    """Seed 15 default email templates for a newly created user.

    Only runs if the user currently has zero templates (idempotent guard).
    """
    count_result = await db.execute(
        select(func.count()).select_from(EmailTemplate).where(EmailTemplate.user_id == user_id)
    )
    existing_count = count_result.scalar_one()
    if existing_count > 0:
        return

    for tpl in _DEFAULT_TEMPLATES:
        db.add(EmailTemplate(
            user_id=user_id,
            name=tpl["name"],
            subject=tpl["subject"],
            body=tpl["body"],
        ))

    await db.flush()

def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode("utf-8"))


def _create_access_token(user_id: int) -> str:
    expire = datetime.now(tz=timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> User:
    """Create a new broker account.

    Raises 409 if the email is already registered.
    """
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=body.email,
        hashed_password=_hash_password(body.password),
        full_name=body.full_name,
        brokerage_name=body.brokerage_name,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    await seed_default_templates(user.id, db)

    return user


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Authenticate a broker and return a JWT access token.

    Raises 401 if credentials are invalid.
    """
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not _verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = _create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> User:
    """Return the currently authenticated broker's profile."""
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Update the current broker's profile fields (full_name, brokerage_name)."""
    if body.full_name is not None:
        current_user.full_name = body.full_name
    if body.brokerage_name is not None:
        current_user.brokerage_name = body.brokerage_name
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Change the current broker's password after verifying the current one."""
    if not _verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    current_user.hashed_password = _hash_password(body.new_password)
    await db.commit()


@router.post("/setup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def setup(request: Request, body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """First-time broker setup: creates the initial account and returns a JWT.

    This endpoint only works when no users exist in the database. It is designed
    for first-deploy onboarding — run once to create the broker account, then use
    /auth/login for all subsequent authentication.

    Raises:
        409 if any broker account already exists (setup already completed).
    """
    count_result = await db.execute(select(func.count()).select_from(User))
    user_count = count_result.scalar_one()

    if user_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Setup already completed — a broker account already exists. "
                "Use POST /auth/login to sign in."
            ),
        )

    user = User(
        email=body.email,
        hashed_password=_hash_password(body.password),
        full_name=body.full_name,
        brokerage_name=body.brokerage_name,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    await seed_default_templates(user.id, db)

    token = _create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer"}
