const { exec } = require('child_process');

exec('npm install fabric@5.3.0', (error, stdout, stderr) => {
  if (error) {
    console.error('Error installing fabric:', error);
    return;
  }
  console.log('Fabric.js installed successfully');
  console.log('stdout:', stdout);
});
