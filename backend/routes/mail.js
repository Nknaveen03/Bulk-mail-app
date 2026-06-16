import express from 'express';
import nodemailer from 'nodemailer';
import Email from '../models/Email.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Helper to create mail transporter
const createTransporter = async (customSmtp) => {
  if (customSmtp && customSmtp.host && customSmtp.user && customSmtp.pass) {
    console.log('Using custom SMTP configuration provided in request');
    return {
      transporter: nodemailer.createTransport({
        host: customSmtp.host,
        port: parseInt(customSmtp.port) || 587,
        secure: customSmtp.secure === true || customSmtp.secure === 'true',
        auth: {
          user: customSmtp.user,
          pass: customSmtp.pass,
        },
      }),
      configInfo: {
        host: customSmtp.host,
        port: parseInt(customSmtp.port) || 587,
        secure: customSmtp.secure === true || customSmtp.secure === 'true',
        user: customSmtp.user,
      },
      isEthereal: false,
    };
  }

  // Check env settings
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    console.log('Using SMTP configuration from environment variables');
    const secure = process.env.SMTP_SECURE === 'true';
    const port = parseInt(process.env.SMTP_PORT) || (secure ? 465 : 587);
    return {
      transporter: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: port,
        secure: secure,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      }),
      configInfo: {
        host: process.env.SMTP_HOST,
        port: port,
        secure: secure,
        user: process.env.SMTP_USER,
      },
      isEthereal: false,
    };
  }

  // Fallback: Generate Ethereal dynamic test account
  console.log('No SMTP config found. Generating Ethereal test account...');
  const testAccount = await nodemailer.createTestAccount();
  return {
    transporter: nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    }),
    configInfo: {
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      user: testAccount.user,
    },
    isEthereal: true,
  };
};

// @desc    Send bulk emails
// @route   POST /api/mail/send
// @access  Private
router.post('/send', protect, async (req, res) => {
  const { subject, body, bodyType, recipients, smtpConfig } = req.body;

  if (!subject || !body || !recipients) {
    return res.status(400).json({ message: 'Subject, body, and recipients are required' });
  }

  // Parse recipients
  let recipientList = [];
  if (Array.isArray(recipients)) {
    recipientList = recipients.map(email => email.trim()).filter(Boolean);
  } else if (typeof recipients === 'string') {
    recipientList = recipients
      .split(/[\n,;]+/)
      .map(email => email.trim())
      .filter(email => email.length > 0);
  }

  if (recipientList.length === 0) {
    return res.status(400).json({ message: 'No valid recipient email addresses found' });
  }

  // Basic email pattern check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validRecipients = recipientList.filter(email => emailRegex.test(email));
  const invalidRecipients = recipientList.filter(email => !emailRegex.test(email));

  if (validRecipients.length === 0) {
    return res.status(400).json({ 
      message: 'All provided email addresses are invalid', 
      invalidRecipients 
    });
  }

  // Initialize DB record
  const dbRecipients = validRecipients.map(email => ({
    email,
    status: 'pending',
  }));

  let emailRecord;
  try {
    const { transporter, configInfo, isEthereal } = await createTransporter(smtpConfig);

    emailRecord = new Email({
      subject,
      body,
      bodyType: bodyType || 'html',
      recipients: dbRecipients,
      status: 'sending',
      totalRecipients: validRecipients.length,
      smtpConfig: configInfo,
    });
    await emailRecord.save();

    res.status(202).json({
      message: 'Bulk mailing campaign started',
      campaignId: emailRecord._id,
      totalCount: validRecipients.length,
    });

    // Start background processing
    (async () => {
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < emailRecord.recipients.length; i++) {
        const recipient = emailRecord.recipients[i];
        try {
          const mailOptions = {
            from: `"Bulk Mail Sender" <${configInfo.user}>`,
            to: recipient.email,
            subject: subject,
          };
          
          if (emailRecord.bodyType === 'text') {
            mailOptions.text = body;
          } else {
            mailOptions.html = body;
          }

          const info = await transporter.sendMail(mailOptions);

          recipient.status = 'success';
          if (isEthereal) {
            recipient.previewUrl = nodemailer.getTestMessageUrl(info);
          }
          successCount++;
        } catch (error) {
          console.error(`Error sending to ${recipient.email}:`, error);
          recipient.status = 'failed';
          recipient.error = error.message || 'SMTP delivery error';
          failureCount++;
        }

        // Update progress in database every few records or at the end
        if (i % 5 === 0 || i === emailRecord.recipients.length - 1) {
          emailRecord.successCount = successCount;
          emailRecord.failureCount = failureCount;
          await emailRecord.save();
        }
      }

      // Update final status
      emailRecord.successCount = successCount;
      emailRecord.failureCount = failureCount;
      if (successCount === emailRecord.totalRecipients) {
        emailRecord.status = 'success';
      } else if (failureCount === emailRecord.totalRecipients) {
        emailRecord.status = 'failed';
      } else {
        emailRecord.status = 'partial';
      }
      emailRecord.sentAt = new Date();
      await emailRecord.save();
      console.log(`Campaign ${emailRecord._id} finished: ${successCount} succeeded, ${failureCount} failed.`);
    })().catch(err => {
      console.error('Async mail sending execution error:', err);
    });

  } catch (error) {
    console.error('Failed to initialize mail campaign:', error);
    res.status(500).json({ message: 'Failed to initialize mail campaign: ' + error.message });
  }
});

// @desc    Get sent email history
// @route   GET /api/mail/history
// @access  Private
router.get('/history', protect, async (req, res) => {
  try {
    const history = await Email.find().sort({ sentAt: -1 });
    res.json(history);
  } catch (error) {
    console.error('Fetch history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Get campaign status
// @route   GET /api/mail/status/:id
// @access  Private
router.get('/status/:id', protect, async (req, res) => {
  try {
    const campaign = await Email.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    res.json(campaign);
  } catch (error) {
    console.error('Fetch status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Get bulk mailing aggregate stats
// @route   GET /api/mail/stats
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const stats = await Email.aggregate([
      {
        $group: {
          _id: null,
          totalCampaigns: { $sum: 1 },
          totalSent: { $sum: '$totalRecipients' },
          totalSuccess: { $sum: '$successCount' },
          totalFailure: { $sum: '$failureCount' },
        },
      },
    ]);

    if (stats.length === 0) {
      return res.json({
        totalCampaigns: 0,
        totalSent: 0,
        totalSuccess: 0,
        totalFailure: 0,
        successRate: 0,
      });
    }

    const { totalCampaigns, totalSent, totalSuccess, totalFailure } = stats[0];
    const successRate = totalSent > 0 ? Math.round((totalSuccess / totalSent) * 100) : 0;

    res.json({
      totalCampaigns,
      totalSent,
      totalSuccess,
      totalFailure,
      successRate,
    });
  } catch (error) {
    console.error('Fetch stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
