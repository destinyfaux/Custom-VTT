// server/utils/assetScanner.js
const fs = require('fs');
const path = require('path');

function getMapList() {
    const mapsDir = path.join(__dirname, '../assets/maps');
    return fs.readdirSync(mapsDir).filter(file => 
        fs.statSync(path.join(mapsDir, file)).isDirectory()
    );
}