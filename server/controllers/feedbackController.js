const nodemailer = require("nodemailer");

// Configure the transporter - Using Gmail or any email service
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "zenderohan1220@gmail.com",
    pass: process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD,
  },
});

// Send feedback email
const sendFeedback = async (req, res) => {
  try {
    const { name, email, message, rating } = req.body;

    // Validate input
    if (!name || !email || !message || !rating) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Email to admin (you)
    const adminMailOptions = {
      from: process.env.EMAIL_USER || "zenderohan1220@gmail.com",
      to: "zenderohan1220@gmail.com",
      subject: `New Feedback from ${name} - Connect It`,
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);">
            <h2 style="color: #1f2937; margin-bottom: 20px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
              🎉 New Feedback Received
            </h2>
            
            <div style="margin-bottom: 20px;">
              <p style="color: #6b7280; margin: 10px 0;">
                <strong style="color: #374151;">Name:</strong> ${name}
              </p>
              <p style="color: #6b7280; margin: 10px 0;">
                <strong style="color: #374151;">Email:</strong> ${email}
              </p>
              <p style="color: #6b7280; margin: 10px 0;">
                <strong style="color: #374151;">Rating:</strong> 
                <span style="color: #fbbf24;">
                  ${'⭐'.repeat(rating)} (${rating}/5)
                </span>
              </p>
            </div>

            <div style="background-color: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <h3 style="color: #1d4ed8; margin-top: 0; margin-bottom: 10px;">Feedback Message:</h3>
              <p style="color: #374151; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
            </div>

            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
              <p>This feedback was submitted on ${new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>
      `,
    };

    // Email to user (confirmation)
    const userMailOptions = {
      from: process.env.EMAIL_USER || "zenderohan1220@gmail.com",
      to: email,
      subject: "Thank You for Your Feedback - Connect It",
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);">
            <h2 style="color: #1f2937; margin-bottom: 20px;">
              Thank You, ${name.split(" ")[0]}! 💙
            </h2>
            
            <p style="color: #6b7280; line-height: 1.6;">
              We appreciate you taking the time to share your feedback with Connect It. Your thoughts and suggestions are incredibly valuable to us and help us continuously improve our service.
            </p>

            <div style="background-color: #dcfce7; padding: 15px; border-radius: 8px; border-left: 4px solid #16a34a; margin: 20px 0;">
              <p style="color: #16a34a; margin: 0;">
                <strong>✓ Your feedback has been received</strong>
              </p>
            </div>

            <div style="margin: 20px 0;">
              <p style="color: #6b7280; font-weight: 600;">Your Rating: <span style="color: #fbbf24;">${'⭐'.repeat(rating)}</span></p>
            </div>

            <p style="color: #6b7280; line-height: 1.6;">
              Our team will review your feedback carefully and use it to enhance the Connect It experience. If you have any additional comments or suggestions, feel free to reach out to us anytime.
            </p>

            <p style="color: #6b7280; margin-top: 30px; margin-bottom: 0;">
              Best regards,<br/>
              <strong>The Connect It Team</strong>
            </p>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
              <p>Connect It - Real-time Messaging Platform</p>
            </div>
          </div>
        </div>
      `,
    };

    // Send both emails in parallel
    await Promise.all([
      transporter.sendMail(adminMailOptions),
      transporter.sendMail(userMailOptions),
    ]);

    return res.status(200).json({
      success: true,
      message: "Feedback sent successfully!",
    });
  } catch (error) {
    console.error("Error sending feedback email:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send feedback. Please try again later.",
      error: error.message,
    });
  }
};

module.exports = {
  sendFeedback,
};
