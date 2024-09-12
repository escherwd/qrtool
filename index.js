import QRReader from 'qrcode-reader'
import QRWriter from 'qrcode'
import { Jimp } from 'jimp'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path';

// Read input folder
const dir = process.argv[2];
if (!dir) {
  console.error('× Please provide a directory path.');
  process.exit(1);
}

// Wrap logic in async function
(async () => {
  // Loop through the files
  for (const file of await fs.readdir(dir)) {
    // Skip already-converted and hidden files
    if (file.match(/\.svg$/) || file.match(/^\./)) continue;
    // Read file
    var img = await Jimp.read(path.join(dir, file))
    // Create a new qrcode instance
    var qr = new QRReader();
    // Define the callback function
    qr.callback = async function (err, value) {
      if (err)
        return console.error(`× Error reading: ${file}`, err);
      // Ensure this file doesn't already exist
      const newFile = file.replace(/\.[0-9a-z]+$/i, '.svg')
      if (fsSync.existsSync(path.join(dir, newFile)))
        return console.error(`× Already converted: ${newFile}`)
      // Write the extracted url to a new SVG QR code
      await QRWriter.toFile(path.join(dir, newFile), value.result)
      console.log(`✓ ${file} → ${newFile}`);
    };
    qr.decode(img.bitmap);
  }
})()