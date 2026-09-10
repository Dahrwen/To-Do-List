// build.js
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

const content = `const SUPABASE_URL = "${supabaseUrl}";
const SUPABASE_KEY = "${supabaseKey}";
`;

fs.writeFileSync('config.js', content);
console.log('config.js generated successfully for deployment.');