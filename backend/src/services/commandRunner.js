const { spawn } = require('child_process');

function runFile(file, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 || options.acceptCodes?.includes(code)) {
        resolve({ stdout, stderr, code });
      } else {
        const error = new Error(`${file} exited with status ${code}`);
        error.code = code;
        error.stderr = stderr;
        reject(error);
      }
    });
    if (options.input !== undefined) child.stdin.end(options.input);
    else child.stdin.end();
  });
}

module.exports = { runFile };
