const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/snap/bin/chromium',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 720, height: 1280 });
  await page.goto('https://patisonkindle-commits.github.io/color-block-jam/');
  await page.waitForSelector('canvas', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 3000));
  
  // Click PLAY at (360, 600)
  await page.mouse.click(360, 600);
  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({ path: '/tmp/v0_board.png' });
  console.log('✓ Board loaded');
  
  // Test shuffle by clicking shuffle button
  await page.mouse.click(620, 1100);
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: '/tmp/v1_after_shuffle.png' });
  console.log('✓ Shuffle executed');
  
  // Check block sizes via canvas pixel data
  const blockInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Sample every 80px (cell size) at known board positions
    let colors = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 6; c++) {
        const px = 90 + c * 90 + 40; // center of cell
        const py = 200 + r * 90 + 40;
        const idx = (py * canvas.width + px) * 4;
        if (idx < pixels.data.length) {
          colors.push({ r, c, r: pixels.data[idx], g: pixels.data[idx+1], b: pixels.data[idx+2] });
        }
      }
    }
    return colors;
  });
  console.log('Block colors:', JSON.stringify(blockInfo.slice(0, 10)));
  
  await browser.close();
})();
