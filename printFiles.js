const fs = require('fs');
const path = require('path');

const excludeDirs = ['node_modules', 'tests', 'test', 'logs', '.git', '.next', 'dist', 'build'];
const excludeExtensions = ['.log', '.gitignore', '.json', '.svg', '.ico', '.txt', '.md', '.sql', '.prisma'];
const outputFilePath = 'output.txt';

function shouldExclude(filePath) {
  // Split the path into segments
  const segments = filePath.split(path.sep);
  
  // Check if any segment matches excluded directories
  if (segments.some(segment => excludeDirs.includes(segment))) {
    return true;
  }
  
  // Check file extensions
  for (const ext of excludeExtensions) {
    if (filePath.endsWith(ext)) {
      return true;
    }
  }
  
  return false;
}

function printFiles(dir, relativePath = '', output = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const fileRelativePath = path.join(relativePath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      printFiles(filePath, fileRelativePath, output);
    } else if (!shouldExclude(fileRelativePath)) {
      output.push(`// ${fileRelativePath}`);
      const content = fs.readFileSync(filePath, 'utf-8');
      output.push(content);
      output.push(''); // Add an empty line for separation
    }
  });

  return output;
}

const output = printFiles(process.cwd());
fs.writeFileSync(outputFilePath, output.join('\n'), 'utf-8');
console.log(`Output written to ${outputFilePath}`);