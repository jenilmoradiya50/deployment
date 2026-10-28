export const SECTIONS = [
  {
    id: 'lan',
    title: 'LAN CONFIGURATION',
    fields: ['vlan', 'lanIp', 'lanIpPrefix', 'lanGateway']
  },
  {
    id: 'bsnl',
    title: 'BSNL CONNECTIVITY',
    fields: ['bsnlIp', 'bsnlGateway', 'bsnlPing']
  },
  {
    id: 'jio',
    title: 'JIO CONNECTIVITY',
    fields: ['jioIp', 'jioGateway', 'jioPing']
  },
  {
    id: 'airtel',
    title: 'AIRTEL & CE CONNECTIVITY',
    fields: ['airtelIp', 'airtelGateway', 'ceIp', 'airtelPing']
  },
  {
    id: 'config',
    title: 'CONFIGURATION & HANDOVER',
    fields: [
      'configuration',
      'cs',
      'online',
      'mail',
      'dcMail',
      'drcMail',
      'cables',
      'working'
    ]
  }
];

export const FIELD_DEFINITIONS = {
  // Identification
  dpCode: {
    id: 'dpCode',
    label: 'DP Code',
    atmLabel: 'Base Branch DP Code',
    type: 'text',
    placeholder: 'e.g. DP-4102',
    isIp: false
  },
  atmId: {
    id: 'atmId',
    label: 'ATM ID',
    type: 'text',
    placeholder: 'e.g. ATM-MH-9941',
    isIp: false
  },

  // LAN
  vlan: {
    id: 'vlan',
    label: 'VLAN configured?',
    type: 'choice',
    options: ['Yes', 'No']
  },
  lanIp: {
    id: 'lanIp',
    label: 'Primary LAN IP',
    type: 'text',
    placeholder: 'e.g. 10.24.120.1',
    isIp: true
  },
  lanIpPrefix: {
    id: 'lanIpPrefix',
    label: 'LAN Prefix',
    type: 'text',
    placeholder: 'e.g. /24, /28',
    isIp: false
  },
  lanGateway: {
    id: 'lanGateway',
    label: 'Primary LAN Gateway',
    type: 'text',
    placeholder: 'e.g. 10.24.120.254',
    isIp: true
  },

  // BSNL
  bsnlIp: {
    id: 'bsnlIp',
    label: 'BSNL IP',
    type: 'text',
    placeholder: 'e.g. 192.168.10.2',
    isIp: true
  },
  bsnlGateway: {
    id: 'bsnlGateway',
    label: 'BSNL Gateway',
    type: 'text',
    placeholder: 'e.g. 192.168.10.1',
    isIp: true
  },
  bsnlPing: {
    id: 'bsnlPing',
    label: 'BSNL IP pinging?',
    type: 'choice',
    options: ['Yes', 'No']
  },

  // JIO
  jioIp: {
    id: 'jioIp',
    label: 'Jio IP',
    type: 'text',
    placeholder: 'e.g. 172.16.20.2',
    isIp: true
  },
  jioGateway: {
    id: 'jioGateway',
    label: 'Jio Gateway',
    type: 'text',
    placeholder: 'e.g. 172.16.20.1',
    isIp: true
  },
  jioPing: {
    id: 'jioPing',
    label: 'Jio IP pinging?',
    type: 'choice',
    options: ['Yes', 'No']
  },

  // AIRTEL & CE
  airtelIp: {
    id: 'airtelIp',
    label: 'Airtel IP',
    type: 'text',
    placeholder: 'e.g. 10.100.5.2',
    isIp: true
  },
  airtelGateway: {
    id: 'airtelGateway',
    label: 'Airtel Gateway',
    type: 'text',
    placeholder: 'e.g. 10.100.5.1',
    isIp: true
  },
  ceIp: {
    id: 'ceIp',
    label: 'CE IP',
    type: 'text',
    placeholder: 'e.g. 10.100.5.254',
    isIp: true
  },
  airtelPing: {
    id: 'airtelPing',
    label: 'Airtel / CE IP pinging?',
    type: 'choice',
    options: ['Yes', 'No']
  },

  // CONFIGURATION & HANDOVER
  configuration: {
    id: 'configuration',
    label: 'Configuration',
    type: 'choice',
    options: ['Completed', 'Not completed']
  },
  cs: {
    id: 'cs',
    label: 'Device added in CS?',
    type: 'choice',
    options: ['Yes', 'No']
  },
  online: {
    id: 'online',
    label: 'Device online?',
    type: 'choice',
    options: ['Yes', 'No']
  },
  mail: {
    id: 'mail',
    label: 'Mail sent?',
    type: 'choice',
    options: ['Yes', 'No']
  },
  dcMail: {
    id: 'dcMail',
    label: 'Mail from DC',
    type: 'choice',
    options: ['Received', 'Not received']
  },
  drcMail: {
    id: 'drcMail',
    label: 'Mail from DRC',
    type: 'choice',
    options: ['Received', 'Not received']
  },
  cables: {
    id: 'cables',
    label: 'All ISP and LAN cables connected to SD-WAN device?',
    type: 'choice',
    options: ['Connected', 'Not connected']
  },
  working: {
    id: 'working',
    label: 'Is it working?',
    type: 'choice',
    options: ['Yes', 'No']
  }
};

export function getFieldsForKind(kind) {
  const isBranch = kind === 'Branch';
  const list = [];

  // Primary identifiers
  if (isBranch) {
    list.push({ ...FIELD_DEFINITIONS.dpCode, required: true });
  } else {
    list.push({ ...FIELD_DEFINITIONS.atmId, required: true });
    list.push({ ...FIELD_DEFINITIONS.dpCode, label: 'Base Branch DP Code', required: false });
  }

  // Add all sections
  for (const section of SECTIONS) {
    for (const fieldId of section.fields) {
      const def = FIELD_DEFINITIONS[fieldId];
      if (def) {
        if (def.branchOnly && !isBranch) continue;
        list.push({ ...def, section: section.title });
      }
    }
  }

  return list;
}
