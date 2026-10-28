const mongoose = require('mongoose');

const RecordSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['Branch', 'ATM'],
      required: true,
      default: 'Branch',
      index: true
    },
    // Primary Identifiers
    dpCode: {
      type: String,
      trim: true,
      index: true
    },
    atmId: {
      type: String,
      trim: true,
      index: true
    },

    // LAN Configuration
    vlan: { type: String, default: 'No' },
    lanIp: { type: String, trim: true, default: '' },
    lanGateway: { type: String, trim: true, default: '' },
    atmIp: { type: String, trim: true, default: '' },
    atmGateway: { type: String, trim: true, default: '' },

    // BSNL
    bsnlIp: { type: String, trim: true, default: '' },
    bsnlGateway: { type: String, trim: true, default: '' },
    bsnlPing: { type: String, default: 'No' },

    // JIO
    jioIp: { type: String, trim: true, default: '' },
    jioGateway: { type: String, trim: true, default: '' },
    jioPing: { type: String, default: 'No' },

    // AIRTEL & CE
    airtelIp: { type: String, trim: true, default: '' },
    airtelGateway: { type: String, trim: true, default: '' },
    ceIp: { type: String, trim: true, default: '' },
    airtelPing: { type: String, default: 'No' },

    // CONFIGURATION & HANDOVER
    configuration: { type: String, default: 'Not completed' },
    mp: { type: String, default: 'No' },
    online: { type: String, default: 'No' },
    mail: { type: String, default: 'No' },
    dcMail: { type: String, default: 'Not received' },
    drcMail: { type: String, default: 'Not received' },
    cables: { type: String, default: 'Not connected' },
    working: { type: String, default: 'No', index: true },

    notes: { type: String, default: '' },
    createdBy: { type: String, default: 'admin' },
    updatedBy: { type: String, default: 'admin' }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.created = ret.createdAt;
        ret.updated = ret.updatedAt;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Search text index
RecordSchema.index({
  dpCode: 'text',
  atmId: 'text',
  lanIp: 'text',
  bsnlIp: 'text',
  jioIp: 'text',
  airtelIp: 'text'
});

module.exports = mongoose.models.Record || mongoose.model('Record', RecordSchema);
