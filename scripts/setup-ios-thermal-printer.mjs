/**
 * 1) Copia el plugin nativo iOS de capacitor-thermal-printer a LocalPackages (SPM no puede depender de node_modules).
 * 2) Parchea ios/App/CapApp-SPM/Package.swift para enlazar ese paquete (cap sync lo regenera sin thermal).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const nmThermal = path.join(root, 'node_modules', 'capacitor-thermal-printer');
const capSpmPath = path.join(root, 'ios', 'App', 'CapApp-SPM', 'Package.swift');
const localRoot = path.join(root, 'ios', 'App', 'LocalPackages', 'CapacitorThermalPrinter');
const vendorDest = path.join(localRoot, 'Vendor');

const SPM_DEP_LINE =
  '        .package(name: "CapacitorThermalPrinter", path: "../LocalPackages/CapacitorThermalPrinter"),\n';
const SPM_PRODUCT_LINE =
  '                .product(name: "CapacitorThermalPrinter", package: "CapacitorThermalPrinter"),\n';

function vendorPlugin() {
  if (!fs.existsSync(nmThermal)) {
    console.warn('[setup-ios-thermal-printer] Sin node_modules/capacitor-thermal-printer — omitiendo vendor.');
    return false;
  }
  const pluginSrc = path.join(nmThermal, 'ios', 'Plugin');
  if (!fs.existsSync(pluginSrc)) {
    console.warn('[setup-ios-thermal-printer] Sin ios/Plugin en el paquete — omitiendo vendor.');
    return false;
  }
  fs.rmSync(vendorDest, { recursive: true, force: true });
  fs.mkdirSync(vendorDest, { recursive: true });
  fs.cpSync(pluginSrc, vendorDest, { recursive: true });
  const bridgeSrc = path.join(nmThermal, 'ios', 'Bridging-Header.h');
  if (fs.existsSync(bridgeSrc)) {
    const bridging = fs.readFileSync(bridgeSrc, 'utf8');
    const fixed = bridging.replaceAll('"Plugin/', '"');
    fs.writeFileSync(path.join(vendorDest, 'CapacitorThermalPrinter-Bridging-Header.h'), fixed, 'utf8');
  }
  console.log('[setup-ios-thermal-printer] Vendor OK →', path.relative(root, vendorDest));
  return true;
}

function patchCapAppSpm() {
  if (!fs.existsSync(capSpmPath)) {
    console.warn('[setup-ios-thermal-printer] Sin ios/App/CapApp-SPM/Package.swift — omitiendo parche SPM.');
    return;
  }
  let body = fs.readFileSync(capSpmPath, 'utf8');
  const marker = 'LocalPackages/CapacitorThermalPrinter';
  if (!body.includes(marker)) {
    body = body.replace(
      /(\.package\(name: "CapgoCapacitorSpeechRecognition",[^\)]+\))\s*\n(\s*\],)/,
      `$1,\n${SPM_DEP_LINE.trimEnd()}\n$2`
    );
  }
  if (!body.includes('"CapacitorThermalPrinter", package: "CapacitorThermalPrinter"')) {
    body = body.replace(
      /(\.product\(name: "CapgoCapacitorSpeechRecognition", package: "CapgoCapacitorSpeechRecognition"\))\s*\n(\s*\])/,
      `$1,\n${SPM_PRODUCT_LINE.trimEnd()}\n$2`
    );
  }
  fs.writeFileSync(capSpmPath, body, 'utf8');
  console.log('[setup-ios-thermal-printer] CapApp-SPM enlazado con CapacitorThermalPrinter (local).');
}

vendorPlugin();
patchCapAppSpm();
