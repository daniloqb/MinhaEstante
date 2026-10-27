/** Run the SAME synthetic domain suite on a local native DEV WebView or test browser.
 * node scripts/validate_digital_conformance.mjs 9333 http://127.0.0.1:3214
 * node scripts/validate_digital_conformance.mjs 9222 https://localhost
 */
const port=Number(process.argv[2]??9333),origin=new URL(process.argv[3]??'http://127.0.0.1:3214').origin;
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw new Error('Only local diagnostic targets are allowed');
const tabs=await(await fetch(`http://127.0.0.1:${port}/json`)).json();
const tab=tabs.find(t=>t.url.startsWith(origin+'/')&&(t.url.includes('cross-platform.html')||origin==='https://localhost'));
if(!tab)throw new Error('Open the isolated diagnostic target first');
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
try{
 const result=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Conformance timed out')),180000);
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id===1){clearTimeout(timer);resolve(m);}};
  ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:"(async()=>{for(let i=0;i<100;i++){if(document.readyState==='complete'&&typeof window.runDigitalConformance==='function')return window.runDigitalConformance();await new Promise(r=>setTimeout(r,100));}throw new Error('Diagnostic not ready');})()",awaitPromise:true,returnByValue:true,userGesture:true}}));
 });
 if(result.error||result.result?.exceptionDetails)throw new Error(result.result?.exceptionDetails?.exception?.description??'Diagnostic evaluation failed');
 console.log(JSON.stringify(result.result.result.value,null,2));
}finally{ws.close();}
