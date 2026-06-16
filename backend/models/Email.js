import mongoose from 'mongoose';

const recipientSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending',
  },
  error: {
    type: String,
    default: null,
  },
  previewUrl: {
    type: String,
    default: null,
  },
});

const emailSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  body: {
    type: String,
    required: true,
  },
  bodyType: {
    type: String,
    enum: ['html', 'text'],
    default: 'html',
  },
  recipients: [recipientSchema],
  status: {
    type: String,
    enum: ['pending', 'sending', 'success', 'failed', 'partial'],
    default: 'pending',
  },
  totalRecipients: {
    type: Number,
    default: 0,
  },
  successCount: {
    type: Number,
    default: 0,
  },
  failureCount: {
    type: Number,
    default: 0,
  },
  sentAt: {
    type: Date,
    default: Date.now,
  },
  smtpConfig: {
    // Save configuration used (excluding password) for debugging
    host: String,
    port: Number,
    secure: Boolean,
    user: String,
  },
});

const Email = mongoose.model('Email', emailSchema);
export default Email;
