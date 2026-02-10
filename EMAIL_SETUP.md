# Email Setup Instructions

The application now supports automated email notifications when bookings are approved or denied. You have two options:

## Option 1: EmailJS Setup (Recommended)

1. **Create an EmailJS Account**
   - Go to https://www.emailjs.com/ and sign up for a free account
   - Free tier allows 200 emails per month

2. **Create an Email Service**
   - In your EmailJS dashboard, click "Email Services"
   - Click "Add New Service"
   - Choose your email provider (Gmail, Outlook, etc.)
   - Follow the setup instructions for your provider
   - Note your Service ID

3. **Create Email Templates**

   **Approval Template:**
   - Click "Email Templates" > "Create New Template"
   - Name it "Pickup Approval"
   - Use these variables in your template:
     - `{{to_name}}` - Customer name
     - `{{to_email}}` - Customer email
     - `{{pickup_date}}` - Scheduled date
     - `{{pickup_time}}` - Scheduled time
     - `{{pickup_address}}` - Full address
     - `{{items}}` - Items description
     - `{{contact_phone}}` - Your contact number

   Example template:
   ```
   Subject: Your Habitat for Humanity Pickup Request - Approved
   
   Dear {{to_name}},

   Great news! Your pickup request has been approved.

   Pickup Details:
   Date: {{pickup_date}}
   Time: {{pickup_time}}
   Address: {{pickup_address}}
   Items: {{items}}

   Please ensure someone is available at the scheduled time.
   
   If you need to make any changes, please contact us at {{contact_phone}}.

   Thank you for your donation!
   
   Best regards,
   Habitat for Humanity Team
   ```

   **Denial Template:**
   - Create another template named "Pickup Denial"
   - Use these variables:
     - `{{to_name}}` - Customer name
     - `{{to_email}}` - Customer email
     - `{{requested_date}}` - Requested date
     - `{{items}}` - Items description
     - `{{contact_phone}}` - Your contact number
     - `{{contact_email}}` - Your contact email

4. **Get Your Credentials**
   - Service ID: Found in Email Services
   - Template IDs: Found in Email Templates
   - Public Key: Found in Account > API Keys

5. **Update the Email Service Configuration**
   
   Edit `/src/services/emailService.js` and replace the placeholder values:
   ```javascript
   const EMAILJS_SERVICE_ID = 'your_service_id_here'
   const EMAILJS_TEMPLATE_ID_APPROVAL = 'your_approval_template_id'
   const EMAILJS_TEMPLATE_ID_DENIAL = 'your_denial_template_id'
   const EMAILJS_PUBLIC_KEY = 'your_public_key_here'
   ```

6. **Install EmailJS**
   ```bash
   npm install @emailjs/browser
   ```

## Option 2: Brevo (SendinBlue) Setup

If you prefer Brevo:

1. Sign up at https://www.brevo.com/
2. Get your API key from Settings > SMTP & API
3. Create transactional email templates
4. Update the email service to use Brevo's API instead

## Option 3: Manual Email (Current Fallback)

If you don't configure EmailJS or Brevo, the system will automatically:
- Open your default email client with a pre-filled email when you approve/deny a booking
- You can then manually send the email

## Testing

1. Create a test booking with your email
2. Go to the Bookings page
3. Switch to Calendar view
4. Click on a date with bookings
5. Click "Approve" or "Deny" on a booking
6. Check if the email is sent (or if mailto opens)

## Troubleshooting

- If emails aren't sending, check the browser console for errors
- Verify your EmailJS credentials are correct
- Make sure you're not exceeding your email service limits
- Check that the customer has a valid email address in their booking

## Contact Information to Update

Make sure to update these in `/src/services/emailService.js`:
- `contact_phone`: Your organization's phone number
- `contact_email`: Your organization's email address