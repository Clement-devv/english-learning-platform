// Run against the deployed private ClamAV service. No files are saved.
import assert from 'node:assert/strict';
import { scanUpload } from '../utils/uploadScan.js';

await scanUpload(Buffer.from('Clemify clean upload scanner check.'));
// Standard harmless EICAR antivirus test pattern, not executable malware.
const eicar = ['X5O!P%@AP[4', '\\PZX54(P^)7CC)7}', '$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'].join('');
await assert.rejects(scanUpload(Buffer.from(eicar)), { code: 'UPLOAD_SCAN_REJECTED' });
process.stdout.write('PASS: clean content accepted; EICAR test content rejected.\n');
