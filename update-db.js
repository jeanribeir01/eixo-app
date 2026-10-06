const fs = require('fs');
let code = fs.readFileSync('src/types/database.ts', 'utf8');

const sRow = '            status_pagamento: Database["public"]["Enums"]["status_pagamento"]\n            valor: number';
const rRow = '            status_pagamento: Database["public"]["Enums"]["status_pagamento"]\n            valor: number\n            comprovante_url?: string | null';

const sIns = '            status_pagamento?: Database["public"]["Enums"]["status_pagamento"]\n            valor: number';
const rIns = '            status_pagamento?: Database["public"]["Enums"]["status_pagamento"]\n            valor: number\n            comprovante_url?: string | null';

const sUpd = '            status_pagamento?: Database["public"]["Enums"]["status_pagamento"]\n            valor?: number';
const rUpd = '            status_pagamento?: Database["public"]["Enums"]["status_pagamento"]\n            valor?: number\n            comprovante_url?: string | null';

code = code.replace(sRow, rRow);
code = code.replace(sIns, rIns);
code = code.replace(sUpd, rUpd);
fs.writeFileSync('src/types/database.ts', code);
