// Email service configuration
// You'll need to set up an account at https://www.emailjs.com/
// Then replace these values with your actual EmailJS credentials

const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID' // Replace with your EmailJS service ID
const EMAILJS_TEMPLATE_ID_APPROVAL = 'YOUR_APPROVAL_TEMPLATE_ID' // Replace with your approval template ID
const EMAILJS_TEMPLATE_ID_DENIAL = 'YOUR_DENIAL_TEMPLATE_ID' // Replace with your denial template ID
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY' // Replace with your EmailJS public key

// Initialize EmailJS (you'll need to install: npm install @emailjs/browser)
export const initEmailJS = async () => {
  try {
    const emailjs = await import('@emailjs/browser')
    emailjs.init(EMAILJS_PUBLIC_KEY)
    return emailjs
  } catch (error) {
    console.error('Failed to initialize EmailJS:', error)
    return null
  }
}

export const sendApprovalEmail = async (booking) => {
  try {
    const emailjs = await initEmailJS()
    if (!emailjs) {
      console.error('EmailJS not initialized')
      return false
    }

    const templateParams = {
      to_email: booking.email,
      to_name: booking.name,
      pickup_date: booking.date,
      pickup_time: booking.time || '10:00 AM - 4:00 PM',
      pickup_address: `${booking.address}, ${booking.city}, ${booking.state} ${booking.zip}`,
      items: booking.items,
      contact_phone: '705-254-2473', // Habitat for Humanity contact
    }

    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID_APPROVAL,
      templateParams
    )

    console.log('Approval email sent successfully:', response)
    return true
  } catch (error) {
    console.error('Failed to send approval email:', error)
    return false
  }
}

export const sendDenialEmail = async (booking) => {
  try {
    const emailjs = await initEmailJS()
    if (!emailjs) {
      console.error('EmailJS not initialized')
      return false
    }

    const templateParams = {
      to_email: booking.email,
      to_name: booking.name,
      requested_date: booking.date,
      items: booking.items,
      contact_phone: '705-254-2473', // Habitat for Humanity contact
      contact_email: 'info@habitatsault.ca', // Update with actual email
    }

    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID_DENIAL,
      templateParams
    )

    console.log('Denial email sent successfully:', response)
    return true
  } catch (error) {
    console.error('Failed to send denial email:', error)
    return false
  }
}

// Alternative: Simple mailto link generator (fallback if EmailJS isn't configured)
export const generateApprovalEmailLink = (booking) => {
  const subject = encodeURIComponent('Your Habitat for Humanity Pickup Request - Approved')
  const body = encodeURIComponent(`
Dear ${booking.name},

Great news! Your pickup request has been approved.

Pickup Details:
Date: ${booking.date}
Time: ${booking.time || '10:00 AM - 4:00 PM'}
Address: ${booking.address}, ${booking.city}, ${booking.state} ${booking.zip}
Items: ${booking.items}

Please ensure someone is available at the scheduled time. Our team will arrive within the specified time window.

If you need to make any changes, please contact us at 705-254-2473.

Thank you for your donation!

Best regards,
Habitat for Humanity Team
  `.trim())
  
  return `mailto:${booking.email}?subject=${subject}&body=${body}`
}

export const generateDenialEmailLink = (booking) => {
  const subject = encodeURIComponent('Your Habitat for Humanity Pickup Request')
  const body = encodeURIComponent(`
Dear ${booking.name},

Thank you for your interest in donating to Habitat for Humanity.

Unfortunately, we are unable to accommodate your pickup request for ${booking.date}.

This could be due to:
- High volume of requests for this date
- Items not meeting our current donation guidelines
- Logistical constraints in your area

We encourage you to:
- Try scheduling for a different date
- Consider dropping off items at our ReStore location
- Contact us at 705-254-2473 to discuss alternatives

We appreciate your support and apologize for any inconvenience.

Best regards,
Habitat for Humanity Team
  `.trim())
  
  return `mailto:${booking.email}?subject=${subject}&body=${body}`
}