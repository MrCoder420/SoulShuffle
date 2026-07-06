const fs = require('fs');
try {
  fs.writeFileSync('assets/images/bundle_spicy.png', fs.readFileSync('/Users/priyanshu/.gemini/antigravity-ide/brain/cd95f159-499a-40ea-89c2-0d106c6da2af/bundle_spicy_1783331739929.png'));
  fs.writeFileSync('assets/images/bundle_romantic.png', fs.readFileSync('/Users/priyanshu/.gemini/antigravity-ide/brain/cd95f159-499a-40ea-89c2-0d106c6da2af/bundle_romantic_1783331770325.png'));
  fs.writeFileSync('assets/images/bundle_cozy.png', fs.readFileSync('/Users/priyanshu/.gemini/antigravity-ide/brain/cd95f159-499a-40ea-89c2-0d106c6da2af/bundle_cozy_1783331808546.png'));
  console.log('Successfully copied all bundle images!');
} catch (err) {
  console.error('Error copying files:', err);
}
