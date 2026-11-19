// Hosted automation reads the server-only capability through owner-authorized Sites database tools.
// Credentials are accepted only on hidden stdin, never argv, files or output.
import readline from 'node:readline';
const allowedOrigin='https://brainup-mobile-nov26.regalpeach22.chatgpt.site';
const input=readline.createInterface({input:process.stdin,output:process.stdout,terminal:!!process.stdin.isTTY});
if(process.stdin.isTTY)input._writeToOutput=()=>{};
process.stdout.write('Ready for notification key JSON on hidden stdin.\n');
try{const line=await new Promise(resolve=>input.once('line',resolve));input.close();const payload=JSON.parse(line);if(typeof payload.key!=='string'||!/^[a-f0-9]{64}$/.test(payload.key))throw Error('Invalid notification capability');const response=await fetch(allowedOrigin+'/internal/notifications/tick',{method:'POST',headers:{Authorization:'Bearer '+payload.key},signal:AbortSignal.timeout(55000)}),result=await response.json();if(!response.ok||!result.ok)throw Error('Notification runner unavailable ('+response.status+')');process.stdout.write(JSON.stringify({ok:true,sent:result.sent,failed:result.failed,skipped:result.skipped})+'\n')}catch(error){process.stderr.write(String(error.message)+'\n');process.exitCode=1}finally{input.close()}
