const https = require('https');
const fs = require('fs');
const path = require('path');

// Download a working Hindi font
const fontUrl = 'https://fonts.gstatic.com/s/notosansdevanagari/v25/TuGoUUFzXI5FBtUq5a8bjKYTZjtRU6Sgv3NaV_SNmI0b8QQCQmHn6B2OHjbL_08AlXQly_AzOy8.ttf';
const fontPath = path.join(__dirname, 'fonts', 'NotoSansDevanagari-Regular.ttf');

console.log('Downloading Hindi font...');

const file = fs.createWriteStream(fontPath);

https.get(fontUrl, (response) => {
  if (response.statusCode === 200) {
    response.pipe(file);
    
    file.on('finish', () => {
      file.close();
      console.log('Font downloaded successfully!');
      
      // Check if it's a valid font file
      const buffer = fs.readFileSync(fontPath, { start: 0, end: 4 });
      const header = buffer.toString('hex');
      console.log('Font header (hex):', header);
      console.log('File size:', fs.statSync(fontPath).size, 'bytes');
      
      if (header === '00010000' || header === '4f54544f' || header === '74727565') {
        console.log('✅ Valid font file downloaded!');
      } else {
        console.log('❌ Downloaded file is not a valid font');
      }
    });
    
    file.on('error', (err) => {
      console.error('Error writing font file:', err);
    });
  } else {
    console.error('Error downloading font:', response.statusCode);
  }
}).on('error', (err) => {
  console.error('Error downloading font:', err);
});
