// Builds a Lovelace card config from a plan JSON. Usage:
//   node scripts/plan-to-config.mjs path/to/plan.json [--plan-url /local/house-control/plan.json] [--quality low|high] [--no-actions]
import fs from 'node:fs';

const args = process.argv.slice(2);
let file = null;
let planUrl = '/local/house-control/plan.json';
let quality = 'low';
let withActions = true;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--plan-url') planUrl = args[++i];
  else if (args[i] === '--quality') quality = args[++i];
  else if (args[i] === '--no-actions') withActions = false;
  else file = args[i];
}

if (!file) {
  console.error('Usage: node scripts/plan-to-config.mjs <plan.json> [--plan-url URL] [--quality low|high] [--no-actions]');
  process.exit(1);
}

const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
const q = (value) => JSON.stringify(String(value));
const lines = [
  'type: custom:house-control-card',
  `plan_url: ${q(planUrl)}`,
  `quality: ${q(quality)}`,
];

if (withActions) {
  const devices = [];
  const skipped = [];
  for (const device of [...(plan.lights || []), ...(plan.acs || [])]) {
    const entity = device.entity_id || device.entity;
    if (entity) devices.push({ id: device.id, entity });
    else skipped.push(device.id);
  }

  if (devices.length) {
    lines.push('', 'devices:');
    for (const device of devices) {
      lines.push(`  ${q(device.id)}:`);
      for (const key of ['tap_action', 'hold_action', 'double_tap_action']) {
        lines.push(`    ${key}:`);
        lines.push('      action: fire-dom-event');
        lines.push('      popup_menu:');
        lines.push(`        entity_id: ${q(device.entity)}`);
      }
    }
  }

  const rooms = (plan.rooms || []).map((room) => room.id);
  if (rooms.length) {
    lines.push('', 'rooms:');
    for (const id of rooms) {
      lines.push(`  ${q(id)}:`);
      for (const key of ['tap_action', 'hold_action', 'double_tap_action']) {
        lines.push(`    ${key}:`);
        lines.push('      action: fire-dom-event');
        lines.push('      popup_menu:');
        lines.push(`        room: ${q(id)}`);
      }
    }
  }

  if (skipped.length) {
    console.error(`No entity_id, skipped actions for: ${skipped.join(', ')}`);
  }
}

console.log(lines.join('\n'));
