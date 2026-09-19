#!/bin/bash
# Usage: ./pcheck.sh <file.html>
F="${1:-$(dirname "$0")/../dist/stellar-dominion.html}"
node -e "
const fs=require('fs');const h=fs.readFileSync('$F','utf8');
const m=h.match(/<script>([\s\S]*)<\/script>/);
if(!m){console.log('NO SCRIPT BLOCK FOUND');process.exit(1)}
try{new Function(m[1]);console.log('JS PARSES OK')}catch(e){console.log('PARSE FAIL',e.message)}"
