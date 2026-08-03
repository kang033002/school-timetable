const { get } = require('./src/db/database'); get(\SELECT MAX(CAST(code AS INTEGER)) as maxCode FROM schools WHERE code GLOB '[0-9]*'\).then(console.log).catch(console.error);
