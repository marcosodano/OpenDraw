const fs = require('fs');
const path = require('path');

const routerSvg = fs.readFileSync(path.join(__dirname, 'actual_Router.svg'), 'utf8').trim();
const switchSvg = fs.readFileSync(path.join(__dirname, 'actual_AccessSwitch.svg'), 'utf8').trim();
const firewallSvg = fs.readFileSync(path.join(__dirname, 'actual_Firewall.svg'), 'utf8').trim();

const code = `/**
 * Authentic Microsoft Visio Cisco 3D Vector Masters
 * Extracted directly from official Visio OPC stencil packages.
 */

const CiscoVectors = {
  router: ${JSON.stringify(routerSvg)},
  switch: ${JSON.stringify(switchSvg)},
  firewall: ${JSON.stringify(firewallSvg)}
};

if (typeof window !== 'undefined') {
  window.CiscoVectors = CiscoVectors;
}
if (typeof module !== 'undefined') {
  module.exports = CiscoVectors;
}
`;

const dest = path.join(__dirname, '..', 'src', 'renderer', 'core', 'CiscoVectors.js');
fs.writeFileSync(dest, code);
console.log('Successfully wrote CiscoVectors.js, bytes:', fs.statSync(dest).size);

